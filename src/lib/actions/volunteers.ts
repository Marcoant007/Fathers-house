"use server";

import { revalidatePath } from "next/cache";
import { getActor, canManageMinistry, isEditor, audit, type Actor } from "@/lib/auth-and-audit";
import { prisma } from "@/lib/prisma";
import { functionNameSchema, volunteerSchema, type VolunteerFormValues } from "@/lib/schemas/volunteer";
import type { Prisma } from "@/generated/prisma/client";

// Equipe de voluntários de cada ministério (Escala, parte 1).
// Quem mexe: admin em qualquer ministério; líder só nos que lidera
// (canManageMinistry — Mídia e Admin passam sempre).
// Auditoria sem dado pessoal: telefone muda como "alterado", sem o número.

export type VolunteerActionState =
  | { ok?: true; message?: string; error?: string; fieldErrors?: Record<string, string> }
  | undefined;

const NO_PERMISSION = "Você só pode mexer na equipe dos ministérios que lidera.";

const canManage = (actor: Actor, ministryId: string) => canManageMinistry(actor, ministryId);

function flatten(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    availability: String(formData.get("availability") ?? ""),
    sundayShift: String(formData.get("sundayShift") ?? ""),
    termSigned: String(formData.get("termSigned") ?? ""),
    functionIds: formData.getAll("functionIds").map(String),
    birthDay: String(formData.get("birthDay") ?? ""),
    birthMonth: String(formData.get("birthMonth") ?? ""),
    birthYear: String(formData.get("birthYear") ?? ""),
    maritalStatus: String(formData.get("maritalStatus") ?? ""),
    city: String(formData.get("city") ?? ""),
    baptized: String(formData.get("baptized") ?? ""),
    convertedYear: String(formData.get("convertedYear") ?? ""),
  };
}

function revalidateRoster() {
  revalidatePath("/backstage/voluntarios");
}

