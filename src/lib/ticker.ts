// Faixa rolando da Home ("Programação"): cultos fixos + próximos eventos, em
// ordem de quando acontecem, e os avisos no fim. Puro — testado em ticker.test.ts.
import { formatEventMoment } from "@/lib/format";
import { groupServices, nextOccurrence } from "@/lib/service-groups";

export type TickerKind = "culto" | "evento" | "aviso";
export type TickerItem = { key: string; kind: TickerKind; title: string; meta: string; href: string };

type ServiceLike = { id: string; name: string; weekday: number; startsAt: Date; description?: string | null };
type EventLike = { id: string; title: string; slug: string; startsAt: Date; endsAt: Date };
type NoticeLike = { id: string; title: string; category?: { name: string } | null };

/** "Todo domingo", "Toda terça", "Todo sábado" */
const EVERY = ["Todo domingo", "Toda segunda", "Toda terça", "Toda quarta", "Toda quinta", "Toda sexta", "Todo sábado"];

export function buildTicker(
  { services, events, notices }: { services: ServiceLike[]; events: EventLike[]; notices: NoticeLike[] },
  now: Date = new Date(),
  { eventDays = 45, maxEvents = 8, maxNotices = 4 } = {}
): TickerItem[] {
  const dated: (TickerItem & { at: number })[] = [];

  for (const group of groupServices(services)) {
    const first = services
      .filter((s) => s.weekday === group.weekday && s.name.trim().toLowerCase() === group.name.toLowerCase())
      .map((s) => nextOccurrence(s.weekday, s.startsAt, now).getTime());
    dated.push({
      key: `culto-${group.key}`,
      kind: "culto",
      title: group.name,
      meta: `${EVERY[group.weekday]} · ${group.timesLabel}`,
      href: "/agenda#toda-semana",
      at: Math.min(...first),
    });
  }

  const limit = now.getTime() + eventDays * 24 * 60 * 60 * 1000;
  events
    .filter((e) => e.endsAt.getTime() > now.getTime() && e.startsAt.getTime() <= limit)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, maxEvents)
    .forEach((e) => {
      const happening = e.startsAt.getTime() <= now.getTime();
      dated.push({
        key: `evento-${e.id}`,
        kind: "evento",
        title: e.title,
        meta: happening ? "Acontecendo agora" : formatEventMoment(e.startsAt),
        href: `/agenda/${e.slug}`,
        at: Math.max(e.startsAt.getTime(), now.getTime()),
      });
    });

  const items: TickerItem[] = dated
    .sort((a, b) => a.at - b.at)
    .map(({ key, kind, title, meta, href }) => ({ key, kind, title, meta, href }));

  for (const n of notices.slice(0, maxNotices)) {
    items.push({ key: `aviso-${n.id}`, kind: "aviso", title: n.title, meta: n.category?.name ?? "Aviso", href: "/#avisos" });
  }
  return items;
}
