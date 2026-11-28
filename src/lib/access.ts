// Regras de papel e diff, sem nada de servidor (Clerk, headers, Prisma), pra
// poderem ser testadas sozinhas. src/lib/auth-and-audit.ts reexporta tudo.
import type { Role } from "@/generated/prisma/client";

/** O que as regras precisam saber da pessoa: os papéis (e o ministério de cada um). */
export type RoleHolder = {
  roles: { role: Role; ministryId: string | null; ministry?: { name: string } | null }[];
};

/** ADMIN passa em tudo; LIDER com ministryId só vale pra aquele ministério. */
export const hasRole = (actor: RoleHolder, role: Role, ministryId?: string | null) =>
  actor.roles.some((r) => r.role === "ADMIN") ||
  actor.roles.some((r) => r.role === role && (ministryId === undefined || r.ministryId === ministryId));

export const isEditor = (actor: RoleHolder) => hasRole(actor, "MIDIA");

/** Líder de pelo menos um ministério. */
export const isLeader = (actor: RoleHolder) => actor.roles.some((r) => r.role === "LIDER" && !!r.ministryId);

/**
 * Mexe na equipe/escala/voluntários de um ministério: o líder dele, e Mídia/Admin
 * em todos (Mídia e Admin quase não têm diferença — só Equipe é exclusivo do Admin).
 */
export const canManageMinistry = (actor: RoleHolder, ministryId: string) =>
  isEditor(actor) || hasRole(actor, "LIDER", ministryId);

/** Cria eventos e avisos: Mídia/Admin publicam; líder manda pra aprovação. Sem papel, nada. */
export const canWriteContent = (actor: RoleHolder) => isEditor(actor) || isLeader(actor);

export const ROLE_LABELS: Record<Role, string> = { ADMIN: "Admin", MIDIA: "Mídia", LIDER: "Líder" };

const ROLE_ORDER: Record<Role, number> = { ADMIN: 0, MIDIA: 1, LIDER: 2 };

/**
 * "Mídia · Líder (Kids) · Líder (Mídia)" ou "Sem papel atribuído". Vai na
 * Sidebar e é copiado em cada linha da Auditoria (actorRoles).
 */
export function describeRoles(actor: RoleHolder): string {
  if (actor.roles.length === 0) return "Sem papel atribuído";
  const labels = [...actor.roles]
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.ministry?.name ?? "").localeCompare(b.ministry?.name ?? "", "pt-BR")
    )
    .map((r) => (r.role === "LIDER" ? `${ROLE_LABELS.LIDER} (${r.ministry?.name ?? "sem ministério"})` : ROLE_LABELS[r.role]));
  return Array.from(new Set(labels)).join(" · ");
}

/** Diferença campo a campo entre antes e depois, para o UPDATE. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (["updatedAt", "updatedById"].includes(key)) continue;
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
  }
  return changes;
}
