import "server-only";
import { prisma } from "@/lib/prisma";
import { isEditor, type Actor } from "@/lib/auth-and-audit";

/**
 * Ministérios cujas equipes a pessoa pode ver: Admin e Mídia veem todos os que
 * têm voluntários; o líder vê só os ministérios que lidera.
 */
export async function getRosterMinistries(actor: Actor) {
  const ledIds = actor.roles.flatMap((r) => (r.role === "LIDER" && r.ministryId ? [r.ministryId] : []));
  const where = isEditor(actor)
    ? { OR: [{ hasRoster: true }, { memberships: { some: {} } }] }
    : { id: { in: ledIds } };

  return prisma.ministry.findMany({
    where,
    select: {
      id: true,
      name: true,
      icon: true,
      _count: { select: { memberships: { where: { status: "ACTIVE", volunteer: { active: true } } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Equipe de um ministério, com onde mais cada pessoa serve. Quem chama já
 * conferiu que o ministério está em getRosterMinistries(actor). A resposta de
 * antecedentes nunca vem aqui (select explícito + omit global).
 */
export async function getMinistryRoster(ministryId: string) {
  return prisma.volunteerMembership.findMany({
    where: { ministryId, volunteer: { active: true } },
    select: {
      id: true,
      status: true,
      functions: { select: { function: { select: { id: true, name: true, sortOrder: true } } } },
      volunteer: {
        select: {
          id: true,
          name: true,
          phone: true,
          availability: true,
          sundayShift: true,
          termSigned: true,
          birthDay: true,
          birthMonth: true,
          birthYear: true,
          maritalStatus: true,
          city: true,
          baptized: true,
          convertedYear: true,
          memberships: {
            where: { ministryId: { not: ministryId } },
            select: {
              status: true,
              ministry: { select: { name: true } },
              functions: { select: { function: { select: { name: true, sortOrder: true } } } },
            },
            orderBy: { ministry: { name: "asc" } },
          },
        },
      },
    },
    orderBy: { volunteer: { name: "asc" } },
  });
}

export type RosterEntry = Awaited<ReturnType<typeof getMinistryRoster>>[number];

/** Funções do ministério (Professor(a), Auxiliar…) com quantas pessoas têm cada uma. */
export async function getMinistryFunctions(ministryId: string) {
  return prisma.ministryFunction.findMany({
    where: { ministryId },
    select: {
      id: true,
      name: true,
      _count: { select: { members: { where: { membership: { status: "ACTIVE", volunteer: { active: true } } } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
