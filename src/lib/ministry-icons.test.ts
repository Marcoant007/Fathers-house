import { describe, expect, it } from "vitest";
import { iconFromName, isMinistryIconKey, ministryIconKey } from "./ministry-icons";

describe("iconFromName", () => {
  it("acerta os ministérios cadastrados hoje", () => {
    expect(iconFromName("Estacionamento")).toBe("estacionamento");
    expect(iconFromName("Profético")).toBe("profetico");
    expect(iconFromName("Gourmet - Cozinha")).toBe("cozinha");
    expect(iconFromName("Louvor")).toBe("louvor");
    expect(iconFromName("Programação")).toBe("programacao");
    expect(iconFromName("Midia")).toBe("midia");
    expect(iconFromName("Mídia")).toBe("midia");
    expect(iconFromName("Kids")).toBe("kids");
    expect(iconFromName("Jovens")).toBe("jovens");
    expect(iconFromName("Casais")).toBe("casais");
  });

  it("usa a palavra inteira e a que vem primeiro", () => {
    expect(iconFromName("Ministério de Homens e Mulheres")).toBe("homens");
    expect(iconFromName("Grupo Familiar (GFC)")).toBe("celulas");
    expect(iconFromName("Somos Um")).toBe("igreja"); // "som" não casa dentro de "somos"
    expect(iconFromName("Equipe X")).toBe("igreja");
  });
});

describe("ministryIconKey", () => {
  it("o ícone escolhido no painel ganha do nome; valor inválido cai no automático", () => {
    expect(ministryIconKey({ name: "Louvor", icon: "danca" })).toBe("danca");
    expect(ministryIconKey({ name: "Louvor", icon: null })).toBe("louvor");
    expect(ministryIconKey({ name: "Louvor", icon: "nao-existe" })).toBe("louvor");
    expect(isMinistryIconKey("kids")).toBe(true);
    expect(isMinistryIconKey("")).toBe(false);
  });
});
