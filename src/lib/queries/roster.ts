import "server-only";
import { prisma } from "@/lib/prisma";

/** Meses de escala abertos, do mais novo pro mais antigo. */
export async function getRosterPeriods() {
  return prisma.rosterPeriod.findMany({
    select: { id: true, month: true, closesAt: true, _count: { select: { responses: true, slots: true } } },
    orderBy: { month: "desc" },
  });
}

export async function getRosterSlots(periodId: string) {
  return prisma.rosterSlot.findMany({
    where: { periodId },
    select: { id: true, label: true, startsAt: true, createdAt: true, eventId: true },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Quadro de respostas de uma equipe: cada pessoa da equipe e o que ela marcou
 * no mês (ou nada, se não respondeu). Quem chama já conferiu o acesso ao ministério.
 */
export async function getTeamAvailability(periodId: string, ministryId: string) {
  return prisma.volunteerMembership.findMany({
    where: { ministryId, status: "ACTIVE", volunteer: { active: true } },
    select: {
      id: true,
      functions: { select: { function: { select: { id: true, name: true, sortOrder: true } } } },
      volunteer: {
        select: {
          id: true,
          name: true,
          availabilityResponses: {
            where: { periodId },
            select: { note: true, updatedAt: true, slots: { select: { slotId: true } } },
          },
        },
      },
    },
    orderBy: { volunteer: { name: "asc" } },
  });
}

/**
 * Escala montada (prévia) de um ministério no mês: o que já está escalado aqui,
 * onde a equipe já serve em outros ministérios, e quantas pessoas cada culto precisa.
 * Quem chama já conferiu o acesso ao ministério.
 */
export async function getRosterPlan(periodId: string, ministryId: string) {
  const [ministry, assignments, skips, publication] = await Promise.all([
    prisma.ministry.findUniqueOrThrow({
      where: { id: ministryId },
      select: {
        rosterPerService: true,
        functions: {
          select: { id: true, name: true, perService: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    }),
    prisma.rosterAssignment.findMany({
      where: {
        slot: { periodId },
        volunteer: { memberships: { some: { ministryId, status: "ACTIVE" } } },
      },
      select: {
        id: true,
        slotId: true,
        ministryId: true,
        volunteerId: true,
        functionId: true,
        functionLabel: true,
        function: { select: { name: true } },
        ministry: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rosterSlotSkip.findMany({ where: { ministryId, slot: { periodId } }, select: { slotId: true } }),
    prisma.rosterPublication.findUnique({
      where: { periodId_ministryId: { periodId, ministryId } },
      select: { publishedAt: true, publishedBy: { select: { name: true } } },
    }),
  ]);
  return {
    perService: ministry.rosterPerService,
    functions: ministry.functions,
    here: assignments.filter((a) => a.ministryId === ministryId),
    elsewhere: assignments.filter((a) => a.ministryId !== ministryId),
    /** Dias em que o ministério marcou que não serve. */
    skipped: skips.map((s) => s.slotId),
    /** Publicada = a equipe vê as próprias datas no link do mês. */
    publication,
  };
}
