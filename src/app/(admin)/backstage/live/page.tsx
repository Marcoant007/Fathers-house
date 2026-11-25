import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { cn } from "cn";
import { getActor, isEditor } from "@/lib/auth-and-audit";
import { getLiveStreams } from "@/lib/queries/live";
import { getServices } from "@/lib/queries/services";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { deleteLiveStream } from "@/lib/actions/live";
import { liveStatus, pickFeaturedLive, serviceSlots, type LiveStatus } from "@/lib/live-rules";
import { formatEventMoment } from "@/lib/format";
import { Panel } from "@/components/admin/Panel";
import { LiveDialog } from "@/components/admin/LiveDialog";
import { LiveChannelsForm } from "@/components/admin/LiveChannelsForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SaveSuccessDialog } from "@/components/admin/SaveSuccessDialog";

export const metadata: Metadata = { title: "Live" };

const STATUS: Record<LiveStatus, { label: string; className: string }> = {
  "ao-vivo": { label: "Ao vivo agora", className: "bg-danger text-paper" },
  "em-breve": { label: "Começa em breve", className: "bg-accent text-on-accent" },
  agendada: { label: "Agendada", className: "bg-sand text-ink" },
  gravada: { label: "Já aconteceu", className: "bg-sand text-soft" },
};

/** Hora da renderização (fora do corpo do componente, por causa da regra de pureza do React). */
function renderedAt() {
  return new Date();
}

function ExternalTextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 font-bold underline decoration-accent decoration-2 underline-offset-4"
    >
      {children}
      <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">(abre em outra aba)</span>
    </a>
  );
}

export default async function LivePage() {
  const actor = await getActor();
  if (!isEditor(actor)) {
    return <p className="text-soft">Só mídia/admin gerenciam as lives.</p>;
  }

  const now = renderedAt();
  const [lives, services, settings] = await Promise.all([getLiveStreams(), getServices(), getSiteSettings()]);
  const featured = pickFeaturedLive(lives, now);
  const slots = serviceSlots(services, now);

  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={null}>
        <SaveSuccessDialog messages={{ create: "Transmissão cadastrada!", update: "Transmissão atualizada!" }} />
      </Suspense>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <h1 className="text-2xl font-extrabold">Live</h1>
          <p className="text-[15px] text-soft">
            Cadastre aqui a transmissão de cada culto, com o link do YouTube e, se tiver, do Spotify. O site escolhe
            sozinho qual mostrar na página inicial.
          </p>
        </div>
        <LiveDialog
          slots={slots}
          trigger={
            <span className="flex items-center gap-2">
              <Plus size={18} strokeWidth={2} aria-hidden="true" /> Nova transmissão
            </span>
          }
          triggerClassName="rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper"
        />
      </div>

      <Panel className="flex flex-col gap-3">
        <p className="label-caps text-soft">Na página inicial agora</p>
        {featured ? (
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-extrabold",
                STATUS[liveStatus(featured, now)].className
              )}
            >
              {STATUS[liveStatus(featured, now)].label}
            </span>
            <p className="text-lg font-extrabold">{featured.title}</p>
            <p className="text-soft">{formatEventMoment(featured.startsAt)}</p>
            <Link href="/" target="_blank" className="ml-auto text-sm font-extrabold underline">
              Ver no site
            </Link>
          </div>
        ) : (
          <p className="text-soft">
            Nenhuma transmissão aparece no site. Clique em “Nova transmissão” pra cadastrar a do próximo culto.
          </p>
        )}
        <p className="text-sm text-soft">
          Como o site escolhe: primeiro a que está ao vivo; senão, a que começa nas próximas 24 horas; senão, a
          última que já aconteceu.
        </p>
      </Panel>

      <Panel className="overflow-x-auto p-0">
        {lives.length === 0 ? (
          <p className="p-8 text-soft">Nenhuma transmissão cadastrada ainda.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-xs font-extrabold text-soft uppercase">
                <th className="px-6 py-4">Transmissão</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Links</th>
                <th className="px-6 py-4">Situação</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lives.map((live) => {
                const status = STATUS[liveStatus(live, now)];
                return (
                  <tr key={live.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-4">
                      <p className="font-bold">{live.title}</p>
                      {live.description ? <p className="text-sm text-soft">{live.description}</p> : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-soft">{formatEventMoment(live.startsAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-x-4">
                        {live.youtubeUrl ? <ExternalTextLink href={live.youtubeUrl}>YouTube</ExternalTextLink> : null}
                        {live.spotifyUrl ? <ExternalTextLink href={live.spotifyUrl}>Spotify</ExternalTextLink> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={cn("rounded-full px-3 py-1 text-xs font-extrabold", status.className)}>
                          {status.label}
                        </span>
                        {featured?.id === live.id ? (
                          <span className="text-xs font-extrabold text-success">✓ Na página inicial</span>
                        ) : null}
                        {!live.visible ? <span className="text-xs font-extrabold text-soft">Oculta do site</span> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <LiveDialog
                          live={live}
                          trigger={
                            <span className="flex items-center gap-2">
                              <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                              Editar
                              <span className="sr-only"> {live.title}</span>
                            </span>
                          }
                          triggerClassName="flex min-h-11 items-center rounded-full border-2 border-ink px-4 text-sm font-extrabold"
                        />
                        <DeleteButton
                          itemId={live.id}
                          itemTitle={live.title}
                          itemLabel="transmissão"
                          listHref="/backstage/live"
                          deleteAction={deleteLiveStream}
                          variant="compact"
                          description="Isso tira a transmissão do site e do painel pra sempre. O vídeo no YouTube e o episódio no Spotify continuam lá."
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-extrabold">Canais da igreja</h2>
          <p className="text-sm text-soft">
            Os links fixos do canal. Aparecem no rodapé do site e no tira-dúvidas quando alguém pergunta da live.
          </p>
        </div>
        <LiveChannelsForm youtube={settings.youtube} spotify={settings.spotify} />
      </Panel>
    </div>
  );
}
