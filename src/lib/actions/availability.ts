"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/volunteer-import";
import { describeSlot, isPeriodOpen } from "@/lib/roster-period";
import type { Prisma } from "@/generated/prisma/client";

// Link público da escala do mês (/escala/AAAA-MM). Sem login: a pessoa se
// identifica pelo WhatsApp. Teste do "link geral" — se não der certo na
// prática, troca-se só findRespondent() por um link individual (token); o
// resto (salvar a resposta) continua igual.
//
// Proteções: só mostra o primeiro nome e os ministérios; limita tentativas com
// número que não está no cadastro (por IP); campo escondido contra robô.

const NOT_FOUND =
  "Não achamos esse número na equipe de voluntários. Confira o número ou fale com o líder do seu ministério.";
const TOO_MANY = "Muitas tentativas com números que não estão no cadastro. Espere uns minutos e tente de novo.";
const CLOSED = "O prazo pra responder a escala deste mês já terminou. Fale com o líder do seu ministério.";

// --- limite de tentativas erradas (em memória: reinicia a cada deploy) ---
const misses = new Map<string, { count: number; resetAt: number }>();
const MAX_MISSES = 8;
const WINDOW_MS = 10 * 60_000;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function isBlocked(ip: string) {
  const entry = misses.get(ip);
  return !!entry && Date.now() < entry.resetAt && entry.count >= MAX_MISSES;
}

function registerMiss(ip: string) {
  const entry = misses.get(ip);
  if (!entry || Date.now() > entry.resetAt) misses.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else entry.count += 1;
}

/**
 * Quem está respondendo. Hoje: pelo WhatsApp. Precisa estar ativo e em pelo
 * menos uma equipe (quem só marcou interesse ainda não é escalado).
 */
async function findRespondent(db: Prisma.TransactionClient | typeof prisma, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  return db.volunteer.findFirst({
    where: { phone, active: true, memberships: { some: { status: "ACTIVE" } } },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: { ministry: { select: { name: true } } },
        orderBy: { ministry: { name: "asc" } },
      },
    },
  });
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

type OpenPeriod = { period: { id: string; closesAt: Date; slots: { id: string }[] } } | { error: string };

async function openPeriod(month: string): Promise<OpenPeriod> {
  const period = await prisma.rosterPeriod.findUnique({
    where: { month },
    select: { id: true, closesAt: true, slots: { select: { id: true } } },
  });
  if (!period) return { error: "Essa escala não existe mais." };
  if (!isPeriodOpen(period)) return { error: CLOSED };
  return { period };
}

export type LookupResult =
  | {
      ok: true;
      firstName: string;
      ministries: string[];
      /** Resposta anterior, pra a pessoa poder mudar. */
      selected: string[];
      note: string;
      answered: boolean;
    }
  | { ok?: false; error: string };

export async function lookupRespondent(month: string, rawPhone: string): Promise<LookupResult> {
  const ip = await clientIp();
  if (isBlocked(ip)) return { error: TOO_MANY };
  if (!normalizePhone(rawPhone)) return { error: "Confira o número, ex.: (27) 99999-0000" };

  const found = await openPeriod(month);
  if ("error" in found) return { error: found.error };

  const volunteer = await findRespondent(prisma, rawPhone);
  if (!volunteer) {
    registerMiss(ip);
    return { error: NOT_FOUND };
  }

  const previous = await prisma.availabilityResponse.findUnique({
    where: { periodId_volunteerId: { periodId: found.period.id, volunteerId: volunteer.id } },
    select: { note: true, slots: { select: { slotId: true } } },
  });

  return {
    ok: true,
    firstName: firstName(volunteer.name),
    ministries: volunteer.memberships.map((m) => m.ministry.name),
    selected: previous?.slots.map((s) => s.slotId) ?? [],
    note: previous?.note ?? "",
    answered: !!previous,
  };
}

export type MyDate = {
  slotId: string;
  startsAt: string; // ISO, pra montar o link da agenda
  day: string; // "Dom 04/01"
  time: string; // "18h"
  label: string; // "Culto da Família"
  ministry: string;
  role: string; // função ("" = sem função)
};

export type MyScheduleResult =
  | {
      ok: true;
      firstName: string;
      dates: MyDate[];
      /** Ministérios da pessoa cuja escala ainda não foi publicada. */
      waiting: string[];
    }
  | { ok?: false; error: string };

