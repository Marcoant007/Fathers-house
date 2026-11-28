// "Mais detalhes" do voluntário: aniversário, estado civil, cidade, batismo e
// conversão. Funções puras (testadas em volunteer-details.test.ts): leitura da
// planilha e o que a tela mostra. Nada aqui toca o banco.
import type { MaritalStatus } from "@/generated/prisma/client";
import { normalizeKey } from "@/lib/volunteer-import";
import { toSaoPauloInput } from "@/lib/datetime";

export const MARITAL_LABELS: Record<MaritalStatus, string> = {
  SINGLE: "Solteiro(a)",
  MARRIED: "Casado(a)",
  STABLE_UNION: "União estável",
  DIVORCED: "Divorciado(a)",
  WIDOWED: "Viúvo(a)",
};

/** "Casado(a) no cartório", "amasiado(a)"… → MaritalStatus. */
export function parseMaritalStatus(raw: string | null | undefined): MaritalStatus | null {
  const key = normalizeKey(raw ?? "");
  if (!key) return null;
  if (key.startsWith("solteir")) return "SINGLE";
  if (key.startsWith("casad")) return "MARRIED";
  if (key.startsWith("amasiad") || key.includes("uniao")) return "STABLE_UNION";
  if (key.startsWith("divorc") || key.startsWith("separad")) return "DIVORCED";
  if (key.startsWith("viuv")) return "WIDOWED";
  return null;
}

export type Birth = { day: number; month: number; year: number | null };

/**
 * Data de nascimento da planilha (data do Excel, meia-noite UTC). O formulário
 * vinha com o ano atual pronto ("para colocar o ano basta clicar no número"),
 * então ano recente demais (menos de 8 anos) vira "não informou o ano".
 */
export function birthFromDate(date: Date | null | undefined, now: Date = new Date()): Birth | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const plausible = year >= 1920 && year <= now.getUTCFullYear() - 8;
  return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: plausible ? year : null };
}

/** "10 anos", "5", "1 ano e meio" → ano aproximado da conversão (planilha do ano `refYear`). */
export function convertedYearFrom(raw: string | number | null | undefined, refYear: number): number | null {
  const match = String(raw ?? "").match(/\d+/);
  if (!match) return null;
  const years = Number(match[0]);
  if (years > 90) return years >= 1930 && years <= refYear ? years : null; // já veio o ano
  return refYear - years;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 12, 3 → "12/03" */
export const birthdayLabel = (day: number, month: number) => `${pad(day)}/${pad(month)}`;

/** Idade hoje (horário de Brasília), se o ano é conhecido. */
export function ageOn(birth: Birth, now: Date = new Date()): number | null {
  if (!birth.year) return null;
  const [y, m, d] = toSaoPauloInput(now).slice(0, 10).split("-").map(Number);
  const hadBirthday = m > birth.month || (m === birth.month && d >= birth.day);
  return y - birth.year - (hadBirthday ? 0 : 1);
}

/** Aniversário hoje ou neste mês (horário de Brasília). */
export function birthdayStatus(
  day: number | null,
  month: number | null,
  now: Date = new Date()
): "today" | "month" | null {
  if (!day || !month) return null;
  const [, m, d] = toSaoPauloInput(now).slice(0, 10).split("-").map(Number);
  if (month !== m) return null;
  return day === d ? "today" : "month";
}