/** Confere que as funções escolhidas são mesmo deste ministério. */
async function functionsOfMinistry(tx: Prisma.TransactionClient, ministryId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const found = await tx.ministryFunction.findMany({
    where: { id: { in: ids }, ministryId },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  return found.length === ids.length ? found : null;
}

async function setFunctions(tx: Prisma.TransactionClient, membershipId: string, functionIds: string[]) {
  await tx.volunteerMembershipFunction.deleteMany({ where: { membershipId } });
  if (functionIds.length > 0) {
    await tx.volunteerMembershipFunction.createMany({
      data: functionIds.map((functionId) => ({ membershipId, functionId })),
    });
  }
}

const FIELD_LABELS: Record<string, string> = {
  name: "nome",
  phone: "telefone",
  availability: "disponibilidade",
  sundayShift: "domingo",
  termSigned: "termo",
  birthDay: "aniversário",
  birthMonth: "aniversário",
  birthYear: "ano de nascimento",
  maritalStatus: "estado civil",
  city: "cidade",
  baptized: "batismo",
  convertedYear: "ano de conversão",
};

/** Dados pessoais: na Auditoria entram só como "alterado", sem o valor (LGPD). */
const PRIVATE_FIELDS = new Set(["phone", "birthDay", "birthMonth", "birthYear", "maritalStatus", "city", "baptized", "convertedYear"]);

/** Os "mais detalhes" do formulário, como colunas do banco. */
function detailsOf(data: VolunteerFormValues) {
  return {
    birthDay: data.birthDay,
    birthMonth: data.birthMonth,
    birthYear: data.birthYear,
    maritalStatus: data.maritalStatus,
    city: data.city,
    baptized: data.baptized,
    convertedYear: data.convertedYear,
  };
}

const DETAILS_SELECT = {
  birthDay: true,
  birthMonth: true,
  birthYear: true,
  maritalStatus: true,
  city: true,
  baptized: true,
  convertedYear: true,
} as const;

/** Diferença pra Auditoria. Telefone e detalhes pessoais entram só como "alterado" (LGPD). */
function volunteerChanges(before: Record<string, unknown>, data: VolunteerFormValues) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(FIELD_LABELS)) {
    const from = before[key] ?? null;
    const to = data[key as keyof VolunteerFormValues] ?? null;
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes[FIELD_LABELS[key]] = PRIVATE_FIELDS.has(key) ? { from: "—", to: "alterado" } : { from, to };
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Pessoa na equipe
// ---------------------------------------------------------------------------

/**
 * Adiciona alguém à equipe do ministério. Se o telefone já é de alguém do
 * cadastro (de outro ministério ou da inscrição), liga essa pessoa em vez de
 * criar outra — e só preenche o que estava em branco no cadastro dela.
 */
export async function addVolunteer(
  ministryId: string,
  _prev: VolunteerActionState,
  formData: FormData
): Promise<VolunteerActionState> {
  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };

  const parsed = volunteerSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: "Confira os campos destacados.", fieldErrors: flatten(parsed.error) };
  const data = parsed.data;

  return prisma.$transaction(async (tx): Promise<VolunteerActionState> => {
    const ministry = await tx.ministry.findUnique({ where: { id: ministryId }, select: { name: true } });
    if (!ministry) return { error: "Ministério não encontrado." };
    const functions = await functionsOfMinistry(tx, ministryId, data.functionIds);
    if (!functions) return { error: "Alguma função escolhida não existe mais. Recarregue a página." };

    const existing = data.phone ? await tx.volunteer.findUnique({ where: { phone: data.phone } }) : null;
    let volunteerId: string;
    let label = data.name;
    let message: string;

    if (existing) {
      volunteerId = existing.id;
      label = existing.name;
      const membership = await tx.volunteerMembership.findUnique({
        where: { volunteerId_ministryId: { volunteerId, ministryId } },
      });
      if (membership?.status === "ACTIVE") {
        return { error: `Esse número é de ${existing.name}, que já está na equipe de ${ministry.name}.` };
      }
      await tx.volunteer.update({
        where: { id: volunteerId },
        data: {
          active: true,
          availability: existing.availability ?? data.availability,
          sundayShift: existing.sundayShift ?? data.sundayShift,
          termSigned: existing.termSigned ?? data.termSigned,
          // Detalhes: só completa o que estava em branco no cadastro.
          ...(existing.birthDay == null && data.birthDay != null
            ? { birthDay: data.birthDay, birthMonth: data.birthMonth, birthYear: data.birthYear }
            : {}),
          maritalStatus: existing.maritalStatus ?? data.maritalStatus,
          city: existing.city ?? data.city,
          baptized: existing.baptized ?? data.baptized,
          convertedYear: existing.convertedYear ?? data.convertedYear,
        },
      });
      const saved = membership
        ? await tx.volunteerMembership.update({ where: { id: membership.id }, data: { status: "ACTIVE" } })
        : await tx.volunteerMembership.create({ data: { volunteerId, ministryId, status: "ACTIVE" } });
      await setFunctions(tx, saved.id, data.functionIds);
      message = `${existing.name} já estava no cadastro e agora está na equipe de ${ministry.name}.`;
    } else {
      const created = await tx.volunteer.create({
        data: {
          name: data.name,
          phone: data.phone,
          availability: data.availability,
          sundayShift: data.sundayShift,
          termSigned: data.termSigned,
          ...detailsOf(data),
          source: "painel",
          memberships: { create: { ministryId, status: "ACTIVE" } },
        },
        include: { memberships: { select: { id: true } } },
      });
      volunteerId = created.id;
      await setFunctions(tx, created.memberships[0].id, data.functionIds);
      message = `${data.name} entrou na equipe de ${ministry.name}.`;
    }

    await audit(tx, actor, {
      action: "CREATE",
      entityType: "VOLUNTEER",
      entityId: volunteerId,
      entityLabel: label,
      note: `Entrou na equipe de ${ministry.name}${existing ? " (já estava no cadastro)" : ""}${
        functions.length ? ` — ${functions.map((f) => f.name).join(", ")}` : ""
      }`,
    });
    revalidateRoster();
    return { ok: true, message };
  });
}

