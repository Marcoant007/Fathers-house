import type { Metadata } from "next";
import Link from "next/link";
import { EventImage } from "@/components/site/EventImage";
import { Eyebrow } from "@/components/site/Eyebrow";
import { CategoryFilter } from "@/components/site/CategoryFilter";
import { EventRow } from "@/components/site/EventRow";
import { getEventsByCategory, getEventCategories, getPastEvents } from "@/lib/queries/events";
import { formatEventMoment } from "@/lib/format";
import { getServices } from "@/lib/queries/services";
import { groupServices, sortByWeekday } from "@/lib/service-groups";
import { WeeklyServices } from "@/components/site/WeeklyServices";

export const metadata: Metadata = {
  title: "Agenda",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const [events, categories, pastEvents, services] = await Promise.all([
    getEventsByCategory(categoria),
    getEventCategories(),
    getPastEvents(6),
    getServices(),
  ]);
  const weekly = sortByWeekday(groupServices(services), services);

  return (
    <>
      <section className="bg-ink px-5 pt-16 pb-10 text-paper md:px-20 md:pt-18 md:pb-10">
        <div className="container-site flex flex-col gap-5 px-0">
          <Eyebrow>Agenda</Eyebrow>
          <h1 className="text-4xl font-black tracking-[-1px] uppercase md:text-[60px]">
            O que vem por aí
          </h1>
          <div className="mt-3">
            <CategoryFilter categories={categories} active={categoria} />
          </div>
        </div>
      </section>

      {/* Com filtro de categoria, mostra só os eventos daquela categoria. */}
      {categoria ? null : <WeeklyServices groups={weekly} />}

      <section className="container-site flex flex-col gap-5 pt-14">
        {!categoria && weekly.length > 0 ? (
          <h2 className="text-xl font-black tracking-tight uppercase">Eventos</h2>
        ) : null}
        {events.length > 0 ? (
          events.map((event) => <EventRow key={event.id} event={event} />)
        ) : (
          <p className="py-10 text-[17px] text-soft">Nenhum evento nesta categoria por enquanto.</p>
        )}
      </section>

      {pastEvents.length > 0 ? (
        <section className="container-site flex flex-col gap-5 pt-14 pb-16">
          <h2 className="text-xl font-black tracking-tight uppercase">Já aconteceram</h2>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/agenda/${event.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card hover:border-ink"
                >
                  <div className="relative flex h-40 items-center justify-center bg-sand text-sm font-bold text-soft">
                    <EventImage event={event} sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" />
                  </div>
                  <div className="flex flex-col gap-1.5 p-6">
                    {event.category ? <p className="label-caps text-soft">{event.category.name}</p> : null}
                    <p className="text-lg font-extrabold group-hover:underline">{event.title}</p>
                    <p className="text-sm text-soft">{formatEventMoment(event.startsAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
