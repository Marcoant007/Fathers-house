import { describe, expect, it } from "vitest";
import {
  departmentByAlias,
  mergeRecords,
  normalizeName,
  normalizePhone,
  parseAvailability,
  parseSundayShift,
  parseYesNo,
  splitDepartmentChoices,
} from "./volunteer-import";

describe("normalizePhone", () => {
  it("põe 55 e tira a formatação", () => {
    expect(normalizePhone("(27) 99999-0000")).toBe("5527999990000");
    expect(normalizePhone("27 3333-0000")).toBe("552733330000");
    expect(normalizePhone("+55 27 99999-0000")).toBe("5527999990000");
  });
  it("número sem DDD ganha o 27", () => {
    expect(normalizePhone("99999-0000")).toBe("5527999990000");
  });
  it("devolve null pro que não é telefone", () => {
    expect(normalizePhone("")).toBe(null);
    expect(normalizePhone("não tem")).toBe(null);
    expect(normalizePhone("123")).toBe(null);
  });
});

describe("normalizeName", () => {
  it("arruma espaços e só mexe em nome todo maiúsculo", () => {
    expect(normalizeName("  Ana   Paula ")).toBe("Ana Paula");
    expect(normalizeName("JOÃO DA SILVA")).toBe("João da Silva");
    expect(normalizeName("Pr. Fulano")).toBe("Pr. Fulano");
  });
});

describe("departamentos", () => {
  it("reconhece os jeitos diferentes de escrever", () => {
    expect(departmentByAlias("Recepção & STAFF")?.key).toBe("recepcao-staff");
    expect(departmentByAlias("Staff")?.key).toBe("recepcao-staff");
    expect(departmentByAlias("Loucor")?.key).toBe("louvor");
    expect(departmentByAlias("Boas-Vindas")?.key).toBe("boas-vindas");
    expect(departmentByAlias("Mídia")?.key).toBe("midia");
    expect(departmentByAlias("Evangelismo")).toBe(null);
  });

  it("separa as opções do formulário", () => {
    const { known, unknown } = splitDepartmentChoices("Kids, Recepção & STAFF, Boas-Vindas, Evangelismo");
    expect(known.map((d) => d.key)).toEqual(["kids", "recepcao-staff", "boas-vindas"]);
    expect(unknown).toEqual(["Evangelismo"]);
  });

  it("não repete departamento escrito duas vezes", () => {
    const { known } = splitDepartmentChoices("Recepção, Staff");
    expect(known.map((d) => d.key)).toEqual(["recepcao-staff"]);
  });
});

describe("respostas do formulário", () => {
  it("disponibilidade", () => {
    expect(parseAvailability("Semana e Fins de Semana")).toBe("WEEK_AND_WEEKEND");
    expect(parseAvailability("Apenas fins de semana")).toBe("WEEKEND_ONLY");
    expect(parseAvailability("Apenas Durante a semana")).toBe("WEEKDAYS_ONLY");
    expect(parseAvailability("")).toBe(null);
  });
  it("manhã/noite do domingo", () => {
    expect(parseSundayShift("Manhã/Noite")).toBe("BOTH");
    expect(parseSundayShift("Noite")).toBe("NIGHT");
    expect(parseSundayShift("Manhã")).toBe("MORNING");
    expect(parseSundayShift(undefined)).toBe(null);
  });
  it("sim/não", () => {
    expect(parseYesNo("Sim")).toBe(true);
    expect(parseYesNo("Não")).toBe(false);
    expect(parseYesNo("talvez")).toBe(null);
  });
});

describe("mergeRecords", () => {
  it("junta a mesma pessoa pelo telefone e ATIVO vence INTERESSADO", () => {
    const merged = mergeRecords([
      { tab: "Kids", name: "Ana", phone: "5527999990000", availability: "WEEKEND_ONLY", departments: [{ key: "kids", status: "ACTIVE" }] },
      {
        tab: "INSCRIÇÕES",
        name: "Ana Paula Souza",
        phone: "5527999990000",
        availability: "WEEK_AND_WEEKEND",
        termSigned: true,
        preferName: true,
        departments: [
          { key: "kids", status: "INTERESTED" },
          { key: "midia", status: "INTERESTED" },
        ],
      },
    ]);
    expect(merged.length).toBe(1);
    const [ana] = merged;
    expect(ana.name).toBe("Ana Paula Souza");
    expect(ana.availability).toBe("WEEK_AND_WEEKEND");
    expect(ana.termSigned).toBe(true);
    expect(ana.departments.get("kids")).toBe("ACTIVE");
    expect(ana.departments.get("midia")).toBe("INTERESTED");
  });

  it("não junta duas pessoas sem telefone com uma que tem telefone", () => {
    const merged = mergeRecords([
      { tab: "Kids", name: "João", phone: null, availability: null, departments: [{ key: "kids", status: "ACTIVE" }] },
      { tab: "Mídia", name: "João", phone: "5527988880000", availability: null, departments: [{ key: "midia", status: "ACTIVE" }] },
      { tab: "Gourmet", name: "JOÃO", phone: null, availability: null, departments: [{ key: "gourmet", status: "ACTIVE" }] },
    ]);
    expect(merged.length).toBe(2);
  });
});
