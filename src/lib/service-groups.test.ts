import { describe, expect, it } from "vitest";
import { groupServices, joinTimes, sortByWeekday } from "./service-groups";

const t = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m));
const services = [
  { id: "1", name: "Culto de Terça", weekday: 2, startsAt: t(20), description: "Meio da semana" },
  { id: "2", name: "Culto de Domingo", weekday: 0, startsAt: t(18), description: null },
  { id: "3", name: "Culto de domingo ", weekday: 0, startsAt: t(9, 30), description: "Dia de família" },
  { id: "4", name: "GFC", weekday: 4, startsAt: t(20) },
];

describe("groupServices", () => {
  it("junta o mesmo culto do mesmo dia e ordena os horários", () => {
    const groups = groupServices(services);
    expect(groups.map((g) => `${g.name} · ${g.timesLabel}`)).toEqual([
      "Culto de Terça · 20h",
      "Culto de Domingo · 9h30 e 18h",
      "GFC · 20h",
    ]);
    expect(groups[1].description).toBe("Dia de família");
    expect(groups[2].description).toBeNull();
  });

  it("na agenda vai de domingo a sábado", () => {
    expect(sortByWeekday(groupServices(services), services).map((g) => g.weekday)).toEqual([0, 2, 4]);
  });

  it("junta horários em português", () => {
    expect(joinTimes(["9h"])).toBe("9h");
    expect(joinTimes(["9h", "11h", "18h"])).toBe("9h, 11h e 18h");
    expect(joinTimes([])).toBe("");
  });
});
