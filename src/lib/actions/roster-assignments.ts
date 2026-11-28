"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, canManageMinistry, audit, type Actor } from "@/lib/auth-and-audit";
import { prisma } from "@/lib/prisma";
import { describeSlot, monthLabel } from "@/lib/roster-period";
import { suggestRoster, type Answer, type PlanPerson } from "@/lib/roster-plan";
import type { Prisma } from "@/generated/prisma/client";

// Montar a escala do mês (Escala dos Ministérios, parte 3). Por enquanto é uma
// prévia: só o painel vê. Quem mexe: admin em qualquer ministério; líder só nos
// que lidera (canManageMinistry — Mídia e Admin passam sempre).

const NO_PERMISSION = "Você só pode montar a escala dos ministérios que lidera.";
const canManage = (actor: Actor, ministryId: string) => canManageMinistry(actor, ministryId);

const slotText = (startsAt: Date) => {
  const d = describeSlot(startsAt);
  return `${d.day} ${d.time}`;
};

async function auditPlan(
  tx: Prisma.TransactionClient,
  actor: Actor,
  period: { id: string; month: string },
  note: string
) {
  await audit(tx, actor, {
    action: "UPDATE",
    entityType: "ROSTER_PERIOD",
    entityId: period.id,
    entityLabel: `Escala de ${monthLabel(period.month)}`,
    note,
  });
}

function revalidate() {
  revalidatePath("/backstage/escala");
}

const idSchema = z.string().uuid();

const labelSchema = z.string().trim().max(40, "A função pode ter até 40 letras.");

/**
 * Função digitada na hora. Se bate com uma função cadastrada do ministério
 * (sem ligar pra maiúscula/acento), guarda o vínculo; senão guarda o texto.
 */
async function resolveFunction(tx: Prisma.TransactionClient, ministryId: string, label: string) {
  if (!label) return { functionId: null, functionLabel: null, display: "" };
  const fns = await tx.ministryFunction.findMany({ where: { ministryId }, select: { id: true, name: true } });
  const match = fns.find((f) => f.name.localeCompare(label, "pt-BR", { sensitivity: "base" }) === 0);
  return match
    ? { functionId: match.id, functionLabel: null, display: match.name }
    : { functionId: null, functionLabel: label, display: label };
}

export async function assignToSlot(input: {
  slotId: string;
  ministryId: string;
  volunteerId: string;
  functionLabel: string;
}): Promise<{ error?: string }> {
  const parsed = z
    .object({ slotId: idSchema, ministryId: idSchema, volunteerId: idSchema, functionLabel: labelSchema })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Escolha a pessoa de novo." };
  const { slotId, ministryId, volunteerId, functionLabel } = parsed.data;

  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };

  return prisma.$transaction(async (tx) => {
    const [slot, membership, skip] = await Promise.all([
      tx.rosterSlot.findUnique({ where: { id: slotId }, select: { startsAt: true, period: { select: { id: true, month: true } } } }),
      tx.volunteerMembership.findUnique({
        where: { volunteerId_ministryId: { volunteerId, ministryId } },
        select: { status: true, volunteer: { select: { name: true, active: true } }, ministry: { select: { name: true } } },
      }),
      tx.rosterSlotSkip.findUnique({ where: { slotId_ministryId: { slotId, ministryId } }, select: { slotId: true } }),
    ]);
    if (!slot) return { error: "Esse culto não está mais na escala." };
    if (!membership || membership.status !== "ACTIVE" || !membership.volunteer.active) {
      return { error: "Essa pessoa não está na equipe." };
    }
    if (skip) return { error: "Esse dia está marcado como “não servimos”. Desmarque antes de escalar." };

    const exists = await tx.rosterAssignment.findUnique({
      where: { slotId_ministryId_volunteerId: { slotId, ministryId, volunteerId } },
      select: { id: true },
    });
    if (exists) return { error: "Essa pessoa já está nesse culto." };

    const fn = await resolveFunction(tx, ministryId, functionLabel);
    await tx.rosterAssignment.create({
      data: { slotId, ministryId, volunteerId, functionId: fn.functionId, functionLabel: fn.functionLabel },
    });
    await auditPlan(
      tx,
      actor,
      slot.period,
      `${membership.ministry.name}: escalou ${membership.volunteer.name}${fn.display ? ` (${fn.display})` : ""} em ${slotText(slot.startsAt)}`
    );
    revalidate();
    return {};
  });
}

