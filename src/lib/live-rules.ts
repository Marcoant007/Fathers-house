// Qual transmissão a Home mostra e em que situação cada uma está (menu Live).
// Puro — testado em live-rules.test.ts.
import { fromSaoPauloInput, toSaoPauloInput } from "@/lib/datetime";

const HOUR = 60 * 60 * 1000;

/** Depois do horário de início, por quanto tempo a live conta como "ao vivo agora". */
export const LIVE_DURATION_HOURS = 3;
/** Uma live agendada passa a ser a do destaque quando falta menos que isso pra começar. */
export const UPCOMING_WINDOW_HOURS = 24;

export type LiveStatus = "ao-vivo" | "em-breve" | "agendada" | "gravada";

type LiveLike = { startsAt: Date; visible: boolean };

export function liveStatus(live: { startsAt: Date }, now: Date = new Date()): LiveStatus {
  const start = live.startsAt.getTime();
  const t = now.getTime();
  if (t >= start && t < start + LIVE_DURATION_HOURS * HOUR) return "ao-vivo";
  if (t < start) return start - t <= UPCOMING_WINDOW_HOURS * HOUR ? "em-breve" : "agendada";
  return "gravada";
}

/**
 * A do destaque na Home, nesta ordem:
 * 1. a que está ao vivo agora (se houver duas, a que começou por último);
 * 2. a próxima que começa em até 24h;
 * 3. a última que já aconteceu;
 * 4. se só houver futuras, a mais próxima.
 * Lives com "Mostrar no site" desmarcado nunca entram.
 */
export function pickFeaturedLive<T extends LiveLike>(lives: T[], now: Date = new Date()): T | null {
  const visible = lives.filter((l) => l.visible);
  const byStartDesc = [...visible].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const byStartAsc = [...byStartDesc].reverse();

  return (
    byStartDesc.find((l) => liveStatus(l, now) === "ao-vivo") ??
    byStartAsc.find((l) => liveStatus(l, now) === "em-breve") ??
    byStartDesc.find((l) => liveStatus(l, now) === "gravada") ??
    byStartAsc[0] ??
    null
  );
}

export function isYoutubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^(www|m)\./, "");
    return host === "youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

export function isSpotifyUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "open.spotify.com" || host === "spotify.link";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Atalhos do formulário: "preencher com um culto" a partir do menu Cultos.
// ---------------------------------------------------------------------

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type ServiceSlot = { title: string; startsAtInput: string; label: string };

/**
 * Cultos dos últimos 3 dias e dos próximos 8, já com data e hora de Brasília
 * no formato do datetime-local. `startsAt` do Service guarda só a hora (UTC = relógio).
 */
export function serviceSlots(
  services: { name: string; weekday: number; startsAt: Date }[],
  now: Date = new Date(),
  { daysBack = 3, daysAhead = 8, max = 8 } = {}
): ServiceSlot[] {
  const slots: (ServiceSlot & { at: number })[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let offset = -daysBack; offset <= daysAhead; offset++) {
    const ymd = toSaoPauloInput(new Date(now.getTime() + offset * 24 * HOUR)).slice(0, 10);
    const [y, m, d] = ymd.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    for (const service of services) {
      if (service.weekday !== weekday) continue;
      const hh = service.startsAt.getUTCHours();
      const mm = service.startsAt.getUTCMinutes();
      const startsAtInput = `${ymd}T${pad(hh)}:${pad(mm)}`;
      const at = fromSaoPauloInput(startsAtInput)?.getTime() ?? 0;
      const time = mm ? `${hh}h${pad(mm)}` : `${hh}h`;
      slots.push({
        title: service.name,
        startsAtInput,
        label: `${WEEKDAY_SHORT[weekday]} ${pad(d)}/${pad(m)} · ${time} · ${service.name}`,
        at,
      });
    }
  }
  return slots
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map(({ title, startsAtInput, label }) => ({ title, startsAtInput, label }));
}
