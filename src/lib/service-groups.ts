// Cultos fixos (menu Cultos) agrupados pra exibir: o mesmo culto no mesmo dia
// em horários diferentes vira uma entrada só ("Domingo · 9h30 e 18h").
// Puro — testado em service-groups.test.ts.
import { formatServiceTime } from "@/lib/format";
import { fromSaoPauloInput, toSaoPauloInput } from "@/lib/datetime";

type ServiceLike = { id: string; name: string; weekday: number; startsAt: Date; description?: string | null };

export type ServiceGroup = {
  key: string;
  name: string;
  weekday: number;
  times: string[]; // ["9h30", "18h"]
  timesLabel: string; // "9h30 e 18h"
  description: string | null;
};

const minutes = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

/** "9h30", "9h30 e 18h", "9h, 11h e 18h" */
export function joinTimes(times: string[]): string {
  if (times.length <= 1) return times[0] ?? "";
  return `${times.slice(0, -1).join(", ")} e ${times[times.length - 1]}`;
}

/**
 * Agrupa por dia + nome (sem diferenciar maiúscula/espaços). A ordem segue a
 * primeira aparição na lista recebida (respeita a "Ordem" do painel); os
 * horários de cada grupo ficam em ordem crescente.
 */
export function groupServices(services: ServiceLike[]): ServiceGroup[] {
  const groups = new Map<string, { name: string; weekday: number; items: ServiceLike[] }>();
  for (const s of services) {
    const key = `${s.weekday}|${s.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
    const group = groups.get(key);
    if (group) group.items.push(s);
    else groups.set(key, { name: s.name.trim(), weekday: s.weekday, items: [s] });
  }
  return [...groups.entries()].map(([key, g]) => {
    const sorted = [...g.items].sort((a, b) => minutes(a.startsAt) - minutes(b.startsAt));
    const times = sorted.map((s) => formatServiceTime(s.startsAt));
    return {
      key,
      name: g.name,
      weekday: g.weekday,
      times,
      timesLabel: joinTimes(times),
      description: sorted.find((s) => s.description?.trim())?.description?.trim() ?? null,
    };
  });
}

/** Pra Agenda: de domingo a sábado, e no mesmo dia pelo primeiro horário. */
export function sortByWeekday(groups: ServiceGroup[], services: ServiceLike[]): ServiceGroup[] {
  const first = new Map<string, number>();
  for (const g of groups) {
    const ms = services
      .filter((s) => `${s.weekday}|${s.name.trim().toLowerCase().replace(/\s+/g, " ")}` === g.key)
      .map((s) => minutes(s.startsAt));
    first.set(g.key, Math.min(...ms));
  }
  return [...groups].sort((a, b) => a.weekday - b.weekday || first.get(a.key)! - first.get(b.key)!);
}

/**
 * Próxima vez que o culto acontece a partir de `now` (relógio de Brasília).
 * `startsAt` do Service guarda só a hora (UTC = relógio).
 */
export function nextOccurrence(weekday: number, startsAt: Date, now: Date = new Date()): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let offset = 0; offset <= 7; offset++) {
    const ymd = toSaoPauloInput(new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)).slice(0, 10);
    const [y, m, d] = ymd.split("-").map(Number);
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== weekday) continue;
    const at = fromSaoPauloInput(`${ymd}T${pad(startsAt.getUTCHours())}:${pad(startsAt.getUTCMinutes())}`);
    if (at && at.getTime() > now.getTime()) return at;
  }
  // Mesmo dia da semana, mas o horário de hoje já passou: semana que vem.
  return nextOccurrence(weekday, startsAt, new Date(now.getTime() + 24 * 60 * 60 * 1000));
}
