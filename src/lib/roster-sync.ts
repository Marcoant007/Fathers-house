import "server-only";

import { revalidatePath } from "next/cache";
import { audit, type Actor } from "@/lib/auth-and-audit";
import { prisma } from "@/lib/prisma";
import { buildSlots, currentMonth, monthLabel, monthRange, planSlotSync, type SlotDraft } from "@/lib/roster-period";

// A lista de cada mês de escala = cultos fixos (Cultos) + eventos publicados do
// mês (Agenda). Fica fora do arquivo de Server Actions de propósito: daqui nada
// é chamável pelo navegador; quem chama já conferiu a permissão.

type Db = Pick<typeof prisma, "service" | "event">;

/** O que deveria estar na lista do mês hoje. */
export async function monthSlotDrafts(month: string, db: Db = prisma): Promise<SlotDraft[]> {
  const range = monthRange(month);
  const [services, events] = await Promise.all([
    db.service.findMany({ select: { id: true, name: true, weekday: true, startsAt: true } }),
    range
      ? db.event.findMany({
          where: { status: "PUBLISHED", startsAt: { gte: range.start, lt: range.end } },
          select: { id: true, title: true, startsAt: true },
        })
      : Promise.resolve([]),
  ]);
  return buildSlots(month, services, events);
}

export type SyncResult = { added: number; removed: number; renamed: number; keptWithMarks: number };

/** Compara a lista do mês com Cultos + Agenda e aplica (só datas que não passaram). */
export async function syncPeriodSlots(periodId: string, actor: Actor, reason: string): Promise<SyncResult | null> {
  const period = await prisma.rosterPeriod.findUnique({
    where: { id: periodId },
    select: {
      month: true,
      slots: {
        select: {
          id: true,
          startsAt: true,
          label: true,
          serviceId: true,
          eventId: true,
          _count: { select: { available: true } },
        },
      },
    },
  });
  if (!period) return null;

  const plan = planSlotSync(
    period.slots.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      label: s.label,
      serviceId: s.serviceId,
      eventId: s.eventId,
      marks: s._count.available,
    })),
    await monthSlotDrafts(period.month)
  );
  const result = {
    added: plan.create.length,
    removed: plan.remove.length,
    renamed: plan.relabel.length,
    keptWithMarks: plan.keptWithMarks,
  };
  if (result.added + result.removed + result.renamed === 0) return result;

  await prisma.$transaction(async (tx) => {
    if (plan.create.length > 0) {
      await tx.rosterSlot.createMany({ data: plan.create.map((d) => ({ ...d, periodId })) });
    }
    if (plan.remove.length > 0) {
      // Confere de novo dentro da transação: só sai o que ninguém marcou.
      await tx.rosterSlot.deleteMany({ where: { id: { in: plan.remove }, available: { none: {} } } });
    }
    for (const r of plan.relabel) {
      await tx.rosterSlot.update({
        where: { id: r.id },
        data: { label: r.label, serviceId: r.serviceId, eventId: r.eventId },
      });
    }
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "ROSTER_PERIOD",
      entityId: periodId,
      entityLabel: `Escala de ${monthLabel(period.month)}`,
      note: `${reason}: ${result.added} novo(s), ${result.removed} removido(s), ${result.renamed} renomeado(s)`,
    });
  });

  revalidatePath("/backstage/escala");
  revalidatePath(`/escala/${period.month}`);
  return result;
}

/**
 * Depois de publicar, mudar ou apagar um evento: atualiza a lista dos meses de
 * escala já abertos que esse evento toca (data antiga e nova). Nunca derruba a
 * ação do evento: se falhar, dá pra usar "Atualizar cultos e eventos do mês".
 */
export async function refreshRosterForDates(actor: Actor, dates: (Date | null | undefined)[]): Promise<void> {
  try {
    const months = [...new Set(dates.filter((d): d is Date => !!d).map((d) => currentMonth(d)))];
    if (months.length === 0) return;
    const periods = await prisma.rosterPeriod.findMany({ where: { month: { in: months } }, select: { id: true } });
    for (const p of periods) await syncPeriodSlots(p.id, actor, "Agenda mudou, lista do mês atualizada");
  } catch (error) {
    console.error("Escala: não deu pra atualizar a lista do mês depois da mudança no evento", error);
  }
}
