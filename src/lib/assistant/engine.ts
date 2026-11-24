// Motor do tira-dúvidas: responde por palavras-chave, sem IA.
//
// Ordem de decisão em `answer()`:
//   1. pergunta idêntica a uma pergunta cadastrada → resposta dela
//   2. citou um evento ou ministério pelo nome → detalhes dele
//      (se também casar com uma pergunta cadastrada, junta as duas)
//   3. citou um dia ("hoje", "domingo", "essa semana") → programação do dia
//   4. melhor pontuação entre perguntas cadastradas e assuntos fixos
//      (cultos, agenda, endereço, contato, Pix, ministérios, transmissão)
//   5. cumprimento/agradecimento, senão "não entendi" + WhatsApp
//
// Função pura (recebe o conhecimento e o "agora"), roda no navegador e é
// testada em engine.test.ts. É o ponto de troca quando vier uma IA.
import { WEEKDAY_FULL, formatEventRange } from "@/lib/format";
import { SITE_NAME } from "@/lib/site-config";
import { normalize, scoreKeywords, significantTokens, toQuery, wordMatches, type Query } from "./text";
import type {
  AssistantKnowledge,
  AssistantLink,
  AssistantReply,
  KnowledgeEvent,
  KnowledgeFaq,
  KnowledgeMinistry,
  KnowledgeService,
} from "./types";

const TIME_ZONE = "America/Sao_Paulo";
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ---------------------------------------------------------------------
// Datas (sempre no fuso de São Paulo)
// ---------------------------------------------------------------------