/** "Escalar todos que marcaram que podem": várias pessoas num dia, cada uma com a sua função. */
export async function assignManyToSlot(input: {
  slotId: string;
  ministryId: string;
  people: { volunteerId: string; functionLabel: string }[];
}): Promise<{ error?: string; added?: number }> {
  const parsed = z
    .object({
      slotId: idSchema,
      ministryId: idSchema,
      people: z.array(z.object({ volunteerId: idSchema, functionLabel: labelSchema })).min(1).max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tente de novo." };
  const { slotId, ministryId, people } = parsed.data;

  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };

  return prisma.$transaction(async (tx) => {
    const [slot, ministry, skip, team, already, fns] = await Promise.all([
      tx.rosterSlot.findUnique({ where: { id: slotId }, select: { startsAt: true, period: { select: { id: true, month: true } } } }),
      tx.ministry.findUnique({ where: { id: ministryId }, select: { name: true } }),
      tx.rosterSlotSkip.findUnique({ where: { slotId_ministryId: { slotId, ministryId } }, select: { slotId: true } }),
      tx.volunteerMembership.findMany({
        where: { ministryId, status: "ACTIVE", volunteer: { active: true }, volunteerId: { in: people.map((p) => p.volunteerId) } },
        select: { volunteerId: true },
      }),
      tx.rosterAssignment.findMany({ where: { slotId, ministryId }, select: { volunteerId: true } }),
      tx.ministryFunction.findMany({ where: { ministryId }, select: { id: true, name: true } }),
    ]);
    if (!slot || !ministry) return { error: "Esse culto não está mais na escala." };
    if (skip) return { error: "Esse dia está marcado como “não servimos”. Desmarque antes de escalar." };

    const inTeam = new Set(team.map((m) => m.volunteerId));
    const taken = new Set(already.map((a) => a.volunteerId));
    const data = people
      .filter((p) => inTeam.has(p.volunteerId) && !taken.has(p.volunteerId))
      .map((p) => {
        const label = p.functionLabel;
        const match = label ? fns.find((f) => f.name.localeCompare(label, "pt-BR", { sensitivity: "base" }) === 0) : undefined;
        return {
          slotId,
          ministryId,
          volunteerId: p.volunteerId,
          functionId: match?.id ?? null,
          functionLabel: match || !label ? null : label,
        };
      });
    if (data.length === 0) return { added: 0 };

    await tx.rosterAssignment.createMany({ data, skipDuplicates: true });
    await auditPlan(tx, actor, slot.period, `${ministry.name}: escalou ${data.length} pessoa(s) de uma vez em ${slotText(slot.startsAt)}`);
    revalidate();
    return { added: data.length };
  });
}

/** "Trocar": tira quem está escalado e põe outra pessoa no mesmo dia, numa vez só. */
export async function swapAssignment(input: {
  assignmentId: string;
  volunteerId: string;
  functionLabel: string;
}): Promise<{ error?: string }> {
  const parsed = z
    .object({ assignmentId: idSchema, volunteerId: idSchema, functionLabel: labelSchema })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tente de novo." };
  const { assignmentId, volunteerId, functionLabel } = parsed.data;
  const actor = await getActor();

  return prisma.$transaction(async (tx) => {
    const old = await tx.rosterAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        slotId: true,
        ministryId: true,
        ministry: { select: { name: true } },
        volunteer: { select: { name: true } },
        slot: { select: { startsAt: true, period: { select: { id: true, month: true } } } },
      },
    });
    if (!old) return { error: "Essa escalação não existe mais. Atualize a página." };
    if (!canManage(actor, old.ministryId)) return { error: NO_PERMISSION };

    const [membership, exists] = await Promise.all([
      tx.volunteerMembership.findUnique({
        where: { volunteerId_ministryId: { volunteerId, ministryId: old.ministryId } },
        select: { status: true, volunteer: { select: { name: true, active: true } } },
      }),
      tx.rosterAssignment.findUnique({
        where: { slotId_ministryId_volunteerId: { slotId: old.slotId, ministryId: old.ministryId, volunteerId } },
        select: { id: true },
      }),
    ]);
    if (!membership || membership.status !== "ACTIVE" || !membership.volunteer.active) {
      return { error: "Essa pessoa não está na equipe." };
    }
    if (exists) return { error: "Essa pessoa já está nesse dia." };

    const fn = await resolveFunction(tx, old.ministryId, functionLabel);
    await tx.rosterAssignment.delete({ where: { id: assignmentId } });
    await tx.rosterAssignment.create({
      data: {
        slotId: old.slotId,
        ministryId: old.ministryId,
        volunteerId,
        functionId: fn.functionId,
        functionLabel: fn.functionLabel,
      },
    });
    await auditPlan(
      tx,
      actor,
      old.slot.period,
      `${old.ministry.name}: trocou ${old.volunteer.name} por ${membership.volunteer.name}${fn.display ? ` (${fn.display})` : ""} em ${slotText(old.slot.startsAt)}`
    );
    revalidate();
    return {};
  });
}