/** Edita o cadastro da pessoa e as funções dela neste ministério. */
export async function updateVolunteer(
  membershipId: string,
  _prev: VolunteerActionState,
  formData: FormData
): Promise<VolunteerActionState> {
  const actor = await getActor();
  const parsed = volunteerSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: "Confira os campos destacados.", fieldErrors: flatten(parsed.error) };
  const data = parsed.data;

  return prisma.$transaction(async (tx): Promise<VolunteerActionState> => {
    const membership = await tx.volunteerMembership.findUnique({
      where: { id: membershipId },
      select: {
        ministryId: true,
        ministry: { select: { name: true } },
        functions: { select: { function: { select: { id: true, name: true } } } },
        volunteer: {
          select: {
            id: true,
            name: true,
            phone: true,
            availability: true,
            sundayShift: true,
            termSigned: true,
            ...DETAILS_SELECT,
          },
        },
      },
    });
    if (!membership) return { error: "Essa pessoa não está mais nesta equipe. Recarregue a página." };
    if (!canManage(actor, membership.ministryId)) return { error: NO_PERMISSION };

    const before = membership.volunteer;
    if (data.phone && data.phone !== before.phone) {
      const owner = await tx.volunteer.findUnique({ where: { phone: data.phone }, select: { id: true } });
      if (owner) return { fieldErrors: { phone: "Esse número já é de outra pessoa do cadastro." } };
    }
    const functions = await functionsOfMinistry(tx, membership.ministryId, data.functionIds);
    if (!functions) return { error: "Alguma função escolhida não existe mais. Recarregue a página." };

    await tx.volunteer.update({
      where: { id: before.id },
      data: {
        name: data.name,
        phone: data.phone,
        availability: data.availability,
        sundayShift: data.sundayShift,
        termSigned: data.termSigned,
        ...detailsOf(data),
      },
    });
    await setFunctions(tx, membershipId, data.functionIds);

    const changes: Record<string, unknown> = volunteerChanges(before, data);
    const fromFunctions = membership.functions.map((f) => f.function.name).sort();
    const toFunctions = functions.map((f) => f.name).sort();
    if (JSON.stringify(fromFunctions) !== JSON.stringify(toFunctions)) {
      changes[`funções em ${membership.ministry.name}`] = { from: fromFunctions.join(", ") || "—", to: toFunctions.join(", ") || "—" };
    }
    if (Object.keys(changes).length > 0) {
      await audit(tx, actor, {
        action: "UPDATE",
        entityType: "VOLUNTEER",
        entityId: before.id,
        entityLabel: data.name,
        changes: changes as Prisma.InputJsonValue,
      });
    }
    revalidateRoster();
    return { ok: true, message: "Alterações salvas." };
  });
}

/** Quem só marcou interesse na inscrição entra de vez na equipe. */
export async function promoteVolunteer(membershipId: string): Promise<{ error?: string }> {
  const actor = await getActor();
  return prisma.$transaction(async (tx) => {
    const membership = await tx.volunteerMembership.findUnique({
      where: { id: membershipId },
      select: { status: true, ministryId: true, ministry: { select: { name: true } }, volunteer: { select: { id: true, name: true } } },
    });
    if (!membership) return { error: "Essa pessoa não está mais nesta lista. Recarregue a página." };
    if (!canManage(actor, membership.ministryId)) return { error: NO_PERMISSION };
    if (membership.status === "ACTIVE") return {};

    await tx.volunteerMembership.update({ where: { id: membershipId }, data: { status: "ACTIVE" } });
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "VOLUNTEER",
      entityId: membership.volunteer.id,
      entityLabel: membership.volunteer.name,
      note: `Entrou na equipe de ${membership.ministry.name} (tinha marcado interesse)`,
    });
    revalidateRoster();
    return {};
  });
}

/** Tira a pessoa da equipe deste ministério. O cadastro e os outros ministérios ficam. */
export async function removeFromMinistry(membershipId: string): Promise<{ error?: string }> {
  const actor = await getActor();
  return prisma.$transaction(async (tx) => {
    const membership = await tx.volunteerMembership.findUnique({
      where: { id: membershipId },
      select: { status: true, ministryId: true, ministry: { select: { name: true } }, volunteer: { select: { id: true, name: true } } },
    });
    if (!membership) return {};
    if (!canManage(actor, membership.ministryId)) return { error: NO_PERMISSION };

    await tx.volunteerMembership.delete({ where: { id: membershipId } });
    // Sai também da escala montada desse ministério (só cultos que ainda não passaram).
    await tx.rosterAssignment.deleteMany({
      where: {
        ministryId: membership.ministryId,
        volunteerId: membership.volunteer.id,
        slot: { startsAt: { gt: new Date() } },
      },
    });
    await audit(tx, actor, {
      action: "DELETE",
      entityType: "VOLUNTEER",
      entityId: membership.volunteer.id,
      entityLabel: membership.volunteer.name,
      note:
        membership.status === "ACTIVE"
          ? `Saiu da equipe de ${membership.ministry.name}`
          : `Tirado da lista de interesse de ${membership.ministry.name}`,
    });
    revalidateRoster();
    return {};
  });
}

// ---------------------------------------------------------------------------
// Funções do ministério (Professor(a), Auxiliar, Som…)
// ---------------------------------------------------------------------------

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