/** "2026-11-24" no fuso de São Paulo */
function ymdInSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hhmmInSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const weekdayOf = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const dayMonth = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** "09:30" → "9h30", "20:00" → "20h" */
function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return m === "00" ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`;
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function whatsappHref(phone: string, text?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// ---------------------------------------------------------------------
// Blocos de texto reaproveitados
// ---------------------------------------------------------------------

/** "• Domingo: 9h30 e 18h — Culto da Família" (um item por dia da semana) */
export function servicesLines(services: KnowledgeService[]): string[] {
  const byDay = new Map<number, KnowledgeService[]>();
  for (const s of [...services].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))) {
    byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s]);
  }
  return [...byDay.entries()].map(([weekday, list]) => {
    const names = Array.from(new Set(list.map((s) => s.name)));
    const day = WEEKDAY_FULL[weekday];
    return names.length === 1
      ? `• ${day}: ${joinPt(list.map((s) => timeLabel(s.time)))} — ${names[0]}`
      : `• ${day}: ${list.map((s) => `${timeLabel(s.time)} (${s.name})`).join(", ")}`;
  });
}

function eventLine(event: KnowledgeEvent): string {
  const start = new Date(event.startsAt);
  const ymd = ymdInSaoPaulo(start);
  return `• ${WEEKDAY_SHORT[weekdayOf(ymd)]} ${dayMonth(ymd)}, ${timeLabel(hhmmInSaoPaulo(start))} — ${event.title}`;
}

function whatsappLink(k: AssistantKnowledge, label = "Falar no WhatsApp"): AssistantLink[] {
  return k.contact.whatsapp ? [{ label, href: whatsappHref(k.contact.whatsapp) }] : [];
}

function dedupeLinks(links: AssistantLink[]): AssistantLink[] {
  const seen = new Set<string>();
  return links.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}

/** Troca {cultos}, {endereco}, {whatsapp}, {pix}, {instagram} pelos dados do painel. */
export function fillPlaceholders(text: string, k: AssistantKnowledge): string {
  const values: Record<string, string> = {
    cultos: servicesLines(k.services).join("\n"),
    endereco: k.contact.address ?? "",
    whatsapp: k.contact.whatsapp ?? "",
    pix: k.contact.pixKey ?? "",
    instagram: k.contact.instagram ?? "",
  };
  return text
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------
// Respostas por tipo
// ---------------------------------------------------------------------

function faqReply(faq: KnowledgeFaq, k: AssistantKnowledge): AssistantReply {
  const links: AssistantLink[] = [];
  if (faq.linkUrl && faq.linkLabel) links.push({ label: faq.linkLabel, href: faq.linkUrl });
  if (faq.showWhatsapp) links.push(...whatsappLink(k));
  return { text: fillPlaceholders(faq.answer, k), links, source: `faq:${faq.id}` };
}

function eventLinks(event: KnowledgeEvent): AssistantLink[] {
  const links: AssistantLink[] = [{ label: "Ver na agenda", href: `/agenda/${event.slug}` }];
  if (event.registrationUrl) links.push({ label: "Fazer inscrição", href: event.registrationUrl });
  return links;
}

function eventWhen(event: KnowledgeEvent): string {
  return formatEventRange(new Date(event.startsAt), new Date(event.endsAt));
}

function eventReply(event: KnowledgeEvent): AssistantReply {
  const lines = [event.title, `Quando: ${eventWhen(event)}`];
  if (event.location) lines.push(`Onde: ${event.location}`);
  if (event.description) lines.push("", truncate(event.description, 280));
  return { text: lines.join("\n"), links: eventLinks(event), source: `event:${event.slug}` };
}

function ministryLinks(ministry: KnowledgeMinistry): AssistantLink[] {
  const links: AssistantLink[] = [];
  if (ministry.whatsapp) {
    links.push({
      label: "Falar com o líder",
      href: whatsappHref(ministry.whatsapp, `Olá! Quero saber mais sobre o ministério ${ministry.name}.`),
    });
  }
  links.push({ label: "Ver ministérios", href: "/ministerios" });
  return links;
}

function ministryReply(ministry: KnowledgeMinistry): AssistantReply {
  const lines = [`Ministério ${ministry.name}`];
  if (ministry.schedule) lines.push(`Quando: ${ministry.schedule}`);
  if (ministry.description) lines.push("", truncate(ministry.description, 280));
  return { text: lines.join("\n"), links: ministryLinks(ministry), source: `ministry:${ministry.name}` };
}

function servicesReply(k: AssistantKnowledge): AssistantReply {
  if (k.services.length === 0) {
    return {
      text: "Os horários dos cultos ainda não foram cadastrados. Fale com a gente pra saber!",
      links: whatsappLink(k),
      source: "services",
    };
  }
  return {
    text: `Nossos cultos:\n${servicesLines(k.services).join("\n")}\n\nVenha, traga sua família e convide um amigo!`,
    links: [{ label: "Como chegar", href: "/visite-nos" }],
    source: "services",
  };
}

function agendaReply(k: AssistantKnowledge): AssistantReply {
  const next = k.events.slice(0, 5);
  if (next.length === 0) {
    return {
      text: `No momento não há eventos especiais na agenda. Os cultos seguem normalmente:\n${servicesLines(k.services).join("\n")}`,
      links: [{ label: "Ver agenda", href: "/agenda" }],
      source: "agenda",
    };
  }
  return {
    text: `Próximos eventos:\n${next.map(eventLine).join("\n")}`,
    links: [{ label: "Ver agenda completa", href: "/agenda" }],
    source: "agenda",
  };
}

function addressReply(k: AssistantKnowledge): AssistantReply {
  const links: AssistantLink[] = [];
  if (k.contact.mapsUrl) links.push({ label: "Abrir no mapa", href: k.contact.mapsUrl });
  links.push({ label: "Como chegar", href: "/visite-nos" });
  return {
    text: k.contact.address ? `Estamos em:\n${k.contact.address}` : "Veja como chegar até a gente na página Visite-nos.",
    links,
    source: "address",
  };
}

function contactReply(k: AssistantKnowledge): AssistantReply {
  const links = whatsappLink(k);
  if (k.contact.instagram) links.push({ label: "Instagram", href: k.contact.instagram });
  const text = k.contact.whatsapp
    ? `Fale com a gente pelo WhatsApp: ${k.contact.whatsapp}`
    : "Você encontra nossos contatos na página Visite-nos.";
  if (links.length === 0) links.push({ label: "Visite-nos", href: "/visite-nos" });
  return { text, links, source: "contact" };
}

function giveReply(k: AssistantKnowledge): AssistantReply {
  return {
    text: k.contact.pixKey
      ? `Você pode contribuir pelo Pix.\nChave: ${k.contact.pixKey}`
      : "Veja como contribuir na página Contribua.",
    links: [{ label: "Formas de contribuir", href: "/contribua" }],
    source: "give",
  };
}

function ministriesReply(k: AssistantKnowledge): AssistantReply {
  if (k.ministries.length === 0) return { ...contactReply(k), source: "ministries" };
  const lines = k.ministries.map((m) => `• ${m.name}${m.schedule ? ` — ${m.schedule}` : ""}`);
  return {
    text: `Tem lugar pra você servir! Nossos ministérios:\n${lines.join("\n")}`,
    links: [{ label: "Conhecer os ministérios", href: "/ministerios" }],
    source: "ministries",
  };
}

function liveReply(k: AssistantKnowledge): AssistantReply {
  const links: AssistantLink[] = [];
  if (k.live.videoUrl) links.push({ label: "Assistir", href: k.live.videoUrl });
  if (k.live.audioUrl) links.push({ label: "Ouvir", href: k.live.audioUrl });
  if (k.contact.youtube) links.push({ label: "Canal no YouTube", href: k.contact.youtube });
  if (links.length === 0) {
    return {
      text: `Ainda não temos transmissão cadastrada aqui. Que tal vir pessoalmente?\n${servicesLines(k.services).join("\n")}`,
      links: [{ label: "Como chegar", href: "/visite-nos" }],
      source: "live",
    };
  }
  return {
    text: k.live.videoUrl ? "A transmissão do culto está aqui:" : "Acompanhe nosso canal:",
    links,
    source: "live",
  };
}

// ---------------------------------------------------------------------
// Assuntos fixos (respondidos com os dados do painel)
// ---------------------------------------------------------------------

type Topic = { id: string; keywords: string[]; reply: (k: AssistantKnowledge) => AssistantReply };

const TOPICS: Topic[] = [
  {
    id: "services",
    keywords: ["culto", "cultos", "horario", "horarios", "que horas", "reuniao", "reunioes", "celebracao",
      "programacao fixa", "dias de culto", "que dia"],
    reply: servicesReply,
  },
  {
    id: "agenda",
    keywords: ["agenda", "evento", "eventos", "programacao", "programacoes", "proximos eventos", "atividades",
      "acontecer", "acontecendo", "o que vai ter", "novidades"],
    reply: agendaReply,
  },
  {
    id: "address",
    keywords: ["endereco", "onde fica", "fica onde", "onde", "localizacao", "local", "como chegar",
      "chegar", "mapa", "maps", "rua", "bairro"],
    reply: addressReply,
  },
  {
    id: "contact",
    keywords: ["whatsapp", "whats", "zap", "wpp", "contato", "telefone", "numero", "ligar", "falar com alguem",
      "falar com voces", "secretaria", "atendimento", "instagram", "insta", "redes sociais"],
    reply: contactReply,
  },
  {
    id: "give",
    keywords: ["pix", "dizimo", "dizimar", "oferta", "ofertar", "contribuir", "contribuicao", "doacao", "doar"],
    reply: giveReply,
  },
  {
    id: "ministries",
    keywords: ["ministerio", "ministerios", "servir", "voluntario", "voluntaria", "voluntariado", "participar",
      "fazer parte", "ajudar", "departamento"],
    reply: ministriesReply,
  },
  {
    id: "live",
    keywords: ["ao vivo", "live", "transmissao", "youtube", "assistir", "online", "spotify", "ouvir",
      "pregacao", "pregacoes"],
    reply: liveReply,
  },
];

// ---------------------------------------------------------------------
// Evento/ministério citado pelo nome
// ---------------------------------------------------------------------

/** Palavras comuns em nomes de evento que sozinhas não identificam nenhum. */
const GENERIC_NAME_WORDS = new Set([
  "culto", "encontro", "noite", "dia", "reuniao", "familia", "celebracao", "festa", "evento", "especial",
  "conferencia", "ministerio", "grupo", "programacao", "geral", "igreja",
  ...significantTokens(normalize(SITE_NAME)),
]);

/** 0 = não citou. Nome inteiro vale mais que uma palavra marcante solta ("café", "mulheres"). */
function nameScore(q: Query, name: string): number {
  const nameWords = significantTokens(normalize(name));
  if (nameWords.length === 0) return 0;
  const hits = nameWords.filter((nw) => q.words.some((w) => wordMatches(w, nw)));
  const distinctive = hits.filter((h) => !GENERIC_NAME_WORDS.has(h)).length;
  // Nome de uma palavra genérica só (ex.: ministério "Programação") nunca conta
  // como citado — senão "qual a programação de domingo?" viraria esse ministério.
  if (distinctive === 0 && nameWords.length < 2) return 0;
  if (hits.length === nameWords.length) return 10 + hits.length;
  return distinctive === 0 ? 0 : distinctive * 2 + (hits.length - distinctive) * 0.5;
}

type EntityMatch =
  | { kind: "event"; score: number; event: KnowledgeEvent }
  | { kind: "ministry"; score: number; ministry: KnowledgeMinistry };

function bestEntity(q: Query, k: AssistantKnowledge): EntityMatch | null {
  let best: EntityMatch | null = null;
  for (const event of k.events) {
    const score = nameScore(q, event.title);
    if (score > 0 && (!best || score > best.score)) best = { kind: "event", score, event };
  }
  for (const ministry of k.ministries) {
    const score = nameScore(q, ministry.name);
    if (score > 0 && (!best || score > best.score)) best = { kind: "ministry", score, ministry };
  }
  return best;
}

// ---------------------------------------------------------------------
// Dia citado ("hoje", "domingo", "essa semana")
// ---------------------------------------------------------------------

type DayRef = { label: string; days: string[] };

const WEEKDAY_WORDS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function weekdayName(ymd: string) {
  return WEEKDAY_FULL[weekdayOf(ymd)].toLowerCase();
}

function parseDayRef(q: Query, today: string): DayRef | null {
  const has = (phrase: string) => q.padded.includes(` ${phrase} `);
  const range = (label: string, n: number): DayRef => ({
    label,
    days: Array.from({ length: n }, (_, i) => addDays(today, i)),
  });

  if (has("depois de amanha")) {
    const d = addDays(today, 2);
    return { label: `Depois de amanhã (${weekdayName(d)}, ${dayMonth(d)})`, days: [d] };
  }
  if (has("amanha")) {
    const d = addDays(today, 1);
    return { label: `Amanhã (${weekdayName(d)}, ${dayMonth(d)})`, days: [d] };
  }
  if (has("hoje") || has("hj") || has("esta noite") || has("essa noite")) {
    return { label: `Hoje (${weekdayName(today)}, ${dayMonth(today)})`, days: [today] };
  }
  if (has("fim de semana") || has("final de semana") || has("fds")) {
    const todayWd = weekdayOf(today);
    const saturday = todayWd === 0 ? null : addDays(today, (6 - todayWd + 7) % 7);
    const sunday = addDays(today, (7 - todayWd) % 7);
    return { label: "No fim de semana", days: saturday ? [saturday, sunday] : [sunday] };
  }
  const weekdayIndex = WEEKDAY_WORDS.findIndex((w) => q.words.includes(w));
  if (weekdayIndex >= 0) {
    const d = addDays(today, (weekdayIndex - weekdayOf(today) + 7) % 7);
    const label = d === today ? `Hoje (${weekdayName(d)}, ${dayMonth(d)})` : `${WEEKDAY_FULL[weekdayIndex]} (${dayMonth(d)})`;
    return { label, days: [d] };
  }
  if (["essa semana", "esta semana", "nessa semana", "nesta semana", "da semana", "semana que vem"].some(has)) {
    return range("Nos próximos 7 dias", 7);
  }
  if (["esse mes", "este mes", "nesse mes", "neste mes", "do mes"].some(has)) {
    return range("Nos próximos 30 dias", 30);
  }
  return null;
}

function eventsOn(k: AssistantKnowledge, ymd: string) {
  return k.events.filter((e) => {
    const start = ymdInSaoPaulo(new Date(e.startsAt));
    const end = ymdInSaoPaulo(new Date(e.endsAt));
    return start <= ymd && ymd <= end;
  });
}

function singleDayText(k: AssistantKnowledge, label: string, ymd: string): { text: string; events: KnowledgeEvent[] } {
  const events = eventsOn(k, ymd);
  const items = [
    ...k.services.filter((s) => s.weekday === weekdayOf(ymd)).map((s) => ({ time: s.time, name: s.name })),
    ...events.map((e) => {
      const startsThatDay = ymdInSaoPaulo(new Date(e.startsAt)) === ymd;
      return { time: startsThatDay ? hhmmInSaoPaulo(new Date(e.startsAt)) : "00:00", name: e.title, continues: !startsThatDay };
    }),
  ].sort((a, b) => a.time.localeCompare(b.time));

  if (items.length === 0) return { text: `${label}: não temos culto nem evento marcado.`, events };
  const lines = items.map((i) => ("continues" in i && i.continues ? `• ${i.name} (continua)` : `• ${timeLabel(i.time)} — ${i.name}`));
  return { text: `${label}:\n${lines.join("\n")}`, events };
}

function dayReply(k: AssistantKnowledge, ref: DayRef): AssistantReply {
  const agendaLink = { label: "Ver agenda", href: "/agenda" };

  if (ref.days.length <= 2) {
    const blocks = ref.days.map((d) =>
      singleDayText(k, ref.days.length === 1 ? ref.label : `${WEEKDAY_FULL[weekdayOf(d)]} (${dayMonth(d)})`, d)
    );
    const events = blocks.flatMap((b) => b.events);
    let text = blocks.map((b) => b.text).join("\n\n");
    if (ref.days.length === 2) text = `${ref.label}:\n\n${text}`;
    const nothing = blocks.every((b) => b.text.endsWith("não temos culto nem evento marcado."));
    if (nothing && k.services.length > 0) text += `\n\nNossos cultos:\n${servicesLines(k.services).join("\n")}`;
    const links = events.length === 1 ? eventLinks(events[0]) : [agendaLink];
    return { text, links: dedupeLinks(links), source: "day" };
  }

  const first = ref.days[0];
  const last = ref.days[ref.days.length - 1];
  const events = k.events.filter((e) => {
    const start = ymdInSaoPaulo(new Date(e.startsAt));
    return start >= first && start <= last;
  });
  const services = servicesLines(k.services).join("\n");
  const text =
    events.length === 0
      ? `${ref.label} não há eventos especiais na agenda, só os cultos de sempre:\n${services}`
      : `${ref.label}:\n${events.map(eventLine).join("\n")}\n\nE os cultos de toda semana:\n${services}`;
  return { text, links: [agendaLink], source: "day" };
}

// ---------------------------------------------------------------------
// Cumprimento / agradecimento / não entendi
// ---------------------------------------------------------------------

const GREETINGS = ["oi", "ola", "opa", "eai", "e ai", "salve", "bom dia", "boa tarde", "boa noite", "paz do senhor", "graca e paz", "hello"];
const THANKS = ["obrigado", "obrigada", "brigado", "brigada", "valeu", "vlw", "agradeco", "deus abencoe", "amem", "show", "perfeito", "otimo"];

function fallbackReply(k: AssistantKnowledge): AssistantReply {
  return {
    text: k.contact.whatsapp
      ? "Ainda não sei responder isso, mas a nossa equipe sabe! Fale com a gente pelo WhatsApp ou escolha uma das perguntas abaixo."
      : "Ainda não sei responder isso. Escolha uma das perguntas abaixo ou veja a página Visite-nos.",
    links: k.contact.whatsapp ? whatsappLink(k) : [{ label: "Visite-nos", href: "/visite-nos" }],
    source: null,
    showSuggestions: true,
  };
}

// ---------------------------------------------------------------------
// API pública do motor
// ---------------------------------------------------------------------

const BUILTIN_SUGGESTIONS = ["Quais os horários dos cultos?", "O que tem essa semana?", "Onde fica a igreja?"];

/** Botões de "Perguntas frequentes": 2 fixos, os destaques do painel, e "onde fica". */
export function getSuggestions(k: AssistantKnowledge, max = 6): string[] {
  const featured = k.faqs.filter((f) => f.isFeatured).map((f) => f.question);
  const list = [...BUILTIN_SUGGESTIONS.slice(0, 2), ...featured, BUILTIN_SUGGESTIONS[2]];
  return Array.from(new Set(list)).slice(0, max);
}

function faqScore(q: Query, faq: KnowledgeFaq): number {
  const keywordScore = scoreKeywords(q, faq.keywords);
  const questionWords = significantTokens(normalize(faq.question));
  const overlap = questionWords.filter((qw) => q.words.some((w) => wordMatches(w, qw))).length;
  return keywordScore + Math.min(overlap * 0.5, 1.5);
}

export function answer(input: string, k: AssistantKnowledge, now: Date = new Date()): AssistantReply {
  const q = toQuery(input);
  if (!q.text) return fallbackReply(k);

  // 1. Pergunta idêntica à cadastrada (ex.: clique num botão de pergunta frequente)
  const exact = k.faqs.find((f) => normalize(f.question) === q.text);
  if (exact) return faqReply(exact, k);

  let bestFaq: { faq: KnowledgeFaq; score: number } | null = null;
  for (const faq of k.faqs) {
    const score = faqScore(q, faq);
    if (score > 0 && (!bestFaq || score > bestFaq.score)) bestFaq = { faq, score };
  }

  // 2. Evento/ministério citado pelo nome
  const entity = bestEntity(q, k);
  if (entity) {
    if (bestFaq && bestFaq.score >= 1.5) {
      const base = faqReply(bestFaq.faq, k);
      const extra =
        entity.kind === "event"
          ? `Próxima data — ${entity.event.title}: ${eventWhen(entity.event)}`
          : entity.ministry.schedule
            ? `Ministério ${entity.ministry.name}: ${entity.ministry.schedule}`
            : "";
      const links = entity.kind === "event" ? eventLinks(entity.event) : ministryLinks(entity.ministry);
      return {
        text: extra ? `${base.text}\n\n${extra}` : base.text,
        links: dedupeLinks([...links, ...base.links]),
        source: base.source,
      };
    }
    return entity.kind === "event" ? eventReply(entity.event) : ministryReply(entity.ministry);
  }

  let bestTopic: { topic: Topic; score: number } | null = null;
  for (const topic of TOPICS) {
    const score = scoreKeywords(q, topic.keywords);
    if (score > 0 && (!bestTopic || score > bestTopic.score)) bestTopic = { topic, score };
  }

  // 3. Dia citado — vence quando a pergunta é sobre programação ("tem culto domingo?")
  const today = ymdInSaoPaulo(now);
  const dayRef = parseDayRef(q, today);
  if (dayRef) {
    const topScore = Math.max(bestFaq?.score ?? 0, bestTopic?.score ?? 0);
    const aboutSchedule =
      topScore <= 1 ||
      (bestTopic && ["services", "agenda"].includes(bestTopic.topic.id) && bestTopic.score >= (bestFaq?.score ?? 0));
    if (aboutSchedule) return dayReply(k, dayRef);
  }

  // 4. Melhor pergunta cadastrada ou assunto fixo. A cadastrada vence quando
  //    bate de verdade (palavra-chave + palavra da pergunta, ou uma frase):
  //    "onde fica o GFC?" é sobre o GFC, não sobre o endereço da igreja.
  if (bestFaq && (bestFaq.score >= 1.5 || (bestFaq.score >= 1 && bestFaq.score >= (bestTopic?.score ?? 0)))) {
    return faqReply(bestFaq.faq, k);
  }
  if (bestTopic && bestTopic.score >= 1) return bestTopic.topic.reply(k);

  // 5. Conversa
  if (THANKS.some((t) => q.padded.includes(` ${t} `))) {
    return { text: "Por nada! Se precisar de mais alguma coisa, é só perguntar. Te esperamos!", links: [], source: "thanks" };
  }
  if (GREETINGS.some((g) => q.padded.includes(` ${g} `))) {
    return {
      text: "Oi! Que bom ter você por aqui. Pergunte sobre cultos, eventos, endereço, ou escolha uma das perguntas abaixo.",
      links: [],
      source: "greeting",
      showSuggestions: true,
    };
  }
  return fallbackReply(k);
}