/** Troca a função de quem já está escalado (texto livre). */
export async function setAssignmentFunction(assignmentId: string, functionLabel: string): Promise<{ error?: string }> {
  const parsed = z.object({ id: idSchema, label: labelSchema }).safeParse({ id: assignmentId, label: functionLabel });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tente de novo." };
  const actor = await getActor();

  return prisma.$transaction(async (tx) => {
    const a = await tx.rosterAssignment.findUnique({
      where: { id: parsed.data.id },
      select: {
        ministryId: true,
        ministry: { select: { name: true } },
        volunteer: { select: { name: true } },
        slot: { select: { startsAt: true, period: { select: { id: true, month: true } } } },
      },
    });
    if (!a) return { error: "Essa escalação não existe mais." };
    if (!canManage(actor, a.ministryId)) return { error: NO_PERMISSION };
    const fn = await resolveFunction(tx, a.ministryId, parsed.data.label);
    await tx.rosterAssignment.update({
      where: { id: parsed.data.id },
      data: { functionId: fn.functionId, functionLabel: fn.functionLabel },
    });
    await auditPlan(
      tx,
      actor,
      a.slot.period,
      `${a.ministry.name}: função de ${a.volunteer.name} em ${slotText(a.slot.startsAt)} → ${fn.display || "sem função"}`
    );
    revalidate();
    return {};
  });
}

/** "Nosso ministério não serve nesse dia" (ou volta a servir). Padrão: serve. */
export async function setSlotServed(input: {
  slotId: string;
  ministryId: string;
  served: boolean;
}): Promise<{ error?: string }> {
  const parsed = z.object({ slotId: idSchema, ministryId: idSchema, served: z.boolean() }).safeParse(input);
  if (!parsed.success) return { error: "Tente de novo." };
  const { slotId, ministryId, served } = parsed.data;
  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };

  return prisma.$transaction(async (tx) => {
    const [slot, ministry, assigned] = await Promise.all([
      tx.rosterSlot.findUnique({
        where: { id: slotId },
        select: { startsAt: true, label: true, period: { select: { id: true, month: true } } },
      }),
      tx.ministry.findUnique({ where: { id: ministryId }, select: { name: true } }),
      tx.rosterAssignment.count({ where: { slotId, ministryId } }),
    ]);
    if (!slot || !ministry) return { error: "Esse culto não está mais na escala." };
    if (served) {
      await tx.rosterSlotSkip.deleteMany({ where: { slotId, ministryId } });
    } else {
      if (assigned > 0) return { error: "Tire quem está escalado nesse dia antes de marcar que o ministério não serve." };
      await tx.rosterSlotSkip.upsert({
        where: { slotId_ministryId: { slotId, ministryId } },
        create: { slotId, ministryId },
        update: {},
      });
    }
    await auditPlan(
      tx,
      actor,
      slot.period,
      `${ministry.name}: ${served ? "volta a servir" : "não serve"} em ${slotText(slot.startsAt)} (${slot.label})`
    );
    revalidate();
    return {};
  });
}

