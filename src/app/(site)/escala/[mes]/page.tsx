import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { describeSlot, isPeriodOpen, MONTH_RE, monthLabel, monthName } from "@/lib/roster-period";
import { AvailabilityForm, type SlotDay } from "@/components/site/AvailabilityForm";
import { MySchedule } from "@/components/site/MySchedule";

// Página que só faz sentido pra quem recebeu o link: fora dos buscadores.
export async function generateMetadata({ params }: { params: Promise<{ mes: string }> }): Promise<Metadata> {
  const { mes } = await params;
  return {
    title: MONTH_RE.test(mes) ? `Escala de ${monthName(mes)}` : "Escala",
    robots: { index: false, follow: false },
  };
}

const deadlineFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

export default async function EscalaDoMesPage({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  if (!MONTH_RE.test(mes)) notFound();

  const period = await prisma.rosterPeriod.findUnique({
    where: { month: mes },
    select: {
      closesAt: true,
      slots: { select: { id: true, label: true, startsAt: true }, orderBy: { startsAt: "asc" } },
      _count: { select: { publications: true } },
    },
  });
  if (!period) notFound();

  const open = isPeriodOpen(period);
  // Algum ministério já publicou: a pessoa pode ver as próprias datas.
  const published = period._count.publications > 0;
  const deadline = deadlineFormatter.format(period.closesAt);

  // Agrupa por data: "Dom 06/12" → 9h30, 18h.
  const days: SlotDay[] = [];
  for (const slot of period.slots) {
    const d = describeSlot(slot.startsAt);
    let day = days.find((x) => x.dateKey === d.dateKey);
    if (!day) {
      day = { dateKey: d.dateKey, label: d.day, slots: [] };
      days.push(day);
    }
    day.slots.push({ id: slot.id, time: d.time, label: slot.label });
  }

  return (
    <section className="container-site flex max-w-2xl flex-col gap-8 py-10 md:py-16">
      <div className="flex flex-col gap-4">
        <p className="eyebrow">Escala dos ministérios</p>
        <h1 className="text-3xl leading-[1.05] font-black uppercase md:text-5xl">Escala de {monthName(mes)}</h1>
        <p className="flex items-start gap-2 text-[17px] text-soft">
          <CalendarClock size={20} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
          {published ? (
            <span>
              A escala de {monthLabel(mes)} saiu! Digite seu WhatsApp pra ver em quais dias você serve.
            </span>
          ) : open ? (
            <span>
              Marque os cultos em que você pode servir em {monthLabel(mes)}. Responda até{" "}
              <b className="text-ink">{deadline}</b>. Quem não responder pode ser escalado em qualquer data.
            </span>
          ) : (
            <span>
              O prazo pra responder terminou ({deadline}). Os líderes estão montando a escala: quando sair, as suas
              datas aparecem aqui mesmo. Se precisar mudar alguma data, fale com o líder do seu ministério.
            </span>
          )}
        </p>
      </div>

      {published ? (
        <section aria-labelledby="minhas-datas" className="flex flex-col gap-4">
          <h2 id="minhas-datas" className="text-2xl font-black uppercase">
            Minhas datas
          </h2>
          <MySchedule month={mes} monthTitle={monthName(mes)} />
        </section>
      ) : null}

      {open && published ? (
        <h2 className="text-2xl font-black uppercase">Ainda dá pra responder</h2>
      ) : null}
      {open && published ? (
        <p className="-mt-4 text-[17px] text-soft">
          Alguns ministérios ainda estão montando a escala. Marque até <b className="text-ink">{deadline}</b> em quais
          cultos você pode servir.
        </p>
      ) : null}

      {!open ? null : days.length === 0 ? (
        <p className="rounded-3xl border border-line bg-card p-7 text-[17px] text-soft">
          Ainda não há cultos cadastrados neste mês. Fale com o líder do seu ministério.
        </p>
      ) : (
        <AvailabilityForm month={mes} days={days} deadline={deadline} />
      )}
    </section>
  );
}
