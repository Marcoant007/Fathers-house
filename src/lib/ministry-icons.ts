// Ícone de cada ministério. Sem configurar nada, o ícone sai do nome
// ("Louvor" → nota musical). No painel dá pra escolher outro (coluna `icon`).
// Puro (sem React) pra ser testado em ministry-icons.test.ts; o desenho de
// cada chave fica em src/components/site/MinistryIcon.tsx.
import { normalize } from "@/lib/assistant/text";

export const MINISTRY_ICONS = [
  { key: "louvor", label: "Louvor / música", keywords: ["louvor", "musica", "musicos", "banda", "adoracao", "worship", "coral", "coro", "vocal"] },
  { key: "midia", label: "Mídia / fotos", keywords: ["midia", "comunicacao", "foto", "fotos", "fotografia", "video", "filmagem", "audiovisual", "transmissao", "projecao", "design"] },
  { key: "som", label: "Som / técnica", keywords: ["som", "sonoplastia", "audio", "tecnica", "iluminacao"] },
  { key: "kids", label: "Kids / crianças", keywords: ["kids", "kid", "crianca", "criancas", "infantil", "kids alicerce"] },
  { key: "bebes", label: "Berçário", keywords: ["bercario", "bebe", "bebes", "baby"] },
  { key: "jovens", label: "Jovens", keywords: ["jovens", "jovem", "juventude", "youth", "start", "adolescentes", "adolescente", "adolescencia", "teens", "teen"] },
  { key: "casais", label: "Casais", keywords: ["casais", "casal", "casamento", "matrimonio", "noivos"] },
  { key: "familia", label: "Família", keywords: ["familia", "familias"] },
  { key: "homens", label: "Homens", keywords: ["homens", "homem", "varoes"] },
  { key: "mulheres", label: "Mulheres", keywords: ["mulheres", "mulher", "senhoras", "irmas"] },
  { key: "profetico", label: "Profético", keywords: ["profetico", "profetica", "profecia", "avivamento"] },
  { key: "oracao", label: "Oração / intercessão", keywords: ["oracao", "intercessao", "intercessores", "clamor"] },
  { key: "cozinha", label: "Cozinha", keywords: ["gourmet", "cozinha", "cantina", "lanche", "lanches", "alimentacao", "refeicao", "buffet"] },
  { key: "cafe", label: "Café", keywords: ["cafe", "cafeteria", "coffee"] },
  { key: "estacionamento", label: "Estacionamento", keywords: ["estacionamento", "transito", "manobrista", "manobristas", "garagem"] },
  { key: "recepcao", label: "Recepção", keywords: ["recepcao", "boas vindas", "acolhimento", "portaria", "hospitalidade", "diaconia", "diaconos", "introdutores"] },
  { key: "programacao", label: "Programação / eventos", keywords: ["programacao", "eventos", "evento", "agenda", "producao", "cerimonial", "organizacao"] },
  { key: "ensino", label: "Ensino / estudo", keywords: ["ensino", "escola", "ebd", "discipulado", "estudo", "biblia", "biblico", "teologia", "curso"] },
  { key: "celulas", label: "GFC / células", keywords: ["gfc", "celula", "celulas", "grupo familiar", "grupos familiares", "pequenos grupos", "lares"] },
  { key: "missoes", label: "Missões", keywords: ["missoes", "missao", "evangelismo", "evangelizacao", "missionario", "missionarios"] },
  { key: "social", label: "Ação social", keywords: ["social", "acao social", "assistencia", "doacao", "doacoes", "voluntariado"] },
  { key: "danca", label: "Dança", keywords: ["danca", "coreografia"] },
  { key: "teatro", label: "Teatro / artes", keywords: ["teatro", "artes", "arte", "drama"] },
  { key: "saude", label: "Saúde", keywords: ["saude", "enfermagem", "primeiros socorros"] },
  { key: "seguranca", label: "Segurança", keywords: ["seguranca", "vigilancia"] },
  { key: "igreja", label: "Igreja (genérico)", keywords: [] },
] as const;

export type MinistryIconKey = (typeof MINISTRY_ICONS)[number]["key"];

export const MINISTRY_ICON_KEYS = MINISTRY_ICONS.map((i) => i.key) as [MinistryIconKey, ...MinistryIconKey[]];

export function isMinistryIconKey(value: unknown): value is MinistryIconKey {
  return typeof value === "string" && (MINISTRY_ICON_KEYS as readonly string[]).includes(value);
}

/** Ícone que o nome sugere. Ganha a palavra que aparece primeiro no nome. */
export function iconFromName(name: string): MinistryIconKey {
  const text = ` ${normalize(name)} `;
  let best: { key: MinistryIconKey; at: number } | null = null;
  for (const icon of MINISTRY_ICONS) {
    for (const keyword of icon.keywords) {
      const at = text.indexOf(` ${keyword} `);
      if (at !== -1 && (!best || at < best.at)) best = { key: icon.key, at };
    }
  }
  return best?.key ?? "igreja";
}

/** O escolhido no painel, ou o que o nome sugere. */
export function ministryIconKey(ministry: { name: string; icon?: string | null }): MinistryIconKey {
  return isMinistryIconKey(ministry.icon) ? ministry.icon : iconFromName(ministry.name);
}
