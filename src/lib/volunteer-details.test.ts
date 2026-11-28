import { describe, expect, it } from "vitest";
import { ageOn, birthFromDate, birthdayStatus, convertedYearFrom, parseMaritalStatus } from "./volunteer-details";

describe("parseMaritalStatus", () => {
  it("entende as opções da planilha", () => {
    expect(parseMaritalStatus("Casado(a) no cartório")).toBe("MARRIED");
    expect(parseMaritalStatus("Casada")).toBe("MARRIED");
    expect(parseMaritalStatus("Solteiro(a)")).toBe("SINGLE");
    expect(parseMaritalStatus("Amasiado(a)")).toBe("STABLE_UNION");
    expect(parseMaritalStatus("")).toBe(null);
    expect(parseMaritalStatus("outro")).toBe(null);
  });
});

describe("birthFromDate", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  it("guarda dia, mês e ano", () => {
    expect(birthFromDate(new Date(Date.UTC(1990, 2, 12)), now)).toEqual({ day: 12, month: 3, year: 1990 });
  });
  it("ano que veio pronto do formulário (2026) vira 'sem ano'", () => {
    expect(birthFromDate(new Date(Date.UTC(2026, 6, 5)), now)).toEqual({ day: 5, month: 7, year: null });
  });
  it("sem data, nada", () => {
    expect(birthFromDate(null, now)).toBe(null);
  });
});

describe("convertedYearFrom", () => {
  it("anos de conversão viram o ano aproximado", () => {
    expect(convertedYearFrom("10 anos", 2026)).toBe(2016);
    expect(convertedYearFrom(3, 2026)).toBe(2023);
    expect(convertedYearFrom("2010", 2026)).toBe(2010);
    expect(convertedYearFrom("não sei", 2026)).toBe(null);
  });
});

describe("aniversário", () => {
  const now = new Date("2026-11-26T12:00:00Z"); // 26/11 em Brasília
  it("hoje, neste mês ou não", () => {
    expect(birthdayStatus(26, 11, now)).toBe("today");
    expect(birthdayStatus(3, 11, now)).toBe("month");
    expect(birthdayStatus(3, 12, now)).toBe(null);
    expect(birthdayStatus(null, null, now)).toBe(null);
  });
  it("idade só com ano conhecido", () => {
    expect(ageOn({ day: 27, month: 11, year: 1990 }, now)).toBe(35);
    expect(ageOn({ day: 26, month: 11, year: 1990 }, now)).toBe(36);
    expect(ageOn({ day: 1, month: 1, year: null }, now)).toBe(null);
  });
});
