import { describe, expect, it } from "vitest";
import { buildSlots, describeSlot } from "./roster-period";
import { suggestRoster, type PlanPerson } from "./roster-plan";

const at = (hh: number, mm = 0) => new Date(Date.UTC(1970, 0, 1, hh, mm));
const SERVICES = [
  { id: "dom-manha", name: "Manhã", weekday: 0, startsAt: at(9, 30) },
  { id: "dom-noite", name: "Noite", weekday: 0, startsAt: at(18) },
  { id: "ter", name: "Terça", weekday: 2, startsAt: at(20) },
];
// Dezembro/2026: domingos 6, 13, 20, 27 (2 cultos) + terças 1, 8, 15, 22, 29.
const slots = buildSlots("2026-12", SERVICES).map((s, i) => ({ id: `s${i}`, startsAt: s.startsAt }));
const now = new Date("2026-11-26T12:00:00Z");
const day = (slotId: string) => describeSlot(slots.find((s) => s.id === slotId)!.startsAt).day;

const person = (id: string, opts: Partial<PlanPerson> = {}): PlanPerson => ({
  volunteerId: id,
  functionIds: [],
  answers: new Map(),
  ...opts,
});
const base = { slots, existing: [], elsewhere: [], maxPerWeekday: 2, now };

describe("suggestRoster", () => {
  it("divide igual e respeita o limite de domingos", () => {
    const people = ["a", "b", "c", "d"].map((id) => person(id));
    const { add, missing } = suggestRoster({ ...base, people, needs: [{ functionId: null, count: 1 }] });
    expect(add.length).toBe(slots.length);
    expect(missing).toEqual([]);
    const perPerson = new Map<string, number>();
    for (const a of add) perPerson.set(a.volunteerId, (perPerson.get(a.volunteerId) ?? 0) + 1);
    // 13 cultos, 4 pessoas: ninguém passa de 4.
    expect(Math.max(...perPerson.values()) - Math.min(...perPerson.values())).toBeLessThanOrEqual(1);
    for (const id of perPerson.keys()) {
      const sundays = new Set(add.filter((a) => a.volunteerId === id && day(a.slotId).startsWith("Dom")).map((a) => day(a.slotId)));
      expect(sundays.size).toBeLessThanOrEqual(2);
    }
  });

  it("nunca põe quem disse que não pode; quem marcou vem antes", () => {
    const sunday = slots[1].id; // Dom 06/12 9h30
    const people = [
      person("nao-respondeu"),
      person("nao-pode", { answers: new Map([[sunday, "no"]]) }),
      person("pode", { answers: new Map([[sunday, "yes"]]) }),
    ];
    const { add } = suggestRoster({ ...base, slots: [slots[1]], people, needs: [{ functionId: null, count: 2 }] });
    expect(add.map((a) => a.volunteerId)).toEqual(["pode", "nao-respondeu"]);
  });

  it("não repete a pessoa de manhã e de noite no mesmo domingo", () => {
    const { add, missing } = suggestRoster({
      ...base,
      slots: [slots[1], slots[2]],
      people: [person("a")],
      needs: [{ functionId: null, count: 1 }],
    });
    expect(add.length).toBe(1);
    expect(missing).toEqual([{ slotId: slots[2].id, functionId: null, count: 1 }]);
  });

  it("preenche por função e não usa quem já está em outro ministério no culto", () => {
    const s = slots[1].id;
    const people = [
      person("violao", { functionIds: ["f-violao"] }),
      person("voz1", { functionIds: ["f-voz"] }),
      person("voz2", { functionIds: ["f-voz", "f-violao"] }),
    ];
    const { add, missing } = suggestRoster({
      ...base,
      slots: [slots[1]],
      people,
      elsewhere: [{ slotId: s, volunteerId: "violao" }],
      needs: [
        { functionId: "f-violao", count: 1 },
        { functionId: "f-voz", count: 1 },
      ],
    });
    expect(add).toEqual([
      { slotId: s, volunteerId: "voz2", functionId: "f-violao" },
      { slotId: s, volunteerId: "voz1", functionId: "f-voz" },
    ]);
    expect(missing).toEqual([]);
  });

  it("completa sem mexer no que já está montado nem em culto que passou", () => {
    const later = new Date(slots[3].startsAt.getTime() - 1); // depois de Dom 06/12
    const { add } = suggestRoster({
      ...base,
      now: later,
      slots: slots.slice(0, 5),
      people: [person("a"), person("b")],
      existing: [{ slotId: slots[3].id, volunteerId: "a", functionId: null }],
      needs: [{ functionId: null, count: 1 }],
    });
    // Sobram só s3 (já tem gente) e s4.
    expect(add).toEqual([{ slotId: slots[4].id, volunteerId: "b", functionId: null }]);
  });
});
