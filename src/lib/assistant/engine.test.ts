import { describe, expect, it } from "vitest";
import { answer, getSuggestions, servicesLines } from "./engine";
import type { AssistantKnowledge, KnowledgeFaq } from "./types";

// Cenário: programação de novembro/2026. "Agora" = terça, 24/11/2026, 15h em São Paulo.
const NOW = new Date("2026-11-24T18:00:00Z");

const faq = (id: string, question: string, keywords: string[], extra: Partial<KnowledgeFaq> = {}): KnowledgeFaq => ({
  id,
  question,
  answer: `Resposta ${id}`,
  keywords,
  showWhatsapp: false,
  linkLabel: null,
  linkUrl: null,
  isFeatured: false,
  ...extra,
});

const K: AssistantKnowledge = {
  services: [
    { name: "Culto de Celebração", weekday: 0, time: "09:30" },
    { name: "Culto de Celebração", weekday: 0, time: "18:00" },
    { name: "Culto de Terça", weekday: 2, time: "20:00" },
    { name: "GFC", weekday: 4, time: "20:00" },
  ],
  events: [
    {
      title: "Culto de Homens e Mulheres",
      slug: "culto-de-homens-e-mulheres",
      startsAt: "2026-11-26T23:00:00Z",
      endsAt: "2026-11-27T01:00:00Z",
      location: null,
      registrationUrl: null,
      description: null,
    },
    {
      title: "Café com o Pastor",
      slug: "cafe-com-o-pastor",
      startsAt: "2026-11-27T23:00:00Z",
      endsAt: "2026-11-28T01:00:00Z",
      location: "Templo sede",
      registrationUrl: null,
      description: "Para visitantes da casa.",
    },
  ],
  ministries: [{ name: "Louvor", schedule: "Quintas, 20h", whatsapp: "5527999990000", description: null }],
  faqs: [
    faq("primeira", "É minha primeira vez. Como faço pra visitar?", ["primeira vez", "visitar", "visitante"], {
      isFeatured: true,
    }),
    faq("cafe", "O que é o Café com o Pastor?", ["cafe com o pastor", "cafe"], { isFeatured: true, showWhatsapp: true }),
    faq("gfc", "O que é o GFC?", ["gfc", "grupo familiar", "celula"], { isFeatured: true }),
    faq("criancas", "Posso levar crianças?", ["crianca", "criancas", "filhos"]),
    { ...faq("visita", "Cultos {x}", ["xyz"]), answer: "Nossos cultos:\n{cultos}\nZap: {whatsapp}" },
  ],
  contact: {
    address: "Rodovia Serafim Derenzi, 100",
    mapsUrl: "https://maps.example/x",
    whatsapp: "+55 27 99999-0000",
    instagram: "https://instagram.com/igreja",
    youtube: null,
    spotify: null,
    pixKey: "pix@igreja.org",
    emails: { secretary: "secretaria@igreja.org", finance: "financeiro@igreja.org", admin: null },
  },
  live: { videoUrl: null, audioUrl: null },
};

const ask = (q: string) => answer(q, K, NOW);

describe("answer — assuntos fixos", () => {
  it("lista os cultos agrupados por dia", () => {
    const r = ask("Quais os horários dos cultos?");
    expect(r.source).toBe("services");
    expect(r.text).toContain("Domingo: 9h30 e 18h — Culto de Celebração");
    expect(r.text).toContain("Terça-feira: 20h — Culto de Terça");
    expect(r.text).toContain("Quinta-feira: 20h — GFC");
  });

  it("endereço, com tolerância a acento e erro de digitação", () => {
    expect(ask("onde fica a igreja?").source).toBe("address");
    expect(ask("qual o endereso").source).toBe("address");
    expect(ask("qual o endereço").links[0]).toEqual({ label: "Abrir no mapa", href: "https://maps.example/x" });
  });

  it("pix, contato, ministérios e agenda", () => {
    expect(ask("como faço pra dar o dízimo?").text).toContain("pix@igreja.org");
    expect(ask("qual o whatsapp de vcs").links[0].href).toBe("https://wa.me/5527999990000");
    expect(ask("quero ser voluntário").source).toBe("ministries");
    const agenda = ask("quais os próximos eventos?");
    expect(agenda.source).toBe("agenda");
    expect(agenda.text).toContain("Qui 26/11, 20h — Culto de Homens e Mulheres");
    expect(agenda.text).toContain("Sex 27/11, 20h — Café com o Pastor");
  });
});

describe("answer — dias", () => {
  it("'tem culto hoje?' numa terça", () => {
    const r = ask("tem culto hoje?");
    expect(r.source).toBe("day");
    expect(r.text).toContain("Hoje (terça-feira, 24/11)");
    expect(r.text).toContain("20h — Culto de Terça");
  });

  it("dia da semana mistura culto fixo e evento daquele dia", () => {
    const r = ask("o que tem na quinta?");
    expect(r.text).toContain("Quinta-feira (26/11)");
    expect(r.text).toContain("20h — GFC");
    expect(r.text).toContain("20h — Culto de Homens e Mulheres");
  });

  it("domingo de manhã e de noite", () => {
    const r = ask("que horas é o culto de domingo");
    expect(r.text).toContain("Domingo (29/11)");
    expect(r.text).toContain("9h30 — Culto de Celebração");
    expect(r.text).toContain("18h — Culto de Celebração");
  });

  it("dia sem nada sugere os cultos fixos", () => {
    const r = ask("tem algo na segunda?");
    expect(r.text).toContain("não temos culto nem evento marcado");
    expect(r.text).toContain("Nossos cultos:");
  });

  it("essa semana lista os eventos e os cultos de sempre", () => {
    const r = ask("O que tem essa semana?");
    expect(r.text).toContain("Nos próximos 7 dias");
    expect(r.text).toContain("Café com o Pastor");
    expect(r.text).toContain("E os cultos de toda semana");
  });

  it("amanhã", () => {
    expect(ask("e amanhã?").text).toContain("Amanhã (quarta-feira, 25/11)");
  });
});

