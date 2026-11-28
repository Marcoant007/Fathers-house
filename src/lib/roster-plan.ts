// Sugestão automática da escala (Escala dos Ministérios, parte 3). Função pura,
// testada em roster-plan.test.ts. Nada aqui toca o banco.
//
// Regras:
// - só cultos que ainda não passaram;
// - nunca quem disse que não pode; quem marcou que pode vem antes de quem não respondeu;
// - no máximo `maxPerWeekday` dias por dia da semana no mês (ex.: 2 domingos e 2 terças),
//   contando também o que a pessoa já tem em outros ministérios;
// - a mesma pessoa não pega dois cultos no mesmo dia neste ministério (manhã e noite);
// - não escala quem já está em outro ministério no mesmo culto;
// - entre os que sobram, vai quem serviu menos vezes no mês (divide igual).
import { describeSlot } from "@/lib/roster-period";

export type Answer = "yes" | "no";

export type PlanSlot = { id: string; startsAt: Date };

export type PlanPerson = {
  volunteerId: string;
  functionIds: string[];
  /** slotId → resposta. Ausente = não respondeu sobre esse culto. */
  answers: Map<string, Answer>;
};

/** functionId null = qualquer pessoa da equipe (ministério sem funções). */
export type Need = { functionId: string | null; count: number };

export type PlanAssignment = { slotId: string; volunteerId: string; functionId: string | null };

export type SuggestInput = {
  slots: PlanSlot[];
  people: PlanPerson[];
  needs: Need[];
  /** O que já está montado neste ministério. */
  existing: PlanAssignment[];
  /** Onde a pessoa já serve em outros ministérios (mesmo mês). */
  elsewhere: { slotId: string; volunteerId: string }[];
  maxPerWeekday: number;
  now?: Date;
};

export type SuggestResult = {
  add: PlanAssignment[];
  /** Vagas que ficaram sem ninguém. */
  missing: { slotId: string; functionId: string | null; count: number }[];
};

const weekdayOf = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay();

export function suggestRoster(input: SuggestInput): SuggestResult {
  const now = input.now ?? new Date();
  const slotInfo = new Map(
    input.slots.map((s) => {
      const dateKey = describeSlot(s.startsAt).dateKey;
      return [s.id, { ...s, dateKey, weekday: weekdayOf(dateKey) }];
    })
  );

  // Dias em que cada pessoa já serve (qualquer ministério) e quantas vezes no total.
  const days = new Map<string, Set<string>>(); // volunteerId → dateKeys
  const total = new Map<string, number>();
  const countIn = (volunteerId: string, slotId: string) => {
    const info = slotInfo.get(slotId);
    if (!info) return;
    if (!days.has(volunteerId)) days.set(volunteerId, new Set());
    days.get(volunteerId)!.add(info.dateKey);
    total.set(volunteerId, (total.get(volunteerId) ?? 0) + 1);
  };
  for (const a of input.existing) countIn(a.volunteerId, a.slotId);
  for (const a of input.elsewhere) countIn(a.volunteerId, a.slotId);

  const busyElsewhere = new Set(input.elsewhere.map((a) => `${a.slotId}:${a.volunteerId}`));
  // volunteerId:dateKey já ocupado neste ministério
  const dayHere = new Set<string>();
  const inSlot = new Map<string, PlanAssignment[]>();
  const place = (a: PlanAssignment) => {
    if (!inSlot.has(a.slotId)) inSlot.set(a.slotId, []);
    inSlot.get(a.slotId)!.push(a);
    const info = slotInfo.get(a.slotId);
    if (info) dayHere.add(`${a.volunteerId}:${info.dateKey}`);
  };
  for (const a of input.existing) place(a);

  const weekdayDays = (volunteerId: string, weekday: number) =>
    [...(days.get(volunteerId) ?? [])].filter((d) => weekdayOf(d) === weekday).length;

  const result: SuggestResult = { add: [], missing: [] };
  const ordered = [...slotInfo.values()]
    .filter((s) => s.startsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  for (const slot of ordered) {
    for (const need of input.needs) {
      if (need.count <= 0) continue;
      const here = inSlot.get(slot.id) ?? [];
      const have = here.filter((a) => need.functionId === null || a.functionId === need.functionId).length;
      let remaining = need.count - have;
      if (remaining <= 0) continue;

      const candidates = input.people
        .map((person, index) => ({ person, index }))
        .filter(({ person }) => {
          const id = person.volunteerId;
          if (need.functionId !== null && !person.functionIds.includes(need.functionId)) return false;
          if (person.answers.get(slot.id) === "no") return false;
          if (here.some((a) => a.volunteerId === id)) return false;
          if (busyElsewhere.has(`${slot.id}:${id}`)) return false;
          if (dayHere.has(`${id}:${slot.dateKey}`)) return false;
          const newDay = !days.get(id)?.has(slot.dateKey);
          return !newDay || weekdayDays(id, slot.weekday) < input.maxPerWeekday;
        })
        .sort((a, b) => {
          const ya = a.person.answers.get(slot.id) === "yes" ? 0 : 1;
          const yb = b.person.answers.get(slot.id) === "yes" ? 0 : 1;
          if (ya !== yb) return ya - yb;
          const ta = total.get(a.person.volunteerId) ?? 0;
          const tb = total.get(b.person.volunteerId) ?? 0;
          if (ta !== tb) return ta - tb;
          return a.index - b.index;
        });

      for (const { person } of candidates) {
        if (remaining === 0) break;
        const assignment = { slotId: slot.id, volunteerId: person.volunteerId, functionId: need.functionId };
        place(assignment);
        countIn(person.volunteerId, slot.id);
        result.add.push(assignment);
        remaining -= 1;
      }
      if (remaining > 0) result.missing.push({ slotId: slot.id, functionId: need.functionId, count: remaining });
    }
  }
  return result;
}
