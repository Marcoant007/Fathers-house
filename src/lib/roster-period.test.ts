import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildSlots,
  describeSlot,
  isPeriodOpen,
  monthLabel,
  planSlotSync,
  selectableMonths,
  suggestedDeadline,
} from "./roster-period";

// Horário de parede de um Service (coluna time): lido em UTC.
const at = (hh: number, mm = 0) => new Date(Date.UTC(1970, 0, 1, hh, mm));

const SERVICES = [
  { id: "dom-manha", name: "Culto da Manhã", weekday: 0, startsAt: at(9, 30) },
  { id: "dom-noite", name: "Culto da Família", weekday: 0, startsAt: at(18) },
  { id: "ter", name: "Culto de Terça", weekday: 2, startsAt: at(20) },
];

describe("meses", () => {
  it("nome e soma de meses", () => {
    expect(monthLabel("2026-12")).toBe("dezembro de 2026");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
  });

  it("lista o mês atual e os próximos, no horário de Brasília", () => {
    // 1º de dezembro 01h UTC ainda é 30 de novembro em Brasília.
    expect(selectableMonths(new Date("2026-12-01T01:00:00Z"), 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("buildSlots", () => {
  it("gera cada culto em cada data do mês, em ordem", () => {
    const slots = buildSlots("2026-12", SERVICES);
    // Dezembro/2026: domingos 6, 13, 20, 27 (2 cultos cada) + terças 1, 8, 15, 22, 29.
    expect(slots.length).toBe(13);
    expect(describeSlot(slots[0].startsAt)).toEqual({ day: "Ter 01/12", time: "20h", dateKey: "2026-12-01" });
    expect(describeSlot(slots[1].startsAt)).toEqual({ day: "Dom 06/12", time: "9h30", dateKey: "2026-12-06" });
    expect(slots[1].label).toBe("Culto da Manhã");
    expect(slots[2].label).toBe("Culto da Família");
  });

  it("guarda o instante certo (18h de Brasília = 21h UTC)", () => {
    const sunday = buildSlots("2026-12", SERVICES).find((s) => s.serviceId === "dom-noite");
    expect(sunday?.startsAt.toISOString()).toBe("2026-12-06T21:00:00.000Z");
  });

  it("dois cultos no mesmo horário viram um só", () => {
    const dup = [...SERVICES, { id: "outro", name: "Outro", weekday: 2, startsAt: at(20) }];
    expect(buildSlots("2026-12", dup).length).toBe(13);
  });

  it("mês inválido não gera nada", () => {
    expect(buildSlots("2026-13", SERVICES)).toEqual([]);
  });

  it("eventos do mês também entram; evento no horário de um culto fixo fica com o nome do evento", () => {
    const events = [
      // Café com Pastor, segunda 07/12 20h (Brasília) = 23h UTC
      { id: "cafe", title: "Café com Pastor", startsAt: new Date("2026-12-07T23:00:00Z") },
      // Domingo 13/12 18h: Santa Ceia no horário do Culto da Família
      { id: "ceia", title: "Santa Ceia", startsAt: new Date("2026-12-13T21:00:00Z") },
      // Fora do mês: não entra
      { id: "jan", title: "Culto de Jovens", startsAt: new Date("2027-01-09T22:00:00Z") },
    ];
    const slots = buildSlots("2026-12", SERVICES, events);
    expect(slots.length).toBe(14);
    const cafe = slots.find((s) => s.eventId === "cafe");
    expect(cafe?.serviceId).toBe(null);
    expect(describeSlot(cafe!.startsAt)).toEqual({ day: "Seg 07/12", time: "20h", dateKey: "2026-12-07" });
    const ceia = slots.find((s) => s.eventId === "ceia");
    expect(ceia?.serviceId).toBe("dom-noite");
    expect(ceia?.label).toBe("Santa Ceia");
  });
});

describe("suggestedDeadline", () => {
  it("dia 25 do mês anterior quando ainda dá tempo", () => {
    expect(suggestedDeadline("2026-12", new Date("2026-11-10T12:00:00Z"))).toBe("2026-11-25");
  });
  it("se o dia 25 já passou, daqui a 5 dias", () => {
    expect(suggestedDeadline("2026-12", new Date("2026-11-26T12:00:00Z"))).toBe("2026-12-01");
    expect(suggestedDeadline("2027-01", new Date("2026-12-26T12:00:00Z"))).toBe("2026-12-31");
  });
  it("mês que já começou: hoje", () => {
    expect(suggestedDeadline("2026-11", new Date("2026-11-26T12:00:00Z"))).toBe("2026-11-26");
  });
});

describe("isPeriodOpen", () => {
  it("aberto até o prazo", () => {
    const closesAt = new Date("2026-11-26T02:59:59Z");
    expect(isPeriodOpen({ closesAt }, new Date("2026-11-26T02:00:00Z"))).toBe(true);
    expect(isPeriodOpen({ closesAt }, new Date("2026-11-26T03:00:00Z"))).toBe(false);
  });
});

describe("planSlotSync", () => {
  const now = new Date("2026-12-10T12:00:00Z");
  const drafts = buildSlots("2026-12", SERVICES);
  const existingFrom = (list: typeof drafts, marks = 0) =>
    list.map((d, i) => ({ id: `s${i}`, startsAt: d.startsAt, label: d.label, serviceId: d.serviceId, eventId: d.eventId, marks }));

  it("culto novo entra só nas datas que ainda não passaram", () => {
    const withoutMorning = drafts.filter((d) => d.serviceId !== "dom-manha");
    const plan = planSlotSync(existingFrom(withoutMorning), drafts, now);
    // Manhãs de dezembro: 6 (passou), 13, 20, 27.
    expect(plan.create.map((d) => describeSlot(d.startsAt).day)).toEqual(["Dom 13/12", "Dom 20/12", "Dom 27/12"]);
    expect(plan.remove).toEqual([]);
  });

  it("culto que saiu: tira se ninguém marcou, mantém se alguém marcou", () => {
    const withoutTuesday = drafts.filter((d) => d.serviceId !== "ter");
    const futureTuesdays = existingFrom(drafts).filter((s) => s.serviceId === "ter" && s.startsAt > now);
    expect(planSlotSync(existingFrom(drafts), withoutTuesday, now).remove.length).toBe(futureTuesdays.length);
    expect(planSlotSync(existingFrom(drafts, 1), withoutTuesday, now).keptWithMarks).toBe(futureTuesdays.length);
  });

  it("renomeado troca o nome; igual não mexe", () => {
    const renamed = drafts.map((d) => (d.serviceId === "ter" ? { ...d, label: "Terça de Oração" } : d));
    const plan = planSlotSync(existingFrom(drafts), renamed, now);
    expect(plan.relabel.every((r) => r.label === "Terça de Oração")).toBe(true);
    expect(plan.relabel.length).toBe(3); // terças 15, 22, 29
    expect(planSlotSync(existingFrom(drafts), drafts, now)).toEqual({ create: [], remove: [], relabel: [], keptWithMarks: 0 });
  });
});