export async function unassign(assignmentId: string): Promise<{ error?: string }> {
  if (!idSchema.safeParse(assignmentId).success) return {};
  const actor = await getActor();
  return prisma.$transaction(async (tx) => {
    const a = await tx.rosterAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        ministryId: true,
        ministry: { select: { name: true } },
        volunteer: { select: { name: true } },
        slot: { select: { startsAt: true, period: { select: { id: true, month: true } } } },
      },
    });
    if (!a) return {};
    if (!canManage(actor, a.ministryId)) return { error: NO_PERMISSION };
    await tx.rosterAssignment.delete({ where: { id: assignmentId } });
    await auditPlan(tx, actor, a.slot.period, `${a.ministry.name}: tirou ${a.volunteer.name} de ${slotText(a.slot.startsAt)}`);
    revalidate();
    return {};
  });
}

const suggestSchema = z.object({
  periodId: idSchema,
  ministryId: idSchema,
  mode: z.enum(["fill", "redo"]),
  maxPerWeekday: z.coerce.number().int().min(1).max(5),
  /** functionId → quantas por culto; "" = ministério sem funções. */
  needs: z.record(z.string(), z.coerce.number().int().min(0).max(30)),
});

export type SuggestResultState = { error?: string; added?: number; missingSlots?: number };

