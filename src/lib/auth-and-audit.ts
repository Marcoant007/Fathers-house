// src/lib/auth-and-audit.ts
// Permissões (papéis do banco) + auditoria para as Server Actions.
// Login: Clerk. Papéis e histórico: Postgres via Prisma.
import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AuditAction, AuditEntity, Prisma, Role } from "@/generated/prisma/client";
import { describeRoles, diff, hasRole, isEditor } from "@/lib/access";

// Regras puras ficam em access.ts (testáveis); reexportadas pra quem já importa daqui.
export { canManageMinistry, canWriteContent, describeRoles, diff, hasRole, isEditor, isLeader, ROLE_LABELS } from "@/lib/access";

export type Actor = Awaited<ReturnType<typeof getActor>>;

// Papéis com o nome do ministério, pra mostrar "Líder (Kids)" e não só "Líder".
const ROLES_INCLUDE = { roles: { include: { ministry: { select: { name: true } } } } } as const;

/** Pessoa logada + papéis. Cria o StaffMember no primeiro acesso, se o webhook ainda não criou. */
export async function getActor() {
  const { userId } = await auth();
  if (!userId) throw new Error("Não autenticado");

  let member = await prisma.staffMember.findUnique({
    where: { clerkUserId: userId },
    include: ROLES_INCLUDE,
  });

  if (!member) {
    const u = await currentUser();
    member = await prisma.staffMember.create({
      data: {
        clerkUserId: userId,
        name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "Sem nome",
        email: u?.primaryEmailAddress?.emailAddress ?? `${userId}@sem-email`,
        imageUrl: u?.imageUrl,
      },
      include: ROLES_INCLUDE,
    });
  }
  if (!member.active) throw new Error("Acesso desativado");
  return member;
}

/** Lança erro se a pessoa não tiver nenhum dos papéis pedidos. */
export async function requireRole(...roles: Role[]) {
  const actor = await getActor();
  if (!roles.some((r) => hasRole(actor, r))) throw new Error("Sem permissão");
  return actor;
}

type AuditInput = {
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  entityLabel?: string | null;
  changes?: Prisma.InputJsonValue;
  note?: string | null;
};

/** Grava a auditoria DENTRO da mesma transação da alteração. */
export async function audit(tx: Prisma.TransactionClient, actor: Actor, input: AuditInput) {
  const h = await headers();
  await tx.auditLog.create({
    data: {
      ...input,
      actorId: actor.id,
      actorClerkId: actor.clerkUserId,
      actorName: actor.name,
      actorRoles: describeRoles(actor),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    },
  });
}

// ---------------------------------------------------------------------
// Exemplo de uso numa Server Action
// ---------------------------------------------------------------------
export async function updateEventExample(id: string, data: Prisma.EventUpdateInput & { title?: string }) {
  const actor = await getActor();

  return prisma.$transaction(async (tx) => {
    const before = await tx.event.findUniqueOrThrow({ where: { id } });

    const canEdit =
      isEditor(actor) ||
      (hasRole(actor, "LIDER", before.ministryId) && before.createdById === actor.id && before.status !== "PUBLISHED");
    if (!canEdit) throw new Error("Sem permissão para editar este evento");
    if (!isEditor(actor) && data.status === "PUBLISHED") throw new Error("Líder envia para aprovação, não publica");

    const after = await tx.event.update({
      where: { id },
      data: { ...data, updatedBy: { connect: { id: actor.id } } },
    });

    await audit(tx, actor, {
      action: before.status !== "PUBLISHED" && after.status === "PUBLISHED" ? "PUBLISH" : "UPDATE",
      entityType: "EVENT",
      entityId: id,
      entityLabel: after.title,
      changes: diff(before, after) as Prisma.InputJsonValue,
    });

    return after;
  });
}
