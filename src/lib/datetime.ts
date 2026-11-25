// Campos <input type="datetime-local"> do painel: o valor ("2026-11-27T20:00")
// não tem fuso. A equipe sempre digita horário de Brasília, então é assim que
// ele é lido e mostrado — independente do fuso do servidor (UTC na Vercel) ou
// do navegador. Roda no servidor e no cliente.

export const TIME_ZONE = "America/Sao_Paulo";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallClock(date: Date) {
  const get = (type: string) => partsFormatter.formatToParts(date).find((p) => p.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Diferença (ms) entre o relógio de Brasília e UTC naquele instante (hoje: -3h). */
function offsetMs(instant: number): number {
  const p = wallClock(new Date(instant));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Date → "2026-11-27T20:00" no horário de Brasília (valor do datetime-local). */
export function toSaoPauloInput(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const p = wallClock(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const LOCAL_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** "2026-11-27T20:00" (horário de Brasília) → Date. null se não for nesse formato. */
export function fromSaoPauloInput(value: string): Date | null {
  const m = LOCAL_INPUT_RE.exec(value.trim());
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // Duas passadas acertam o fuso mesmo perto de uma troca de horário.
  let instant = wall - offsetMs(wall);
  instant = wall - offsetMs(instant);
  return new Date(instant);
}

/**
 * Pra z.preprocess: texto de datetime-local vira Date em horário de Brasília.
 * Valor com fuso explícito ("...-03:00", "...Z") ou Date passa direto.
 */
export function parseSaoPauloInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return fromSaoPauloInput(value) ?? value;
}
