"use server";

import { revalidatePath } from "next/cache";
import { getActor, isEditor, audit } from "@/lib/auth-and-audit";
import { prisma } from "@/lib/prisma";
import { monthLabel, selectableMonths } from "@/lib/roster-period";
import { monthSlotDrafts, syncPeriodSlots, type SyncResult } from "@/lib/roster-sync";
import { closesAtFromDate } from "@/lib/registration-rules";

// Abrir/ajustar o mês de escala (Escala dos Ministérios, parte 2). Admin ou Mídia.
// Os líderes acompanham as respostas em /backstage/escala.

export type RosterPeriodActionState =
  | { ok?: true; month?: string; error?: string; fieldErrors?: Record<string, string> }
  | undefined;

const NO_PERMISSION = "Só o admin ou a Mídia abrem e ajustam a escala do mês.";

const deadlineLabel = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date);

function revalidateEscala(month?: string) {
  revalidatePath("/backstage/escala");
  if (month) revalidatePath(`/escala/${month}`);
}

export async function createRosterPeriod(
  _prev: RosterPeriodActionState,
  formData: FormData
): Promise<RosterPeriodActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };

  const month = String(formData.get("month") ?? "");
  const deadline = String(formData.get("deadline") ?? "");
  if (!selectableMonths().includes(month)) return { fieldErrors: { month: "Escolha um dos meses da lista." } };
  const closesAt = closesAtFromDate(deadline);
  if (!closesAt) return { fieldErrors: { deadline: "Escolha o prazo." } };
  if (closesAt.getTime() < Date.now()) return { fieldErrors: { deadline: "O prazo não pode ser no passado." } };

  const slots = await monthSlotDrafts(month);
  if (slots.length === 0) {
    return { error: "Não há cultos nem eventos nesse mês. Cadastre os horários em Cultos e tente de novo." };
  }

  const exists = await prisma.rosterPeriod.findUnique({ where: { month }, select: { id: true } });
  if (exists) return { fieldErrors: { month: "A escala desse mês já foi aberta." } };

  await prisma.$transaction(async (tx) => {
    const period = await tx.rosterPeriod.create({
      data: { month, closesAt, createdById: actor.id, slots: { createMany: { data: slots } } },
    });
    await audit(tx, actor, {
      action: "CREATE",
      entityType: "ROSTER_PERIOD",
      entityId: period.id,
      entityLabel: `Escala de ${monthLabel(month)}`,
      note: `${slots.length} cultos e eventos · prazo ${deadlineLabel(closesAt)}`,
    });
  });

  revalidateEscala(month);
  return { ok: true, month };
}

export async function updateRosterDeadline(periodId: string, deadline: string): Promise<{ error?: string }> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };
  const closesAt = closesAtFromDate(deadline);
  if (!closesAt) return { error: "Escolha o prazo." };

  const before = await prisma.rosterPeriod.findUnique({ where: { id: periodId } });
  if (!before) return { error: "Essa escala não existe mais." };

  await prisma.$transaction(async (tx) => {
    await tx.rosterPeriod.update({ where: { id: periodId }, data: { closesAt } });
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "ROSTER_PERIOD",
      entityId: periodId,
      entityLabel: `Escala de ${monthLabel(before.month)}`,
      changes: { prazo: { from: deadlineLabel(before.closesAt), to: deadlineLabel(closesAt) } },
    });
  });
  revalidateEscala(before.month);
  return {};
}

/**
 * "Atualizar cultos e eventos do mês": traz pra lista do mês o que mudou em
 * Cultos e na Agenda depois que o mês foi aberto (só datas que ainda não
 * passaram). Quem já respondeu aparece com "?" nos itens novos. Eventos
 * publicados já atualizam sozinhos; o botão é pra quando algo escapou.
 */
export async function syncRosterSlots(periodId: string): Promise<{ error?: string } & Partial<SyncResult>> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };
  const result = await syncPeriodSlots(periodId, actor, "Atualizou os cultos e eventos do mês");
  return result ?? { error: "Essa escala não existe mais." };
}

/** Apaga o mês e todas as respostas dele. */
export async function deleteRosterPeriod(periodId: string): Promise<void> {
  const actor = await getActor();
  if (!isEditor(actor)) throw new Error(NO_PERMISSION);

  const month = await prisma.$transaction(async (tx) => {
    const before = await tx.rosterPeriod.findUnique({
      where: { id: periodId },
      include: { _count: { select: { responses: true } } },
    });
    if (!before) return null;
    await tx.rosterPeriod.delete({ where: { id: periodId } });
    await audit(tx, actor, {
      action: "DELETE",
      entityType: "ROSTER_PERIOD",
      entityId: periodId,
      entityLabel: `Escala de ${monthLabel(before.month)}`,
      note: `${before._count.responses} resposta(s) apagadas junto`,
    });
    return before.month;
  });
  revalidateEscala(month ?? undefined);
}
