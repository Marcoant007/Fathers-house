import { describe, expect, it } from "vitest";
import { fromSaoPauloInput, parseSaoPauloInput, toSaoPauloInput } from "./datetime";
import { eventSchema } from "./schemas/event";
import { announcementSchema } from "./schemas/announcement";
import { liveStreamSchema } from "./schemas/live";

describe("datetime-local em horário de Brasília", () => {
  it("20h digitado é 23h UTC, em qualquer fuso de servidor", () => {
    expect(fromSaoPauloInput("2026-11-27T20:00")?.toISOString()).toBe("2026-11-27T23:00:00.000Z");
    expect(fromSaoPauloInput("2026-11-27T22:30:15")?.toISOString()).toBe("2026-11-28T01:30:15.000Z");
  });

  it("ida e volta dá o mesmo valor no campo", () => {
    const date = fromSaoPauloInput("2026-11-27T20:00")!;
    expect(toSaoPauloInput(date)).toBe("2026-11-27T20:00");
    expect(toSaoPauloInput(new Date("2026-11-28T02:59:00Z"))).toBe("2026-11-27T23:59");
  });

  it("vazio, inválido ou com fuso explícito", () => {
    expect(toSaoPauloInput(null)).toBe("");
    expect(fromSaoPauloInput("27/11/2026 20:00")).toBeNull();
    expect(parseSaoPauloInput("2026-11-27T20:00:00-03:00")).toBe("2026-11-27T20:00:00-03:00");
  });
});

describe("schemas leem o campo como horário de Brasília", () => {
  it("evento", () => {
    const r = eventSchema.safeParse({ title: "Café com o Pastor", startsAt: "2026-11-27T20:00", endsAt: "2026-11-27T22:00" });
    expect(r.success && r.data.startsAt.toISOString()).toBe("2026-11-27T23:00:00.000Z");
    expect(r.success && r.data.endsAt.toISOString()).toBe("2026-11-28T01:00:00.000Z");
  });

  it("aviso", () => {
    const r = announcementSchema.safeParse({ title: "Aviso", publishAt: "2026-11-25T08:00", unpublishAt: "2026-11-30T23:59" });
    expect(r.success && r.data.publishAt.toISOString()).toBe("2026-11-25T11:00:00.000Z");
    expect(r.success && r.data.unpublishAt?.toISOString()).toBe("2026-12-01T02:59:00.000Z");
  });

  it("live (menu Live)", () => {
    const r = liveStreamSchema.safeParse({
      title: "Culto da Família",
      startsAt: "2026-11-29T18:00",
      youtubeUrl: "https://youtu.be/abc",
      spotifyUrl: "",
      description: "",
      visible: true,
    });
    expect(r.success && r.data.startsAt.toISOString()).toBe("2026-11-29T21:00:00.000Z");
  });
});
