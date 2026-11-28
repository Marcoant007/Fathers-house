// Regras da importação da planilha de voluntariado (Escala dos Ministérios,
// parte 1). Funções puras: o script prisma/import-volunteers.ts lê o .xlsx e o
// banco; aqui fica só "o que cada linha significa".

import type { MaritalStatus, MembershipStatus, SundayShift, VolunteerAvailability } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Departamentos e funções
// ---------------------------------------------------------------------------

export type DepartmentDef = {
  key: string;
  /** Nome usado se o ministério ainda não existir no banco. */
  name: string;
  /** Nomes (já normalizados) que casam com um ministério que já existe. */
  matches: string[];
  /** Outras formas de escrever o departamento na planilha/formulário. */
  aliases: string[];
  /** Funções dentro do departamento (subcategorias). */
  functions: string[];
};

/**
 * Lista inicial, montada a partir das abas e das escalas de 2025/26. Tudo aqui
 * vira editável no painel; a planilha só dá o ponto de partida.
 */
export const DEPARTMENTS: DepartmentDef[] = [
  {
    key: "kids",
    name: "Kids",
    matches: ["kids"],
    aliases: ["kids", "ministerio kids", "culto kids"],
    functions: ["Professor(a)", "Auxiliar", "Recepção", "Segurança", "Som", "Louvor", "Limpeza", "Staff", "D.P."],
  },
  {
    key: "louvor",
    name: "Louvor",
    matches: ["louvor"],
    aliases: ["louvor", "loucor", "ministerio do louvor", "ministerio de louvor"],
    functions: ["Ministro(a)", "Equipe"],
  },
  {
    key: "midia",
    name: "Mídia",
    matches: ["midia"],
    aliases: ["midia"],
    functions: ["Criativa", "Técnica"],
  },
  {
    key: "recepcao-staff",
    name: "Recepção & Staff",
    matches: ["recepcao staff", "recepcao e staff"],
    aliases: ["recepcao staff", "recepcao e staff", "staff recepcao", "recepcao", "staff"],
    functions: ["Recepção", "Staff", "Ofertório", "Templo", "Anúncios e Ofertas", "Coordenação", "Ceia"],
  },
  { key: "boas-vindas", name: "Boas-Vindas", matches: ["boas vindas"], aliases: ["boas vindas"], functions: [] },
  {
    key: "gourmet",
    name: "Gourmet",
    matches: ["gourmet", "gourmet cozinha"],
    aliases: ["gourmet", "gourmet cozinha", "cozinha"],
    functions: [],
  },
  { key: "intercessao", name: "Intercessão", matches: ["intercessao"], aliases: ["intercessao"], functions: [] },
  { key: "profetico", name: "Profético", matches: ["profetico"], aliases: ["profetico"], functions: [] },
  {
    key: "estacionamento",
    name: "Estacionamento",
    matches: ["estacionamento"],
    aliases: ["estacionamento"],
    functions: [],
  },
  { key: "sonoplastia", name: "Sonoplastia", matches: ["sonoplastia"], aliases: ["sonoplastia"], functions: [] },
  { key: "seguranca", name: "Segurança", matches: ["seguranca"], aliases: ["seguranca"], functions: [] },
  { key: "danca", name: "Dança", matches: ["danca"], aliases: ["danca"], functions: [] },
  { key: "limpeza", name: "Limpeza", matches: ["limpeza"], aliases: ["limpeza"], functions: [] },
  { key: "acao-social", name: "Ação Social", matches: ["acao social"], aliases: ["acao social"], functions: [] },
  {
    key: "apoio-pastoral",
    name: "Apoio Pastoral",
    matches: ["apoio pastoral"],
    aliases: ["apoio pastoral"],
    functions: [],
  },
  { key: "apoio-culto", name: "Apoio Culto", matches: ["apoio culto"], aliases: ["apoio culto"], functions: [] },
];

/** Abas da planilha que são a lista de uma equipe (quem está nelas está ATIVO no departamento). */
export const TEAM_TABS: Record<string, string> = {
  "staff recepcao": "recepcao-staff",
  gourmet: "gourmet",
  seguranca: "seguranca",
  estacionamento: "estacionamento",
  kids: "kids",
  intercessao: "intercessao",
  sonoplastia: "sonoplastia",
  midia: "midia",
  "boas vindas": "boas-vindas",
  "apoio pastoral": "apoio-pastoral",
  "apoio culto": "apoio-culto",
  danca: "danca",
};

/** "Recepção & STAFF" → "recepcao staff". Sem acento, minúsculo, só letras/números. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function departmentByAlias(label: string): DepartmentDef | null {
  const key = normalizeKey(label);
  if (!key) return null;
  return DEPARTMENTS.find((d) => d.aliases.includes(key)) ?? null;
}

/**
 * "Kids, Recepção & STAFF, Boas-Vindas" → [Kids, Recepção & Staff, Boas-Vindas].
 * O Google Forms junta as opções com ", "; só separa antes de letra maiúscula
 * pra não quebrar uma opção que tenha vírgula no meio.
 */