describe("answer — perguntas cadastradas e nomes", () => {
  it("clique no botão = pergunta idêntica", () => {
    expect(ask("O que é o GFC?").source).toBe("faq:gfc");
  });

  it("pergunta cadastrada específica vence assunto genérico", () => {
    expect(ask("onde fica o gfc?").source).toBe("faq:gfc");
    expect(ask("tem gfc na quinta?").source).toBe("faq:gfc");
    // só a palavra-chave + um dia: vale a programação do dia, que já mostra o GFC
    expect(ask("tem célula na quinta?").text).toContain("20h — GFC");
    expect(ask("posso levar meus filhos no culto de domingo?").source).toBe("faq:criancas");
  });

  it("evento citado + pergunta cadastrada: junta a explicação com a próxima data", () => {
    const r = ask("quando vai ser o café com o pastor?");
    expect(r.source).toBe("faq:cafe");
    expect(r.text).toContain("Resposta cafe");
    expect(r.text).toContain("Próxima data — Café com o Pastor: Sex 27/11, 20h → 22h");
    expect(r.links.map((l) => l.label)).toEqual(["Ver na agenda", "Falar no WhatsApp"]);
  });

  it("evento citado por uma palavra marcante", () => {
    const r = ask("vai ter culto das mulheres?");
    expect(r.source).toBe("event:culto-de-homens-e-mulheres");
    expect(r.text).toContain("Quando: Qui 26/11, 20h → 22h");
  });

  it("palavra genérica sozinha não puxa evento", () => {
    expect(ask("tem culto?").source).toBe("services");
  });

  it("ministério com nome genérico ('Programação') não sequestra a pergunta", () => {
    const k = { ...K, ministries: [...K.ministries, { name: "Programação", schedule: null, whatsapp: null, description: null }] };
    expect(answer("qual a programação de domingo?", k, NOW).source).toBe("day");
    expect(answer("qual a programação?", k, NOW).source).toBe("agenda");
  });

  it("ministério pelo nome, com WhatsApp do líder", () => {
    const r = ask("como entro no louvor?");
    expect(r.source).toBe("ministry:Louvor");
    expect(r.links[0].href).toContain("https://wa.me/5527999990000?text=");
  });

  it("troca os marcadores pelos dados do painel", () => {
    const r = answer("Cultos {x}", K, NOW);
    expect(r.text).toContain("• Domingo: 9h30 e 18h — Culto de Celebração");
    expect(r.text).toContain("Zap: +55 27 99999-0000");
  });
});

describe("answer — conversa", () => {
  it("cumprimento mostra as sugestões", () => {
    const r = ask("Oi, boa noite!");
    expect(r.source).toBe("greeting");
    expect(r.showSuggestions).toBe(true);
  });

  it("cumprimento + pergunta responde a pergunta", () => {
    expect(ask("oi, tem culto hoje?").source).toBe("day");
  });

  it("não entendeu → WhatsApp + sugestões", () => {
    const r = ask("qual a cor favorita do zelador xyzw");
    expect(r.source).toBeNull();
    expect(r.showSuggestions).toBe(true);
    expect(r.links[0].label).toBe("Falar no WhatsApp");
  });
});

describe("getSuggestions / servicesLines", () => {
  it("fixos + destaques do painel, até 6", () => {
    expect(getSuggestions(K)).toEqual([
      "Quais os horários dos cultos?",
      "O que tem essa semana?",
      "É minha primeira vez. Como faço pra visitar?",
      "O que é o Café com o Pastor?",
      "O que é o GFC?",
      "Onde fica a igreja?",
    ]);
  });

  it("dia com nomes diferentes lista cada culto", () => {
    expect(
      servicesLines([
        { name: "Manhã", weekday: 0, time: "09:30" },
        { name: "Noite", weekday: 0, time: "18:00" },
      ])
    ).toEqual(["• Domingo: 9h30 (Manhã), 18h (Noite)"]);
  });
});

describe("e-mails de contato", () => {
  it("lista os e-mails cadastrados quando perguntam o e-mail", () => {
    const r = answer("qual o email da secretaria?", K, NOW);
    expect(r.source).toBe("contact");
    expect(r.text).toContain("• Secretaria: secretaria@igreja.org");
    expect(r.text).toContain("• Financeiro: financeiro@igreja.org");
    expect(r.text.includes("Administrativo")).toBe(false); // não cadastrado
    expect(r.links.map((l) => l.href)).toContain("mailto:secretaria@igreja.org");
  });

  it("mostra o e-mail do financeiro junto com o Pix", () => {
    const r = answer("como faço pra dar o dízimo?", K, NOW);
    expect(r.source).toBe("give");
    expect(r.text).toContain("Dúvidas sobre contribuição: financeiro@igreja.org");
  });
});
