// Regras do mês de escala (Escala dos Ministérios, parte 2). Funções puras,
// testadas em roster-period.test.ts. Nada aqui toca o banco.
import { fromSaoPauloInput, toSaoPauloInput } from "@/lib/datetime";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-12" → "dezembro" */
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

/** "2026-12" → "dezembro de 2026" */
export function monthLabel(month: string): string {
  return `${monthName(month)} de ${month.slice(0, 4)}`;
}

/** Mês de hoje no horário de Brasília: "2026-11". */
export function currentMonth(now: Date = new Date()): string {
  return toSaoPauloInput(now).slice(0, 7);
}

/** "2026-12", 1 → "2027-01" */
export function addMonths(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const year = y + Math.floor(m / 12);
  const mon = ((m % 12) + 12) % 12;
  return `${year}-${pad(mon + 1)}`;
}

/** Meses que dá pra abrir: o atual e os próximos (padrão: 4 no total). */
export function selectableMonths(now: Date = new Date(), count = 4): string[] {
  const first = currentMonth(now);
  return Array.from({ length: count }, (_, i) => addMonths(first, i));
}

type WeeklyService = { id: string; name: string; weekday: number; startsAt: Date };
type MonthEvent = { id: string; title: string; startsAt: Date };

export type SlotDraft = { serviceId: string | null; eventId: string | null; label: string; startsAt: Date };

/** Início e fim do mês no horário de Brasília (pra buscar os eventos do mês). */
export function monthRange(month: string): { start: Date; end: Date } | null {
  if (!MONTH_RE.test(month)) return null;
  const start = fromSaoPauloInput(`${month}-01T00:00`);
  const end = fromSaoPauloInput(`${addMonths(month, 1)}-01T00:00`);
  return start && end ? { start, end } : null;
}

/**
 * A lista do mês: cada culto semanal em cada data (horário de Brasília) e cada
 * evento do mês (Culto de Jovens, Café com Pastor…). `Service.startsAt` é
 * horário de parede (coluna time): lido em UTC, sem fuso. Dois itens no mesmo
 * horário viram um só; um evento no horário de um culto fixo (domingo especial)
 * fica com o nome do evento.
 */
export function buildSlots(month: string, services: WeeklyService[], events: MonthEvent[] = []): SlotDraft[] {
  if (!MONTH_RE.test(month)) return [];
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();

  const slots: SlotDraft[] = [];
  const seen = new Set<number>();
  for (let day = 1; day <= days; day++) {
    const weekday = new Date(Date.UTC(year, mon - 1, day)).getUTCDay();
    for (const service of services) {
      if (service.weekday !== weekday) continue;
      const time = `${pad(service.startsAt.getUTCHours())}:${pad(service.startsAt.getUTCMinutes())}`;
      const startsAt = fromSaoPauloInput(`${month}-${pad(day)}T${time}`);
      if (!startsAt || seen.has(startsAt.getTime())) continue;
      seen.add(startsAt.getTime());
      slots.push({ serviceId: service.id, eventId: null, label: service.name, startsAt });
    }
  }

  const range = monthRange(month);
  const ordered = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const event of ordered) {
    if (!range || event.startsAt < range.start || event.startsAt >= range.end) continue;
    const same = slots.find((s) => s.startsAt.getTime() === event.startsAt.getTime());
    if (same) {
      if (same.eventId) continue; // dois eventos no mesmo horário: fica o primeiro
      same.eventId = event.id;
      same.label = event.title;
    } else {
      slots.push({ serviceId: null, eventId: event.id, label: event.title, startsAt: event.startsAt });
    }
  }
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Prazo sugerido ("AAAA-MM-DD"): dia 25 do mês anterior. Se esse dia já
 * passou, daqui a 5 dias — mas nunca depois do dia 1 do próprio mês.
 */
export function suggestedDeadline(month: string, now: Date = new Date()): string {
  const previous = addMonths(month, -1);
  const preferred = `${previous}-25`;
  const today = toSaoPauloInput(now).slice(0, 10);
  if (preferred > today) return preferred;

  const inFive = toSaoPauloInput(new Date(now.getTime() + 5 * 86_400_000)).slice(0, 10);
  const firstDay = `${month}-01`;
  if (inFive < firstDay) return inFive;
  return today > firstDay ? today : firstDay;
}

/** Ainda dá pra responder? */
export function isPeriodOpen(period: { closesAt: Date }, now: Date = new Date()): boolean {
  return now.getTime() <= period.closesAt.getTime();
}

const slotFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date → { day: "Dom 07/12", time: "18h", dateKey: "2026-12-07" } */
export function describeSlot(startsAt: Date) {
  const parts = slotFormatter.formatToParts(startsAt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday").replace(".", "");
  const [hour, minute] = timeFormatter.format(startsAt).split(":");
  return {
    day: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${get("day")}/${get("month")}`,
    time: minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`,
    dateKey: toSaoPauloInput(startsAt).slice(0, 10),
  };
}

export type ExistingSlot = {
  id: string;
  startsAt: Date;
  label: string;
  serviceId: string | null;
  eventId: string | null;
  marks: number;
};

export type SlotSyncPlan = {
  create: SlotDraft[];
  remove: string[];
  relabel: { id: string; label: string; serviceId: string | null; eventId: string | null }[];
  /** Saíram de Cultos, mas alguém já marcou: ficam (avisamos). */
  keptWithMarks: number;
};

/**
 * "Atualizar cultos e eventos do mês": compara a lista do mês com o que está em
 * Cultos e na Agenda hoje. Só mexe em datas que ainda não passaram. Item novo
 * entra; o que saiu (ou mudou de horário) sai se ninguém marcou; renomeado troca o nome.
 */
export function planSlotSync(existing: ExistingSlot[], drafts: SlotDraft[], now: Date = new Date()): SlotSyncPlan {
  const future = (d: Date) => d.getTime() > now.getTime();
  const byTime = new Map(existing.map((s) => [s.startsAt.getTime(), s]));
  const draftTimes = new Set(drafts.map((d) => d.startsAt.getTime()));

  const plan: SlotSyncPlan = { create: [], remove: [], relabel: [], keptWithMarks: 0 };
  for (const draft of drafts) {
    if (!future(draft.startsAt)) continue;
    const current = byTime.get(draft.startsAt.getTime());
    if (!current) plan.create.push(draft);
    else if (
      current.label !== draft.label ||
      current.serviceId !== draft.serviceId ||
      current.eventId !== draft.eventId
    ) {
      plan.relabel.push({ id: current.id, label: draft.label, serviceId: draft.serviceId, eventId: draft.eventId });
    }
  }
  for (const slot of existing) {
    if (!future(slot.startsAt) || draftTimes.has(slot.startsAt.getTime())) continue;
    if (slot.marks === 0) plan.remove.push(slot.id);
    else plan.keptWithMarks += 1;
  }
  return plan;
}
