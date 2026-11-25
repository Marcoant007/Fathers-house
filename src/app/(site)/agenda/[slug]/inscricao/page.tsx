import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatEventRange } from "@/lib/format";
import { buildGoogleCalendarUrl } from "@/lib/ics";
import { registrationState, spotsLeft } from "@/lib/registration-rules";
import { takenSpots } from "@/lib/registrations";
import { RegistrationForm } from "@/components/site/RegistrationForm";

/** Hora em que o formulário foi entregue (anti-robô: envio rápido demais é recusado). Uma vez por requisição. */
function renderedAt() {
  return Date.now();
}

async function getEvent(slug: string) {
  return prisma.event.findFirst({ where: { slug, status: "PUBLISHED" } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  return event ? { title: `Inscrição · ${event.title}` } : {};
}

export default async function InscricaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ origem?: string }>;
}) {
  const [{ slug }, { origem }] = await Promise.all([params, searchParams]);
  const event = await getEvent(slug);
  if (!event) notFound();
  if (event.registrationMode !== "INTERNAL") redirect(`/agenda/${slug}`);

  const [taken, settings] = await Promise.all([
    takenSpots(event.id),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { whatsapp: true } }),
  ]);
  const state = registrationState(event, taken);
  const left = spotsLeft(event.capacity, taken);
  const whatsappHref = settings?.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá! Quero saber sobre a inscrição no ${event.title}.`
      )}`
    : null;

  return (
    <section className="container-site flex max-w-xl flex-col gap-8 py-10 md:py-16">
      <div className="flex flex-col gap-4">
        <p className="eyebrow">Inscrição</p>
        <h1 className="text-3xl font-black uppercase leading-[1.05] md:text-5xl">{event.title}</h1>
        <div className="flex flex-col gap-1.5 text-[15px] text-soft">
          <p className="flex items-center gap-2">
            <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
            {formatEventRange(event.startsAt, event.endsAt)}
          </p>
          {event.location ? (
            <p className="flex items-center gap-2">
              <MapPin size={16} strokeWidth={2} aria-hidden="true" />
              {event.location}
            </p>
          ) : null}
          {state === "open" && left !== null ? (
            <p className="font-bold text-ink">
              {left === 1 ? "Resta 1 vaga" : `Restam ${left} vagas`}
            </p>
          ) : null}
        </div>
      </div>

      {state === "open" ? (
        <RegistrationForm
          slug={event.slug}
          askPartySize={event.askPartySize}
          askFirstTime={event.askFirstTime}
          maxPartySize={Math.min(left ?? 20, 20)}
          source={origem === "qr" ? "qr" : "site"}
          openedAt={renderedAt()}
          calendarHref={buildGoogleCalendarUrl(event)}
          whatsappHref={whatsappHref}
        />
      ) : (
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-7">
          <p className="text-xl font-extrabold">
            {state === "full" ? "As vagas esgotaram." : "As inscrições encerraram."}
          </p>
          <p className="text-[15px] text-soft">
            {whatsappHref
              ? "Fale com a gente no WhatsApp que a equipe te ajuda."
              : "Fale com a equipe da igreja pra saber mais."}
          </p>
          <div className="flex flex-wrap gap-3">
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full bg-ink px-6 text-[15px] font-extrabold text-paper"
              >
                Falar no WhatsApp
              </a>
            ) : null}
            <Link href={`/agenda/${event.slug}`} className="inline-flex min-h-11 items-center px-2 link-more">
              Ver o evento
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
