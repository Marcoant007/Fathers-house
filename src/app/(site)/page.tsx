import { Hero } from "@/components/site/Hero";
import { Ticker } from "@/components/site/Ticker";
import { buildTicker } from "@/lib/ticker";
import { LiveBlock } from "@/components/site/LiveBlock";
import { SectionHeader } from "@/components/site/SectionHeader";
import { EventCard } from "@/components/site/EventCard";
import { NoticeCard } from "@/components/site/NoticeCard";
import { AboutBlock } from "@/components/site/AboutBlock";
import { MinistryChip } from "@/components/site/MinistryChip";
import { VisitBlock } from "@/components/site/VisitBlock";
import { GivingSection } from "@/components/site/GivingSection";
import { getServices } from "@/lib/queries/services";
import { getTickerEvents, getUpcomingEvents } from "@/lib/queries/events";
import { getActiveAnnouncements } from "@/lib/queries/announcements";
import { getMinistries } from "@/lib/queries/ministries";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { getFeaturedLive } from "@/lib/queries/live";
import { getVisibleGivingProjects } from "@/lib/queries/giving-projects";
import { formatServiceLabel, getNextService } from "@/lib/format";
import { DEFAULT_ABOUT_IMAGE, DEFAULT_HERO_IMAGE } from "@/lib/site-config";

// Reconstrói a cada minuto: o selo "ao vivo agora" da live, o próximo culto e
// os eventos dependem do horário, não só de alguém salvar algo no painel.
export const revalidate = 60;

export default async function Home() {
  const [services, events, announcements, ministries, settings, featuredLive, tickerEvents, tickerNotices, projects] =
    await Promise.all([
    getServices(),
    getUpcomingEvents(3),
    getActiveAnnouncements(2),
    getMinistries(),
    getSiteSettings(),
    getFeaturedLive(),
    getTickerEvents(),
    getActiveAnnouncements(4),
    getVisibleGivingProjects(),
  ]);
  const tickerItems = buildTicker({ services, events: tickerEvents, notices: tickerNotices });

  const nextService = getNextService(services);

  return (
    <>
      <Hero
        nextServiceLabel={nextService ? formatServiceLabel(nextService) : null}
        address={settings.address}
        imageSrc={settings.heroImagePath ?? DEFAULT_HERO_IMAGE}
      />

      <Ticker items={tickerItems} liveNow={featuredLive?.status === "ao-vivo"} />

      {featuredLive ? (
        <section id="ao-vivo" className="scroll-mt-6 pt-12 md:pt-28">
          <LiveBlock live={featuredLive.live} status={featuredLive.status} />
        </section>
      ) : null}

      <section className="container-site flex flex-col gap-9 pt-12 md:pt-28">
        <SectionHeader eyebrow="Agenda" title="Próximos eventos" linkHref="/agenda" linkLabel="Ver agenda completa" />
        {events.length > 0 ? (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <p className="text-soft">Nenhum evento publicado por enquanto.</p>
        )}
      </section>

      <section id="avisos" className="container-site flex flex-col gap-9 pt-12 md:pt-28">
        <SectionHeader eyebrow="Mural" title="Avisos da semana" />
        {announcements.length > 0 ? (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
            {announcements.map((announcement) => (
              <NoticeCard key={announcement.id} announcement={announcement} />
            ))}
          </div>
        ) : (
          <p className="text-soft">Nenhum aviso no ar por enquanto.</p>
        )}
      </section>

      <section className="pt-12 md:pt-28">
        <AboutBlock
          title="Uma família construída sobre a Rocha."
          text="Somos uma igreja que acredita no poder da comunidade: um lugar para pertencer, crescer na fé e servir."
          imageSrc={settings.aboutImagePath ?? DEFAULT_ABOUT_IMAGE}
          isDefaultImage={!settings.aboutImagePath}
        />
      </section>

      {ministries.length > 0 ? (
        <section id="ministerios" className="container-site flex flex-col gap-8 pt-12 md:pt-28">
          <h2 className="h-section">Encontre seu lugar</h2>
          <div className="flex flex-wrap gap-4">
            {ministries.map((ministry, index) => (
              <MinistryChip
                key={ministry.id}
                name={ministry.name}
                slug={ministry.slug}
                icon={ministry.icon}
                index={index}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section id="visite" className="pt-12 md:pt-28">
        <VisitBlock address={settings.address} mapsUrl={settings.mapsUrl} whatsapp={settings.whatsapp} />
      </section>

      {settings.pixKey || projects.length > 0 ? (
        <section id="contribua" className="scroll-mt-6 py-12 md:py-28">
          <GivingSection projects={projects} pixKey={settings.pixKey} financeEmail={settings.financeEmail} />
        </section>
      ) : null}
    </>
  );
}
