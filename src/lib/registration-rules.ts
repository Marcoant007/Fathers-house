// Regras de inscrição em evento (FA-28/FA-29) — funções puras, testadas em
// registration-rules.test.ts. Nada aqui toca o banco.
import { fromSaoPauloInput } from "@/lib/datetime";

/** Dados pessoais de inscrição são apagados este tanto de dias depois do fim do evento (LGPD). */
export const RETENTION_DAYS = 90;

/**
 * "(27) 99999-0000" → "5527999990000". Aceita com ou sem +55.
 * null = não parece um celular/telefone brasileiro válido.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  // "+1 415..." tem 11 dígitos como um celular daqui; o "+" diz que é outro país.
  if (trimmed.startsWith("+") && !trimmed.replace(/[^\d+]/g, "").startsWith("+55")) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}

/** "5527999990000" → "(27) 99999-0000" */
export function formatPhone(digits: string): string {
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return digits;
}

/** Prazo escolhido como dia ("2026-11-26") → fecha às 23h59 de Brasília. */
export function closesAtFromDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return fromSaoPauloInput(`${ymd}T23:59:59`);
}

/** Inverso de closesAtFromDate, pro valor do <input type="date">. */
export function dateInputFromClosesAt(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type RegistrationState = "open" | "full" | "closed" | "disabled";

type EventForState = {
  status: string;
  registrationMode: string;
  startsAt: Date;
  registrationClosesAt: Date | null;
  capacity: number | null;
};

/** Pode inscrever agora? `taken` = pessoas já confirmadas (soma de partySize). */
export function registrationState(event: EventForState, taken: number, now: Date = new Date()): RegistrationState {
  if (event.status !== "PUBLISHED" || event.registrationMode !== "INTERNAL") return "disabled";
  const closesAt = event.registrationClosesAt ?? event.startsAt;
  if (now >= closesAt) return "closed";
  if (event.capacity !== null && taken >= event.capacity) return "full";
  return "open";
}

/** Vagas que sobram (null = sem limite). */
export function spotsLeft(capacity: number | null, taken: number): number | null {
  return capacity === null ? null : Math.max(capacity - taken, 0);
}

/** Data a partir da qual as inscrições de um evento que terminou em `endsAt` são apagadas. */
export function purgeCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** Pra onde o botão "Inscreva-se" leva: formulário do site, link externo ou nada. */
export function registrationHref(event: {
  slug: string;
  registrationMode?: string | null;
  registrationUrl: string | null;
}): { href: string; external: boolean } | null {
  if (event.registrationMode === "INTERNAL") return { href: `/agenda/${event.slug}/inscricao`, external: false };
  if (event.registrationUrl) return { href: event.registrationUrl, external: true };
  return null;
}

// ---------------------------------------------------------------------
// Filtro da lista de inscritos no painel (?filtro=…&busca=…)
// ---------------------------------------------------------------------

export const REGISTRATION_FILTERS = ["todos", "primeira-vez", "ja-frequenta", "presentes", "faltam", "canceladas"] as const;
export type RegistrationFilter = (typeof REGISTRATION_FILTERS)[number];

export function isRegistrationFilter(value: unknown): value is RegistrationFilter {
  return typeof value === "string" && (REGISTRATION_FILTERS as readonly string[]).includes(value);
}

type FilterableRegistration = {
  name: string;
  phone: string;
  status: string;
  firstTime: boolean | null;
  checkedInAt: Date | null;
};

function matchesFilter(r: FilterableRegistration, filter: RegistrationFilter): boolean {
  const confirmed = r.status === "CONFIRMED";
  switch (filter) {
    case "todos":
      return true;
    case "primeira-vez":
      return confirmed && r.firstTime === true;
    case "ja-frequenta":
      return confirmed && r.firstTime === false;
    case "presentes":
      return confirmed && r.checkedInAt !== null;
    case "faltam":
      return confirmed && r.checkedInAt === null;
    case "canceladas":
      return !confirmed;
  }
}

/** Sem acento e minúsculo, pra "joao" achar "João". */
function plain(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/** Busca por nome (sem acento) ou por pedaço do WhatsApp (só os dígitos). */
function matchesSearch(r: FilterableRegistration, search: string): boolean {
  const term = plain(search);
  if (!term) return true;
  if (plain(r.name).includes(term)) return true;
  const digits = search.replace(/\D/g, "");
  return digits.length >= 3 && r.phone.includes(digits);
}

export function filterRegistrations<T extends FilterableRegistration>(
  registrations: T[],
  filter: RegistrationFilter,
  search = ""
): T[] {
  return registrations.filter((r) => matchesFilter(r, filter) && matchesSearch(r, search));
}

/** Quantos caem em cada filtro (pros números nos botões). Respeita a busca. */
export function countByFilter(registrations: FilterableRegistration[], search = ""): Record<RegistrationFilter, number> {
  const found = registrations.filter((r) => matchesSearch(r, search));
  return Object.fromEntries(
    REGISTRATION_FILTERS.map((f) => [f, found.filter((r) => matchesFilter(r, f)).length])
  ) as Record<RegistrationFilter, number>;
}
