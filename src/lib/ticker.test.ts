import { describe, expect, it } from "vitest";
import { buildTicker } from "./ticker";
import { nextOccurrence } from "./service-groups";

const t = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m));
const at = (iso: string) => new Date(iso);
// Quarta 25/11/2026, 15h em Brasília
const NOW = at("2026-11-25T18:00:00Z");

const services = [
  { id: "s1", name: "Culto da Família", weekday: 0, startsAt: t(18) },
  { id: "s2", name: "Culto da Família", weekday: 0, startsAt: t(9, 30) },
  { id: "s3", name: "Culto de Terça", weekday: 2, startsAt: t(20) },
  { id: "s4", name: "GFC", weekday: 4, startsAt: t(20) },
];
const events = [
  { id: "e1", title: "Café com o Pastor", slug: "cafe", startsAt: at("2026-11-27T23:00:00Z"), endsAt: at("2026-11-28T01:00:00Z") },
  { id: "e2", title: "Já passou", slug: "x", startsAt: at("2026-11-20T23:00:00Z"), endsAt: at("2026-11-21T01:00:00Z") },
  { id: "e3", title: "Muito longe", slug: "y", startsAt: at("2027-03-01T23:00:00Z"), endsAt: at("2027-03-02T01:00:00Z") },
];
const notices = [{ id: "n1", title: "Mutirão", category: { name: "Comunidade" } }, { id: "n2", title: "Retiro", category: null }];

describe("nextOccurrence", () => {
  it("acha o próximo dia/hora em Brasília", () => {
    expect(nextOccurrence(4, t(20), NOW).toISOString()).toBe("2026-11-26T23:00:00.000Z"); // qui 26/11 20h
    expect(nextOccurrence(3, t(20), NOW).toISOString()).toBe("2026-11-25T23:00:00.000Z"); // hoje 20h
    expect(nextOccurrence(3, t(9), NOW).toISOString()).toBe("2026-12-02T12:00:00.000Z"); // hoje 9h já foi
  });
});

describe("buildTicker", () => {
  it("mistura cultos e eventos por data e põe os avisos no fim", () => {
    const items = buildTicker({ services, events, notices }, NOW);
    expect(items.map((i) => `${i.kind}: ${i.title} · ${i.meta}`)).toEqual([
      "culto: GFC · Toda quinta · 20h",
      "evento: Café com o Pastor · sex 27/11, 20h",
      "culto: Culto da Família · Todo domingo · 9h30 e 18h",
      "culto: Culto de Terça · Toda terça · 20h",
      "aviso: Mutirão · Comunidade",
      "aviso: Retiro · Aviso",
    ]);
    expect(items[1].href).toBe("/agenda/cafe");
  });

  it("evento em andamento aparece como acontecendo agora", () => {
    const now = at("2026-11-27T23:30:00Z");
    const items = buildTicker({ services: [], events, notices: [] }, now);
    expect(items.map((i) => i.meta)).toEqual(["Acontecendo agora"]);
  });
});