export async function suggestRosterAction(input: z.input<typeof suggestSchema>): Promise<SuggestResultState> {
  const parsed = suggestSchema.safeParse(input);
  if (!parsed.success) return { error: "Confira os números: de 0 a 30 pessoas, e de 1 a 5 vezes por pessoa." };
  const { periodId, ministryId, mode, maxPerWeekday, needs } = parsed.data;

  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };

  const [period, ministry] = await Promise.all([
    prisma.rosterPeriod.findUnique({
      where: { id: periodId },
      select: {
        id: true,
        month: true,
        slots: {
          select: { id: true, startsAt: true, createdAt: true, skips: { where: { ministryId }, select: { slotId: true } } },
        },
      },
    }),
    prisma.ministry.findUnique({
      where: { id: ministryId },
      select: { name: true, functions: { select: { id: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    }),
  ]);
  if (!period) return { error: "Essa escala não existe mais." };
  if (!ministry) return { error: "Esse ministério não existe mais." };

  // Quantas por culto: por função, ou um número só quando não há funções.
  const hasFunctions = ministry.functions.length > 0;
  const needList = hasFunctions
    ? ministry.functions.map((f) => ({ functionId: f.id as string | null, count: needs[f.id] ?? 0 }))
    : [{ functionId: null, count: needs[""] ?? 0 }];
  if (needList.every((n) => n.count === 0)) return { error: "Diga quantas pessoas cada culto precisa." };

  const now = new Date();
  // Dias em que o ministério marcou que não serve ficam de fora da sugestão.
  const servedSlots = period.slots.filter((s) => s.skips.length === 0);
  const futureSlotIds = period.slots.filter((s) => s.startsAt > now).map((s) => s.id);

  const team = await prisma.volunteerMembership.findMany({
    where: { ministryId, status: "ACTIVE", volunteer: { active: true } },
    select: {
      functions: { select: { functionId: true } },
      volunteer: {
        select: {
          id: true,
          availabilityResponses: {
            where: { periodId },
            select: { updatedAt: true, slots: { select: { slotId: true } } },
          },
        },
      },
    },
    orderBy: { volunteer: { name: "asc" } },
  });
  const people: PlanPerson[] = team.map((m) => {
    const response = m.volunteer.availabilityResponses[0];
    const answers = new Map<string, Answer>();
    if (response) {
      const marked = new Set(response.slots.map((s) => s.slotId));
      for (const slot of period.slots) {
        if (marked.has(slot.id)) answers.set(slot.id, "yes");
        // Culto que entrou depois da resposta: a pessoa não viu, fica como "não respondeu".
        else if (response.updatedAt >= slot.createdAt) answers.set(slot.id, "no");
      }
    }
    return { volunteerId: m.volunteer.id, functionIds: m.functions.map((f) => f.functionId), answers };
  });

  const volunteerIds = people.map((p) => p.volunteerId);
  const all = await prisma.rosterAssignment.findMany({
    where: { slot: { periodId }, volunteerId: { in: volunteerIds } },
    select: { slotId: true, ministryId: true, volunteerId: true, functionId: true },
  });
  const futureSet = new Set(futureSlotIds);
  const existing = all.filter(
    (a) => a.ministryId === ministryId && !(mode === "redo" && futureSet.has(a.slotId))
  );
  const elsewhere = all.filter((a) => a.ministryId !== ministryId);

  const plan = suggestRoster({
    slots: servedSlots,
    people,
    needs: needList,
    existing,
    elsewhere,
    maxPerWeekday,
    now,
  });

  await prisma.$transaction(async (tx) => {
    // Guarda quantas por culto pra próxima vez.
    if (hasFunctions) {
      for (const n of needList) {
        await tx.ministryFunction.update({ where: { id: n.functionId! }, data: { perService: n.count } });
      }
    } else {
      await tx.ministry.update({ where: { id: ministryId }, data: { rosterPerService: needList[0].count } });
    }
    let removed = 0;
    if (mode === "redo") {
      removed = (
        await tx.rosterAssignment.deleteMany({ where: { ministryId, slotId: { in: futureSlotIds } } })
      ).count;
    }
    if (plan.add.length > 0) {
      await tx.rosterAssignment.createMany({
        data: plan.add.map((a) => ({ ...a, ministryId })),
        skipDuplicates: true,
      });
    }
    await auditPlan(
      tx,
      actor,
      period,
      `${ministry.name}: sugestão automática (${mode === "redo" ? `refeita, ${removed} tirada(s)` : "completou vagas"}) — ${plan.add.length} escalação(ões)`
    );
  });

  revalidate();
  return { added: plan.add.length, missingSlots: new Set(plan.missing.map((m) => m.slotId)).size };
}

/**
 * Publicar (ou tirar do ar) a escala do ministério no mês. Publicada, cada
 * pessoa da equipe vê as próprias datas no link do mês pelo WhatsApp; o que
 * mudar depois aparece na hora.
 */
export async function setRosterPublished(input: {
  periodId: string;
  ministryId: string;
  published: boolean;
}): Promise<{ error?: string }> {
  const parsed = z.object({ periodId: idSchema, ministryId: idSchema, published: z.boolean() }).safeParse(input);
  if (!parsed.success) return { error: "Tente de novo." };
  const { periodId, ministryId, published } = parsed.data;
  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };

  return prisma.$transaction(async (tx) => {
    const [period, ministry, count] = await Promise.all([
      tx.rosterPeriod.findUnique({ where: { id: periodId }, select: { id: true, month: true } }),
      tx.ministry.findUnique({ where: { id: ministryId }, select: { name: true } }),
      tx.rosterAssignment.count({ where: { ministryId, slot: { periodId } } }),
    ]);
    if (!period || !ministry) return { error: "Essa escala não existe mais." };
    if (published) {
      if (count === 0) return { error: "Escale alguém antes de publicar." };
      await tx.rosterPublication.upsert({
        where: { periodId_ministryId: { periodId, ministryId } },
        create: { periodId, ministryId, publishedById: actor.id },
        update: { publishedAt: new Date(), publishedById: actor.id },
      });
    } else {
      await tx.rosterPublication.deleteMany({ where: { periodId, ministryId } });
    }
    await audit(tx, actor, {
      action: published ? "PUBLISH" : "UNPUBLISH",
      entityType: "ROSTER_PERIOD",
      entityId: period.id,
      entityLabel: `Escala de ${monthLabel(period.month)}`,
      note: published
        ? `${ministry.name}: publicou a escala (${count} escalação(ões))`
        : `${ministry.name}: tirou a escala do ar`,
    });
    revalidate();
    revalidatePath(`/escala/${period.month}`);
    return {};
  });
}

/** Apaga a prévia do ministério nos cultos que ainda não passaram. */
export async function clearRoster(periodId: string, ministryId: string): Promise<{ error?: string; removed?: number }> {
  if (!idSchema.safeParse(periodId).success || !idSchema.safeParse(ministryId).success) return {};
  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };

  return prisma.$transaction(async (tx) => {
    const [period, ministry] = await Promise.all([
      tx.rosterPeriod.findUnique({ where: { id: periodId }, select: { id: true, month: true } }),
      tx.ministry.findUnique({ where: { id: ministryId }, select: { name: true } }),
    ]);
    if (!period || !ministry) return {};
    const { count } = await tx.rosterAssignment.deleteMany({
      where: { ministryId, slot: { periodId, startsAt: { gt: new Date() } } },
    });
    if (count > 0) await auditPlan(tx, actor, period, `${ministry.name}: limpou a escala (${count} escalação(ões))`);
    revalidate();
    return { removed: count };
  });
}
