// Inscrições em evento — acesso ao banco (FA-29 a FA-33).
// Quem vê inscritos: mídia/admin, e o líder do ministério do evento.
import "server-only";
import { prisma } from "@/lib/prisma";
import { getActor, hasRole, isEditor, type Actor } from "@/lib/auth-and-audit";
import { isPanelVerified } from "@/lib/panel-gate";
import { purgeCutoff } from "@/lib/registration-rules";
import type { Prisma } from "@/generated/prisma/client";

/** Pode ver/gerenciar os inscritos de um evento deste ministério? */
export function canSeeRegistrations(actor: Actor, ministryId: string | null): boolean {
  if (isEditor(actor)) return true;
  return ministryId !== null && hasRole(actor, "LIDER", ministryId);
}

/** Filtro de eventos cujos inscritos a pessoa pode ver. */
export function visibleEventsWhere(actor: Actor): Prisma.EventWhereInput {
  if (isEditor(actor)) return {};
  const ministryIds = actor.roles.filter((r) => r.role === "LIDER" && r.ministryId).map((r) => r.ministryId!);
  return { ministryId: { in: ministryIds } };
}

/** Pessoas já confirmadas (soma de partySize) — é isso que as vagas contam. */
export async function takenSpots(eventId: string, tx: Prisma.TransactionClient = prisma): Promise<number> {
  const result = await tx.eventRegistration.aggregate({
    where: { eventId, status: "CONFIRMED" },
    _sum: { partySize: true },
  });
  return result._sum.partySize ?? 0;
}

/**
 * LGPD: apaga inscrições de eventos que terminaram há mais de 90 dias.
 * Sem cron: roda sempre que alguém abre as telas de inscrição ou exporta.
 * Barato (índice + poucas linhas) e garante que o dado nunca é mostrado depois do prazo.
 */
export async function purgeExpiredRegistrations(now: Date = new Date()) {
  return prisma.eventRegistration.deleteMany({ where: { event: { endsAt: { lt: purgeCutoff(now) } } } });
}

/** Quantas inscrições a equipe ainda não viu (badge "Inscrições" no menu). */
export async function countNewRegistrations(actor: Actor): Promise<number> {
  if (!isEditor(actor) && !actor.roles.some((r) => r.role === "LIDER")) return 0;
  return prisma.eventRegistration.count({
    where: { seenAt: null, status: "CONFIRMED", event: visibleEventsWhere(actor) },
  });
}

/** Eventos com formulário do site num mês ("2026-11"), com os números de cada um. */
export async function getRegistrationEventsForMonth(actor: Actor, month: string) {
  const start = new Date(`${month}-01T00:00:00-03:00`);
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const end = new Date(`${next}-01T00:00:00-03:00`);

  const events = await prisma.event.findMany({
    where: {
      ...visibleEventsWhere(actor),
      registrationMode: "INTERNAL",
      startsAt: { gte: start, lt: end },
    },
    orderBy: { startsAt: "asc" },
    include: { ministry: true },
  });

  const stats = await prisma.eventRegistration.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, status: "CONFIRMED" },
    _count: { _all: true },
    _sum: { partySize: true },
  });
  const unseen = await prisma.eventRegistration.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, status: "CONFIRMED", seenAt: null },
    _count: { _all: true },
  });

  return events.map((event) => {
    const s = stats.find((x) => x.eventId === event.id);
    return {
      event,
      registrations: s?._count._all ?? 0,
      people: s?._sum.partySize ?? 0,
      unseen: unseen.find((x) => x.eventId === event.id)?._count._all ?? 0,
    };
  });
}

/** Inscritos de um evento, pra lista do painel e pra planilha. */
export async function getEventRegistrations(eventId: string) {
  return prisma.eventRegistration.findMany({
    where: { eventId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function markRegistrationsSeen(eventId: string) {
  await prisma.eventRegistration.updateMany({ where: { eventId, seenAt: null }, data: { seenAt: new Date() } });
}

/**
 * Route Handlers não passam pelo layout do painel (login + token de acesso),
 * então checam aqui. null = sem acesso.
 */
export async function getPanelActorForRoute(): Promise<Actor | null> {
  try {
    const actor = await getActor();
    return (await isPanelVerified(actor.id)) ? actor : null;
  } catch {
    return null;
  }
}

/** "2026-11" → "Novembro de 2026" */
export function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T12:00:00Z`)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Mês atual em São Paulo, "2026-11". */
export function currentMonth(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
}

export function isMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
