import "server-only";
import { prisma } from "@/lib/prisma";
import { liveStatus, pickFeaturedLive } from "@/lib/live-rules";

/** Lista do painel: as futuras primeiro, depois as últimas 40 que já aconteceram. */
export async function getLiveStreams() {
  return prisma.liveStream.findMany({ orderBy: { startsAt: "desc" }, take: 60 });
}

/** A transmissão do destaque da Home (ver src/lib/live-rules.ts). */
export async function getFeaturedLive(now: Date = new Date()) {
  // Bastam as próximas e algumas recentes pra decidir.
  const candidates = await prisma.liveStream.findMany({
    where: { visible: true },
    orderBy: { startsAt: "desc" },
    take: 20,
  });
  const live = pickFeaturedLive(candidates, now);
  return live ? { live, status: liveStatus(live, now) } : null;
}
