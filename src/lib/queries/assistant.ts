import "server-only";
import { prisma } from "@/lib/prisma";
import type { AssistantKnowledge } from "@/lib/assistant/types";
import { registrationHref } from "@/lib/registration-rules";
import { getFeaturedLive } from "@/lib/queries/live";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tudo que o tira-dúvidas sabe, direto do que a equipe cadastra no painel.
 * Só dado público: vai inteiro pro navegador (GET /api/assistente).
 */
export async function getAssistantKnowledge(): Promise<AssistantKnowledge> {
  const now = new Date();
  const [services, events, ministries, faqs, settings, featuredLive] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ weekday: "asc" }, { startsAt: "asc" }] }),
    prisma.event.findMany({
      where: { status: "PUBLISHED", endsAt: { gt: now }, startsAt: { lt: new Date(now.getTime() + 120 * DAY_MS) } },
      orderBy: { startsAt: "asc" },
      take: 40,
    }),
    prisma.ministry.findMany({ where: { showOnSite: true }, orderBy: { sortOrder: "asc" } }),
    prisma.faqEntry.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
    getFeaturedLive(now),
  ]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    services: services.map((s) => ({
      name: s.name,
      weekday: s.weekday,
      // coluna `time`: horário de parede guardado em UTC, sem conversão de fuso
      time: `${pad(s.startsAt.getUTCHours())}:${pad(s.startsAt.getUTCMinutes())}`,
    })),
    events: events.map((e) => ({
      title: e.title,
      slug: e.slug,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      location: e.location,
      // formulário do site ("/agenda/x/inscricao") ou link externo — o bot mostra "Fazer inscrição"
      registrationUrl: registrationHref(e)?.href ?? null,
      description: e.description,
    })),
    ministries: ministries.map((m) => ({
      name: m.name,
      schedule: m.schedule,
      whatsapp: m.whatsapp,
      description: m.description,
    })),
    faqs: faqs.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      keywords: f.keywords,
      showWhatsapp: f.showWhatsapp,
      linkLabel: f.linkLabel,
      linkUrl: f.linkUrl,
      isFeatured: f.isFeatured,
    })),
    contact: {
      address: settings?.address ?? null,
      mapsUrl: settings?.mapsUrl ?? null,
      whatsapp: settings?.whatsapp ?? null,
      instagram: settings?.instagram ?? null,
      youtube: settings?.youtube ?? null,
      spotify: settings?.spotify ?? null,
      pixKey: settings?.pixKey ?? null,
      emails: {
        secretary: settings?.secretaryEmail ?? null,
        finance: settings?.financeEmail ?? null,
        admin: settings?.adminEmail ?? null,
      },
    },
    live: { videoUrl: featuredLive?.live.youtubeUrl ?? null, audioUrl: featuredLive?.live.spotifyUrl ?? null },
  };
}

/** Lista do painel (inclui as desativadas). */
export async function getFaqEntries() {
  return prisma.faqEntry.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}