/**
 * "Ver minhas datas": depois que o líder publica, a pessoa digita o WhatsApp e
 * vê só as próprias escalações (dos ministérios já publicados). Não mostra o
 * nome de mais ninguém.
 */
export async function lookupMySchedule(month: string, rawPhone: string): Promise<MyScheduleResult> {
  const ip = await clientIp();
  if (isBlocked(ip)) return { error: TOO_MANY };
  if (!normalizePhone(rawPhone)) return { error: "Confira o número, ex.: (27) 99999-0000" };

  const period = await prisma.rosterPeriod.findUnique({
    where: { month },
    select: { id: true, publications: { select: { ministryId: true } } },
  });
  if (!period) return { error: "Essa escala não existe mais." };

  const volunteer = await findRespondent(prisma, rawPhone);
  if (!volunteer) {
    registerMiss(ip);
    return { error: NOT_FOUND };
  }

  const published = new Set(period.publications.map((p) => p.ministryId));
  const [assignments, memberships] = await Promise.all([
    prisma.rosterAssignment.findMany({
      where: { volunteerId: volunteer.id, slot: { periodId: period.id }, ministryId: { in: [...published] } },
      select: {
        slotId: true,
        functionLabel: true,
        function: { select: { name: true } },
        ministry: { select: { name: true } },
        slot: { select: { startsAt: true, label: true } },
      },
      orderBy: { slot: { startsAt: "asc" } },
    }),
    prisma.volunteerMembership.findMany({
      where: { volunteerId: volunteer.id, status: "ACTIVE", ministry: { hasRoster: true } },
      select: { ministryId: true, ministry: { select: { name: true } } },
      orderBy: { ministry: { name: "asc" } },
    }),
  ]);

  return {
    ok: true,
    firstName: firstName(volunteer.name),
    dates: assignments.map((a) => {
      const d = describeSlot(a.slot.startsAt);
      return {
        slotId: a.slotId,
        startsAt: a.slot.startsAt.toISOString(),
        day: d.day,
        time: d.time,
        label: a.slot.label,
        ministry: a.ministry.name,
        role: a.functionLabel ?? a.function?.name ?? "",
      };
    }),
    waiting: memberships.filter((m) => !published.has(m.ministryId)).map((m) => m.ministry.name),
  };
}

const submitSchema = z.object({
  phone: z.string(),
  slotIds: z.array(z.string().uuid()).max(100),
  note: z
    .string()
    .trim()
    .max(300, "O recado pode ter até 300 caracteres.")
    .transform((v) => v || null),
  website: z.string().optional(),
});

export type SubmitResult = { ok: true; firstName: string; count: number } | { ok?: false; error: string };

export async function submitAvailability(month: string, input: z.input<typeof submitSchema>): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const data = parsed.data;
  // Robô preencheu o campo escondido: finge que deu certo e não salva.
  if (data.website) return { ok: true, firstName: "", count: data.slotIds.length };

  const ip = await clientIp();
  if (isBlocked(ip)) return { error: TOO_MANY };

  const found = await openPeriod(month);
  if ("error" in found) return { error: found.error };
  const valid = new Set(found.period.slots.map((s) => s.id));
  const slotIds = Array.from(new Set(data.slotIds)).filter((id) => valid.has(id));

  const result = await prisma.$transaction(async (tx) => {
    const volunteer = await findRespondent(tx, data.phone);
    if (!volunteer) return null;
    const response = await tx.availabilityResponse.upsert({
      where: { periodId_volunteerId: { periodId: found.period.id, volunteerId: volunteer.id } },
      create: { periodId: found.period.id, volunteerId: volunteer.id, note: data.note },
      update: { note: data.note },
    });
    await tx.availabilityResponseSlot.deleteMany({ where: { responseId: response.id } });
    if (slotIds.length > 0) {
      await tx.availabilityResponseSlot.createMany({ data: slotIds.map((slotId) => ({ responseId: response.id, slotId })) });
    }
    return volunteer;
  });

  if (!result) {
    registerMiss(ip);
    return { error: NOT_FOUND };
  }
  revalidatePath("/backstage/escala");
  return { ok: true, firstName: firstName(result.name), count: slotIds.length };
}