export function splitDepartmentChoices(raw: string): { known: DepartmentDef[]; unknown: string[] } {
  const parts = raw
    .split(/,\s*(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((p) => p.trim())
    .filter(Boolean);
  const known: DepartmentDef[] = [];
  const unknown: string[] = [];
  for (const part of parts) {
    const dept = departmentByAlias(part);
    if (dept) {
      if (!known.includes(dept)) known.push(dept);
    } else {
      unknown.push(part);
    }
  }
  return { known, unknown };
}

// ---------------------------------------------------------------------------
// Pessoa
// ---------------------------------------------------------------------------

/** DDD usado quando o número veio sem DDD (8–9 dígitos). Vitória/ES. */
export const DEFAULT_DDD = "27";

/**
 * Telefone só com dígitos e 55 na frente: "(27) 99999-0000" → "5527999990000".
 * Devolve null se não der pra entender (aí a pessoa é importada sem telefone).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  digits = digits.replace(/^0+/, "");
  if (digits.length === 8 || digits.length === 9) digits = `55${DEFAULT_DDD}${digits}`;
  else if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}

const LOWER_WORDS = new Set(["da", "das", "de", "do", "dos", "e"]);

/** Espaços arrumados; nome TODO EM MAIÚSCULA vira "Nome Próprio". */
export function normalizeName(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const hasLower = /[a-zà-ú]/.test(clean);
  if (hasLower) return clean;
  return clean
    .toLowerCase()
    .split(" ")
    .map((word, i) => (i > 0 && LOWER_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function parseAvailability(raw: string | null | undefined): VolunteerAvailability | null {
  const key = normalizeKey(raw ?? "");
  if (!key) return null;
  if (key.includes("semana e fins de semana") || key.includes("semana e fim de semana")) return "WEEK_AND_WEEKEND";
  if (key.includes("apenas fins de semana") || key.includes("apenas fim de semana")) return "WEEKEND_ONLY";
  if (key.includes("apenas durante a semana")) return "WEEKDAYS_ONLY";
  return null;
}

export function parseSundayShift(raw: string | null | undefined): SundayShift | null {
  const key = normalizeKey(raw ?? "");
  if (!key) return null;
  const morning = key.includes("manha");
  const night = key.includes("noite");
  if (morning && night) return "BOTH";
  if (morning) return "MORNING";
  if (night) return "NIGHT";
  return null;
}

export function parseYesNo(raw: string | null | undefined): boolean | null {
  const key = normalizeKey(raw ?? "");
  if (key === "sim" || key === "s") return true;
  if (key === "nao" || key === "n") return false;
  return null;
}

// ---------------------------------------------------------------------------
// Juntar a mesma pessoa vinda de várias abas
// ---------------------------------------------------------------------------

/** "Mais detalhes" (ver volunteer-details.ts). */
export type VolunteerDetails = {
  birth: { day: number; month: number; year: number | null } | null;
  maritalStatus: MaritalStatus | null;
  city: string | null;
  baptized: boolean | null;
  convertedYear: number | null;
};

const emptyDetails = (): VolunteerDetails => ({
  birth: null,
  maritalStatus: null,
  city: null,
  baptized: null,
  convertedYear: null,
});

export type SourceRecord = {
  /** Aba de onde veio (pro relatório). */
  tab: string;
  name: string;
  phone: string | null;
  availability: VolunteerAvailability | null;
  sundayShift?: SundayShift | null;
  termSigned?: boolean | null;
  backgroundCheckAnswer?: string | null;
  /** Nome completo do formulário vale mais que o apelido da aba. */
  preferName?: boolean;
  departments: { key: string; status: MembershipStatus }[];
  details?: Partial<VolunteerDetails>;
};

export type MergedVolunteer = {
  name: string;
  phone: string | null;
  availability: VolunteerAvailability | null;
  sundayShift: SundayShift | null;
  termSigned: boolean | null;
  backgroundCheckAnswer: string | null;
  /** key do departamento → ACTIVE vence INTERESTED */
  departments: Map<string, MembershipStatus>;
  details: VolunteerDetails;
  tabs: Set<string>;
};

/**
 * Junta por telefone; quem não tem telefone junta pelo nome normalizado (só
 * com outro registro também sem telefone, pra não misturar duas pessoas com o
 * mesmo nome).
 */
export function mergeRecords(records: SourceRecord[]): MergedVolunteer[] {
  const byKey = new Map<string, MergedVolunteer>();
  for (const r of records) {
    const name = normalizeName(r.name);
    if (name.length < 2) continue;
    const key = r.phone ? `tel:${r.phone}` : `nome:${normalizeKey(name)}`;
    let v = byKey.get(key);
    if (!v) {
      v = {
        name,
        phone: r.phone,
        availability: null,
        sundayShift: null,
        termSigned: null,
        backgroundCheckAnswer: null,
        departments: new Map(),
        details: emptyDetails(),
        tabs: new Set(),
      };
      byKey.set(key, v);
    }
    if (r.preferName || (!v.tabs.has("INSCRIÇÕES") && name.length > v.name.length)) {
      v.name = name;
    }
    // Formulário (preferName) é a resposta mais recente da pessoa: vale mais.
    if (r.availability && (r.preferName || !v.availability)) v.availability = r.availability;
    if (r.sundayShift && (r.preferName || !v.sundayShift)) v.sundayShift = r.sundayShift;
    if (r.termSigned != null) v.termSigned = r.termSigned;
    if (r.backgroundCheckAnswer) v.backgroundCheckAnswer = r.backgroundCheckAnswer;
    // Detalhes: o formulário vale mais; das abas, só completa o que falta.
    if (r.details) {
      const target = v.details as Record<string, unknown>;
      for (const [key, value] of Object.entries(r.details)) {
        if (value == null) continue;
        if (r.preferName || target[key] == null) target[key] = value;
      }
    }
    for (const d of r.departments) {
      const current = v.departments.get(d.key);
      if (current !== "ACTIVE") v.departments.set(d.key, d.status);
    }
    v.tabs.add(r.tab);
  }
  return [...byKey.values()];
}
