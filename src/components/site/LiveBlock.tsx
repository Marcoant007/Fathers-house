import type { LiveStream } from "@/generated/prisma/client";
import { Button } from "@/components/site/Button";
import { formatEventMoment } from "@/lib/format";
import { toYoutubeEmbedUrl, toSpotifyEmbedUrl } from "@/lib/live-embed";
import type { LiveStatus } from "@/lib/live-rules";

const HEADINGS: Record<LiveStatus, string> = {
  "ao-vivo": "Culto ao vivo",
  "em-breve": "Culto ao vivo",
  agendada: "Próxima transmissão",
  gravada: "Assista ao último culto",
};

function StatusBadge({ status, startsAt }: { status: LiveStatus; startsAt: Date }) {
  if (status === "ao-vivo") {
    return (
      <span className="inline-flex items-center gap-2 self-start rounded-full bg-danger px-3 py-1 text-xs font-extrabold text-paper uppercase">
        <span className="size-2 animate-pulse rounded-full bg-paper" aria-hidden="true" />
        Ao vivo agora
      </span>
    );
  }
  const label = status === "gravada" ? "Transmitido" : "Começa";
  return (
    <span className="label-caps self-start text-soft">
      {label} {formatEventMoment(startsAt)}
    </span>
  );
}

export function LiveBlock({ live, status }: { live: LiveStream; status: LiveStatus }) {
  const videoEmbed = live.youtubeUrl ? toYoutubeEmbedUrl(live.youtubeUrl) : null;
  const audioEmbed = live.spotifyUrl ? toSpotifyEmbedUrl(live.spotifyUrl) : null;

  return (
    <div className="container-site flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StatusBadge status={status} startsAt={live.startsAt} />
        <h2 className="h-section">{HEADINGS[status]}</h2>
        <p className="text-[17px] font-extrabold">{live.title}</p>
        {live.description ? <p className="text-[15px] text-soft">{live.description}</p> : null}
      </div>

      {videoEmbed ? (
        <div className="aspect-video w-full overflow-hidden rounded-[28px] bg-ink">
          <iframe
            src={videoEmbed}
            title={`${live.title} — YouTube`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {live.youtubeUrl ? (
          <Button
            variant={videoEmbed ? "outline" : "accent"}
            render={<a href={live.youtubeUrl} target="_blank" rel="noopener noreferrer" />}
          >
            Abrir no YouTube
          </Button>
        ) : null}
        {live.spotifyUrl && !audioEmbed ? (
          <Button variant="outline" render={<a href={live.spotifyUrl} target="_blank" rel="noopener noreferrer" />}>
            Ouvir no Spotify
          </Button>
        ) : null}
      </div>

      {audioEmbed ? (
        <iframe
          src={audioEmbed}
          title={`${live.title} — Spotify`}
          className="h-[152px] w-full rounded-2xl"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
