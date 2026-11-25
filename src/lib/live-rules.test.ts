import { describe, expect, it } from "vitest";
import { isSpotifyUrl, isYoutubeUrl, liveStatus, pickFeaturedLive, serviceSlots } from "./live-rules";

// Domingo 23/11/2026 18h em Brasília = 21h UTC
const at = (iso: string) => new Date(iso);
const live = (id: string, iso: string, visible = true) => ({ id, startsAt: at(iso), visible });

describe("liveStatus", () => {
  const l = live("a", "2026-11-23T21:00:00Z");
  it("ao vivo do início até 3h depois", () => {
    expect(liveStatus(l, at("2026-11-23T21:00:00Z"))).toBe("ao-vivo");
    expect(liveStatus(l, at("2026-11-23T23:59:00Z"))).toBe("ao-vivo");
    expect(liveStatus(l, at("2026-11-24T00:00:00Z"))).toBe("gravada");
  });
  it("em breve nas 24h antes; agendada antes disso", () => {
    expect(liveStatus(l, at("2026-11-23T10:00:00Z"))).toBe("em-breve");
    expect(liveStatus(l, at("2026-11-22T20:00:00Z"))).toBe("agendada");
  });
});

describe("pickFeaturedLive", () => {
  const lastSunday = live("passada", "2026-11-23T21:00:00Z");
  const older = live("antiga", "2026-11-16T21:00:00Z");
  const nextSunday = live("proxima", "2026-11-30T21:00:00Z");
  const ids = (x: { id: string } | null) => x?.id ?? null;

  it("no meio da semana mostra a última que aconteceu, não a agendada", () => {
    expect(ids(pickFeaturedLive([older, nextSunday, lastSunday], at("2026-11-26T15:00:00Z")))).toBe("passada");
  });
  it("no dia (menos de 24h antes) já mostra a próxima", () => {
    expect(ids(pickFeaturedLive([older, nextSunday, lastSunday], at("2026-11-30T12:00:00Z")))).toBe("proxima");
  });
  it("durante a live mostra ela", () => {
    expect(ids(pickFeaturedLive([older, nextSunday, lastSunday], at("2026-11-23T22:00:00Z")))).toBe("passada");
  });
  it("ignora as ocultas e, se só houver futuras, mostra a mais próxima", () => {
    const hidden = live("oculta", "2026-11-25T21:00:00Z", false);
    expect(ids(pickFeaturedLive([hidden, lastSunday], at("2026-11-25T22:00:00Z")))).toBe("passada");
    const far = live("longe", "2026-12-14T21:00:00Z");
    expect(ids(pickFeaturedLive([far, nextSunday], at("2026-11-25T12:00:00Z")))).toBe("proxima");
    expect(pickFeaturedLive([], at("2026-11-25T12:00:00Z"))).toBeNull();
  });
});

describe("links", () => {
  it("reconhece YouTube e Spotify", () => {
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYoutubeUrl("https://youtu.be/abc")).toBe(true);
    expect(isYoutubeUrl("https://m.youtube.com/live/abc")).toBe(true);
    expect(isYoutubeUrl("https://vimeo.com/1")).toBe(false);
    expect(isSpotifyUrl("https://open.spotify.com/episode/xyz")).toBe(true);
    expect(isSpotifyUrl("https://youtube.com/x")).toBe(false);
    expect(isSpotifyUrl("não é link")).toBe(false);
  });
});

describe("serviceSlots", () => {
  const time = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m));
  const services = [
    { name: "Culto da Manhã", weekday: 0, startsAt: time(9, 30) },
    { name: "Culto da Família", weekday: 0, startsAt: time(18) },
    { name: "Culto de Terça", weekday: 2, startsAt: time(20) },
  ];

  it("lista os cultos perto de hoje com data de Brasília", () => {
    // Quarta 25/11/2026, 15h em Brasília
    const slots = serviceSlots(services, at("2026-11-25T18:00:00Z"));
    expect(slots.map((s) => s.label)).toEqual([
      "Dom 22/11 · 9h30 · Culto da Manhã",
      "Dom 22/11 · 18h · Culto da Família",
      "Ter 24/11 · 20h · Culto de Terça",
      "Dom 29/11 · 9h30 · Culto da Manhã",
      "Dom 29/11 · 18h · Culto da Família",
      "Ter 01/12 · 20h · Culto de Terça",
    ]);
    expect(slots[4]).toMatchObject({ title: "Culto da Família", startsAtInput: "2026-11-29T18:00" });
  });

  it("perto da meia-noite usa o dia de Brasília, não o UTC", () => {
    // Terça 24/11 22h em Brasília = quarta 01h UTC
    const slots = serviceSlots(services, at("2026-11-25T01:00:00Z"), { daysBack: 0, daysAhead: 0 });
    expect(slots.map((s) => s.startsAtInput)).toEqual(["2026-11-24T20:00"]);
  });
});