export async function createMinistryFunction(ministryId: string, rawName: string): Promise<{ error?: string }> {
  const actor = await getActor();
  if (!canManage(actor, ministryId)) return { error: NO_PERMISSION };
  const parsed = functionNameSchema.safeParse(rawName);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.$transaction(async (tx) => {
      const ministry = await tx.ministry.findUniqueOrThrow({ where: { id: ministryId }, select: { name: true } });
      const last = await tx.ministryFunction.aggregate({ where: { ministryId }, _max: { sortOrder: true } });
      const created = await tx.ministryFunction.create({
        data: { ministryId, name: parsed.data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      });
      await audit(tx, actor, {
        action: "CREATE",
        entityType: "MINISTRY_FUNCTION",
        entityId: created.id,
        entityLabel: `${ministry.name} · ${created.name}`,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Já existe uma função com esse nome." };
    throw error;
  }
  revalidateRoster();
  return {};
}

export async function renameMinistryFunction(functionId: string, rawName: string): Promise<{ error?: string }> {
  const actor = await getActor();
  const parsed = functionNameSchema.safeParse(rawName);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.ministryFunction.findUnique({
        where: { id: functionId },
        include: { ministry: { select: { name: true } } },
      });
      if (!before) return { error: "Essa função não existe mais. Recarregue a página." };
      if (!canManage(actor, before.ministryId)) return { error: NO_PERMISSION };
      if (before.name === parsed.data) return {};

      await tx.ministryFunction.update({ where: { id: functionId }, data: { name: parsed.data } });
      await audit(tx, actor, {
        action: "UPDATE",
        entityType: "MINISTRY_FUNCTION",
        entityId: functionId,
        entityLabel: `${before.ministry.name} · ${parsed.data}`,
        changes: { nome: { from: before.name, to: parsed.data } },
      });
      return {};
    });
    if (result.error) return result;
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Já existe uma função com esse nome." };
    throw error;
  }
  revalidateRoster();
  return {};
}

/** Apaga a função; quem tinha ela continua na equipe, só sem essa função. */
export async function deleteMinistryFunction(functionId: string): Promise<{ error?: string }> {
  const actor = await getActor();
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.ministryFunction.findUnique({
      where: { id: functionId },
      include: { ministry: { select: { name: true } }, _count: { select: { members: true } } },
    });
    if (!before) return {};
    if (!canManage(actor, before.ministryId)) return { error: NO_PERMISSION };

    await tx.ministryFunction.delete({ where: { id: functionId } });
    await audit(tx, actor, {
      action: "DELETE",
      entityType: "MINISTRY_FUNCTION",
      entityId: functionId,
      entityLabel: `${before.ministry.name} · ${before.name}`,
      note: before._count.members > 0 ? `${before._count.members} pessoa(s) tinham essa função` : null,
    });
    return {};
  });
  if (!result.error) revalidateRoster();
  return result;
}

// ---------------------------------------------------------------------------
// Antecedentes (o "olhinho")
// ---------------------------------------------------------------------------

/**
 * O "olhinho" da resposta de antecedentes criminais (campo sensível do
 * formulário de inscrição). O valor nunca vai junto com a página: só chega ao
 * navegador quando o líder do ministério (ou Admin/Mídia) clica, e cada clique fica na Auditoria
 * ("Viu dado sensível"), com quem viu e quando — sem gravar a resposta em si.
 */
export async function revealBackgroundCheck(volunteerId: string): Promise<{ answer: string | null } | { error: string }> {
  const actor = await getActor();

  return prisma.$transaction(async (tx) => {
    const volunteer = await tx.volunteer.findUnique({
      where: { id: volunteerId },
      select: { id: true, name: true, backgroundCheckAnswer: true, memberships: { select: { ministryId: true } } },
    });
    if (!volunteer) return { error: "Voluntário não encontrado." };
    // Líder de um ministério onde a pessoa está (equipe ou interesse), ou Admin/Mídia.
    if (!volunteer.memberships.some((m) => canManageMinistry(actor, m.ministryId)) && !isEditor(actor)) {
      return { error: "Só o líder do ministério dessa pessoa (ou Admin/Mídia) vê essa informação." };
    }

    await audit(tx, actor, {
      action: "VIEW_SENSITIVE",
      entityType: "VOLUNTEER",
      entityId: volunteer.id,
      entityLabel: volunteer.name,
      note: "Abriu a resposta sobre antecedentes criminais",
    });
    return { answer: volunteer.backgroundCheckAnswer };
  });
}
