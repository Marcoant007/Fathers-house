import { describe, expect, it } from "vitest";
import {
  closesAtFromDate,
  countByFilter,
  filterRegistrations,
  isRegistrationFilter,
  dateInputFromClosesAt,
  formatPhone,
  normalizePhone,
  registrationHref,
  registrationState,
  spotsLeft,
} from "./registration-rules";
import { registrationSchema } from "./schemas/registration";
import { eventSchema } from "./schemas/event";

describe("normalizePhone / formatPhone", () => {
  it("aceita celular com DDD, com ou sem +55 e máscara", () => {
    expect(normalizePhone("(27) 99999-0000")).toBe("5527999990000");
    expect(normalizePhone("+55 27 99999-0000")).toBe("5527999990000");
    expect(normalizePhone("27 3333-4444")).toBe("552733334444");
  });

  it("recusa sem DDD ou estrangeiro", () => {
    expect(normalizePhone("99999-0000")).toBeNull();
    expect(normalizePhone("+1 415 555 0000")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("formata pra exibir", () => {
    expect(formatPhone("5527999990000")).toBe("(27) 99999-0000");
    expect(formatPhone("552733334444")).toBe("(27) 3333-4444");
  });
});

describe("prazo de inscrição", () => {
  it("dia escolhido fecha às 23h59 de Brasília e volta pro mesmo dia no input", () => {
    const closes = closesAtFromDate("2026-11-26")!;
    expect(closes.toISOString()).toBe("2026-11-27T02:59:59.000Z");
    expect(dateInputFromClosesAt(closes)).toBe("2026-11-26");
    expect(closesAtFromDate("26/11/2026")).toBeNull();
  });
});

describe("registrationState", () => {
  const base = {
    status: "PUBLISHED",
    registrationMode: "INTERNAL",
    startsAt: new Date("2026-11-27T23:00:00Z"),
    registrationClosesAt: null,
    capacity: null,
  };
  const now = new Date("2026-11-25T15:00:00Z");

  it("aberta sem limite", () => {
    expect(registrationState(base, 500, now)).toBe("open");
  });
  it("esgotada quando as pessoas chegam nas vagas", () => {
    expect(registrationState({ ...base, capacity: 30 }, 29, now)).toBe("open");
    expect(registrationState({ ...base, capacity: 30 }, 30, now)).toBe("full");
  });
  it("encerra no prazo, ou no início do evento se não tiver prazo", () => {
    expect(registrationState({ ...base, registrationClosesAt: new Date("2026-11-25T14:00:00Z") }, 0, now)).toBe(
      "closed"
    );
    expect(registrationState(base, 0, new Date("2026-11-27T23:00:00Z"))).toBe("closed");
  });
  it("rascunho ou sem formulário do site não recebe inscrição", () => {
    expect(registrationState({ ...base, status: "DRAFT" }, 0, now)).toBe("disabled");
    expect(registrationState({ ...base, registrationMode: "EXTERNAL" }, 0, now)).toBe("disabled");
  });
  it("vagas que sobram", () => {
    expect(spotsLeft(30, 28)).toBe(2);
    expect(spotsLeft(30, 31)).toBe(0);
    expect(spotsLeft(null, 10)).toBeNull();
  });
});

describe("registrationHref", () => {
  it("formulário do site, link externo ou nada", () => {
    expect(registrationHref({ slug: "cafe", registrationMode: "INTERNAL", registrationUrl: null })).toEqual({
      href: "/agenda/cafe/inscricao",
      external: false,
    });
    expect(
      registrationHref({ slug: "x", registrationMode: "EXTERNAL", registrationUrl: "https://forms.gle/a" })
    ).toEqual({ href: "https://forms.gle/a", external: true });
    expect(registrationHref({ slug: "x", registrationMode: "NONE", registrationUrl: null })).toBeNull();
  });
});

describe("registrationSchema", () => {
  const valid = { name: "Maria Souza", phone: "(27) 99999-0000", partySize: "2", firstTime: "sim", consent: "on", source: "qr" };

  it("normaliza o WhatsApp e converte os extras", () => {
    const r = registrationSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("5527999990000");
      expect(r.data.partySize).toBe(2);
      expect(r.data.firstTime).toBe(true);
    }
  });

  it("exige consentimento e WhatsApp válido", () => {
    expect(registrationSchema.safeParse({ ...valid, consent: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
  });

  it("origem desconhecida vira 'site'", () => {
    const r = registrationSchema.safeParse({ ...valid, source: "hack" });
    expect(r.success && r.data.source).toBe("site");
  });
});

describe("eventSchema — inscrições", () => {
  const event = { title: "Café com o Pastor", startsAt: "2026-11-27T20:00:00-03:00", endsAt: "2026-11-27T22:00:00-03:00" };

  it("link externo exige o link", () => {
    expect(eventSchema.safeParse({ ...event, registrationMode: "EXTERNAL" }).success).toBe(false);
    expect(
      eventSchema.safeParse({ ...event, registrationMode: "EXTERNAL", registrationUrl: "https://forms.gle/a" }).success
    ).toBe(true);
  });

  it("formulário do site com vagas opcionais", () => {
    expect(eventSchema.safeParse({ ...event, registrationMode: "INTERNAL", capacity: "" }).success).toBe(true);
    const r = eventSchema.safeParse({ ...event, registrationMode: "INTERNAL", capacity: "30" });
    expect(r.success && r.data.capacity).toBe(30);
    expect(eventSchema.safeParse({ ...event, registrationMode: "INTERNAL", capacity: "0" }).success).toBe(false);
  });
});

describe("filterRegistrations / countByFilter", () => {
  const at = new Date("2026-11-27T23:00:00Z");
  const list = [
    { id: "1", name: "João Silva", phone: "5527988740756", status: "CONFIRMED", firstTime: true, checkedInAt: at },
    { id: "2", name: "Maria Souza", phone: "5527999990000", status: "CONFIRMED", firstTime: false, checkedInAt: null },
    { id: "3", name: "Ana Paula", phone: "5527911112222", status: "CONFIRMED", firstTime: true, checkedInAt: null },
    { id: "4", name: "Pedro Lima", phone: "5527933334444", status: "CANCELLED", firstTime: true, checkedInAt: null },
    { id: "5", name: "Lucas", phone: "5527955556666", status: "CONFIRMED", firstTime: null, checkedInAt: null },
  ];
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it("separa primeira vez, já frequenta, presença e canceladas", () => {
    expect(ids(filterRegistrations(list, "todos"))).toEqual(["1", "2", "3", "4", "5"]);
    expect(ids(filterRegistrations(list, "primeira-vez"))).toEqual(["1", "3"]);
    expect(ids(filterRegistrations(list, "ja-frequenta"))).toEqual(["2"]);
    expect(ids(filterRegistrations(list, "presentes"))).toEqual(["1"]);
    expect(ids(filterRegistrations(list, "faltam"))).toEqual(["2", "3", "5"]);
    expect(ids(filterRegistrations(list, "canceladas"))).toEqual(["4"]);
  });

  it("busca por nome sem acento ou por pedaço do WhatsApp", () => {
    expect(ids(filterRegistrations(list, "todos", "joao"))).toEqual(["1"]);
    expect(ids(filterRegistrations(list, "todos", "  ANA "))).toEqual(["3"]);
    expect(ids(filterRegistrations(list, "todos", "(27) 98874"))).toEqual(["1"]);
    expect(ids(filterRegistrations(list, "primeira-vez", "maria"))).toEqual([]);
  });

  it("conta cada filtro respeitando a busca", () => {
    expect(countByFilter(list)).toEqual({
      todos: 5, "primeira-vez": 2, "ja-frequenta": 1, presentes: 1, faltam: 3, canceladas: 1,
    });
    expect(countByFilter(list, "a").todos).toBe(5);
    expect(countByFilter(list, "silva")["primeira-vez"]).toBe(1);
  });

  it("só aceita filtros conhecidos", () => {
    expect(isRegistrationFilter("primeira-vez")).toBe(true);
    expect(isRegistrationFilter("qualquer")).toBe(false);
    expect(isRegistrationFilter(undefined)).toBe(false);
  });
});
