"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Hourglass, LoaderCircle, Search } from "lucide-react";
import { cn } from "cn";
import { lookupMySchedule, type MyScheduleResult } from "@/lib/actions/availability";
import { SITE_NAME } from "@/lib/site-config";

type Found = Extract<MyScheduleResult, { ok: true }>;

const inputClass = (error?: boolean) =>
  cn(
    "h-14 w-full rounded-2xl border-2 bg-card px-5 text-[17px] outline-none",
    error ? "border-danger" : "border-line focus:border-ink"
  );

const toCalendarDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

/** Link "pôr na agenda" do Google (2h de duração, que é o tempo de um culto). */
function calendarUrl(d: Found["dates"][number]) {
  const start = new Date(d.startsAt);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Servir: ${d.ministry}${d.role ? ` (${d.role})` : ""} · ${d.label}`,
    dates: `${toCalendarDate(start)}/${toCalendarDate(end)}`,
    details: `Escala do ministério ${d.ministry} — ${SITE_NAME}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** "Ver minhas datas": a pessoa digita o WhatsApp e vê onde está escalada no mês. */
export function MySchedule({ month, monthTitle }: { month: string; monthTitle: string }) {
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!found) {
    return (
      <form
        className="flex flex-col gap-5 rounded-3xl border border-line bg-card p-6 md:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          const phone = String(new FormData(e.currentTarget).get("phone") ?? "");
          setError(null);
          startTransition(async () => {
            const result = await lookupMySchedule(month, phone);
            if (!result.ok) setError(result.error);
            else setFound(result);
          });
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="my-phone" className="text-[15px] font-extrabold">
            Seu WhatsApp
          </label>
          <input
            id="my-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(27) 99999-0000"
            aria-invalid={!!error}
            aria-describedby={error ? "my-phone-error" : "my-phone-hint"}
            className={inputClass(!!error)}
            required
          />
          {error ? (
            <p id="my-phone-error" role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          ) : (
            <p id="my-phone-hint" className="text-sm text-soft">
              O mesmo número que você deu pro seu ministério. Só você vê as suas datas.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink px-8 text-[17px] font-extrabold text-paper disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle size={20} strokeWidth={2} aria-hidden="true" className="animate-spin" />
          ) : (
            <Search size={20} strokeWidth={2} aria-hidden="true" />
          )}
          Ver minhas datas
        </button>
      </form>
    );
  }

  // Agrupa por dia.
  const days: { day: string; items: Found["dates"] }[] = [];
  for (const d of found.dates) {
    const last = days[days.length - 1];
    if (last?.day === d.day) last.items.push(d);
    else days.push({ day: d.day, items: [d] });
  }

  return (
    <div role="status" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-2xl font-black">Olá, {found.firstName}!</p>
        <p className="text-[17px] text-soft">
          {found.dates.length === 0
            ? `Você não está escalado(a) em ${monthTitle} nas escalas já publicadas.`
            : `Você serve ${found.dates.length === 1 ? "1 vez" : `${found.dates.length} vezes`} em ${monthTitle}.`}
        </p>
      </div>

      {days.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {days.map((d) => (
            <li key={d.day} className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-5">
              <p className="text-xl font-black">{d.day}</p>
              {d.items.map((item) => (
                <div key={`${item.slotId}:${item.ministry}`} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[17px] font-extrabold">
                      {item.time} · {item.label}
                    </span>
                    <span className="text-[15px] text-soft">
                      {item.ministry}
                      {item.role ? (
                        <>
                          {" "}
                          · <b className="text-ink">{item.role}</b>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <a
                    href={calendarUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-extrabold hover:border-ink"
                  >
                    <CalendarPlus size={16} strokeWidth={2} aria-hidden="true" />
                    Pôr na agenda
                    <span className="sr-only"> (abre em outra aba)</span>
                  </a>
                </div>
              ))}
            </li>
          ))}
        </ol>
      ) : null}

      {found.waiting.length > 0 ? (
        <p className="flex items-start gap-2 rounded-2xl bg-sand px-4 py-3 text-[15px]">
          <Hourglass size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Ainda não saiu a escala de <b>{found.waiting.join(", ")}</b>. Volte aqui depois que o líder avisar no grupo.
          </span>
        </p>
      ) : null}

      <p className="text-sm text-soft">
        Não vai poder em alguma data? Fale com o líder do seu ministério o quanto antes, pra dar tempo de trocar.
      </p>

      <button
        type="button"
        onClick={() => setFound(null)}
        className="inline-flex min-h-12 w-fit items-center rounded-full border-2 border-ink px-6 text-[15px] font-extrabold"
      >
        Ver de outro número
      </button>
    </div>
  );
}
