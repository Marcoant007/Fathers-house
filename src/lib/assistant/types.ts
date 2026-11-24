// Tipos do tira-dúvidas. O "conhecimento" é tudo que o bot sabe, montado no
// servidor (src/lib/queries/assistant.ts) a partir do que a equipe cadastra no
// painel. Só dados públicos entram aqui — ele vai inteiro pro navegador.
//
// Quando a igreja tiver uma IA: este mesmo objeto vira o contexto do prompt, e
// só a função `answer` do engine.ts precisa ser trocada por uma chamada à API.

export type KnowledgeService = {
  name: string;
  weekday: number; // 0 = domingo ... 6 = sábado
  time: string; // "HH:MM" — horário de parede, sem fuso
};

export type KnowledgeEvent = {
  title: string;
  slug: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  location: string | null;
  registrationUrl: string | null;
  description: string | null;
};

export type KnowledgeMinistry = {
  name: string;
  schedule: string | null;
  whatsapp: string | null;
  description: string | null;
};

export type KnowledgeFaq = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  showWhatsapp: boolean;
  linkLabel: string | null;
  linkUrl: string | null;
  isFeatured: boolean;
};

export type AssistantKnowledge = {
  services: KnowledgeService[];
  events: KnowledgeEvent[]; // só publicados e que ainda não terminaram, em ordem de data
  ministries: KnowledgeMinistry[];
  faqs: KnowledgeFaq[]; // só os ativos
  contact: {
    address: string | null;
    mapsUrl: string | null;
    whatsapp: string | null;
    instagram: string | null;
    youtube: string | null;
    pixKey: string | null;
  };
  live: { videoUrl: string | null; audioUrl: string | null };
};

export type AssistantLink = { label: string; href: string };

export type AssistantReply = {
  text: string;
  links: AssistantLink[];
  /** De onde veio a resposta: "faq:<id>", "event:<slug>", "services", "day"... null = não entendeu. */
  source: string | null;
  /** Mostrar de novo os botões de perguntas frequentes embaixo da resposta. */
  showSuggestions?: boolean;
};
