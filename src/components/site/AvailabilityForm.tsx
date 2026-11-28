"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, Pencil } from "lucide-react";
import { cn } from "cn";
import { lookupRespondent, submitAvailability, type LookupResult } from "@/lib/actions/availability";

export type SlotDay = {
  dateKey: string;
  /** "Dom 06/12" */
  label: string;
  slots: { id: string; time: string; label: string }[];
};

type Person = Extract<LookupResult, { ok: true }> & { phone: string };

const inputClass = (error?: boolean) =>
  cn(
    "h-14 w-full rounded-2xl border-2 bg-card px-5 text-[17px] outline-none",
    error ? "border-danger" : "border-line focus:border-ink"
  );

const primaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink px-8 text-[17px] font-extrabold text-paper disabled:opacity-60";

/** Formulário do link geral: 1) WhatsApp  2) marcar os cultos  3) pronto. */
export function AvailabilityForm({ month, days, deadline }: { month: string; days: SlotDay[]; deadline: string }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = days.reduce((n, d) => n + d.slots.length, 0);

  // ---- 1) número ----
  if (!person) {
    return (
      <form
        className="flex flex-col gap-5 rounded-3xl border border-line bg-card p-6 md:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          const phone = String(new FormData(e.currentTarget).get("phone") ?? "");
          setError(null);
          startTransition(async () => {
            const result = await lookupRespondent(month, phone);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setPerson({ ...result, phone });
            setSelected(new Set(result.selected));
            setNote(result.note);
          });
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-[15px] font-extrabold">
            Seu WhatsApp
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(27) 99999-0000"
            aria-invalid={!!error}
            aria-describedby={error ? "phone-error" : "phone-hint"}
            className={inputClass(!!error)}
            required
          />
          {error ? (
            <p id="phone-error" role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          ) : (
            <p id="phone-hint" className="text-sm text-soft">
              O mesmo número que você deu pro seu ministério. Vamos mostrar os seus ministérios pra conferir.
            </p>
          )}
        </div>
        <button type="submit" disabled={pending} aria-busy={pending} className={primaryButton}>
          {pending ? <LoaderCircle size={20} strokeWidth={2} aria-hidden="true" className="animate-spin" /> : null}
          Continuar
        </button>
      </form>
    );
  }

  // ---- 3) pronto ----
  if (done) {
    return (
      <div role="status" className="flex flex-col gap-5 rounded-3xl border border-line bg-card p-7">
        <CheckCircle2 size={40} strokeWidth={2} className="text-success" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-black">Pronto, {person.firstName}! Recebemos.</p>
          <p className="text-[17px] text-soft">
            {done.count === 0
              ? "Você marcou que não pode servir em nenhum culto deste mês."
              : `Você pode servir em ${done.count} de ${total} cultos.`}{" "}
            Se mudar alguma coisa, dá pra responder de novo até {deadline}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDone(null)}
          className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full border-2 border-ink px-6 text-[15px] font-extrabold"
        >
          <Pencil size={16} strokeWidth={2} aria-hidden="true" /> Mudar minha resposta
        </button>
      </div>
    );
  }

  // ---- 2) marcar os cultos ----
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const current = person;
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const website = String(new FormData(e.currentTarget).get("website") ?? "");
        setError(null);
        startTransition(async () => {
          const result = await submitAvailability(month, {
            phone: current.phone,
            slotIds: [...selected],
            note,
            website,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone({ count: result.count });
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }}
    >
      <div className="flex flex-col gap-3 rounded-3xl bg-sand p-6">
        <p className="text-2xl font-black">Olá, {current.firstName}!</p>
        <p className="text-[15px] text-soft">
          Você serve em: <b className="text-ink">{current.ministries.join(" · ")}</b>
        </p>
        {current.answered ? (
          <p className="text-[15px] text-soft">Você já tinha respondido: dá pra mudar abaixo e enviar de novo.</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setPerson(null);
            setError(null);
          }}
          className="w-fit text-sm font-bold underline underline-offset-4"
        >
          Não é você? Trocar o número
        </button>
      </div>

      {/* Robô preenche; gente não vê. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Não preencha</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-[17px] font-extrabold">Em quais cultos você pode servir?</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set(days.flatMap((d) => d.slots.map((s) => s.id))))}
            className="min-h-11 rounded-full border-2 border-line px-4 text-sm font-extrabold hover:border-ink"
          >
            Marcar todos
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="min-h-11 rounded-full border-2 border-line px-4 text-sm font-extrabold hover:border-ink"
          >
            Desmarcar todos
          </button>
        </div>

        <ul className="flex flex-col gap-3">
          {days.map((day) => (
            <li key={day.dateKey} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
              <p className="w-28 shrink-0 text-[17px] font-black">{day.label}</p>
              <div className="flex flex-1 flex-wrap gap-2">
                {day.slots.map((slot) => {
                  const checked = selected.has(slot.id);
                  return (
                    <label
                      key={slot.id}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 text-[15px] font-bold",
                        checked ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(slot.id)}
                        aria-label={`${day.label}, ${slot.time}, ${slot.label}`}
                        className="size-5 shrink-0 accent-accent"
                      />
                      <span>
                        <span className="font-black">{slot.time}</span>
                        <span className={cn("font-bold", checked ? "text-paper/80" : "text-soft")}> · {slot.label}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="note" className="text-[15px] font-extrabold">
          Algum recado pro líder? <span className="font-bold text-soft">(opcional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="ex.: no dia 20 só posso de manhã"
          className="w-full rounded-2xl border-2 border-line bg-card px-5 py-4 text-[17px] outline-none focus:border-ink"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-danger/10 px-5 py-4 text-[15px] font-bold text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pending} aria-busy={pending} className={primaryButton}>
          {pending ? <LoaderCircle size={20} strokeWidth={2} aria-hidden="true" className="animate-spin" /> : null}
          Enviar ({selected.size} de {total} {total === 1 ? "culto" : "cultos"})
        </button>
        {selected.size === 0 ? (
          <p className="text-sm text-soft">Sem nenhum marcado, vamos entender que você não pode servir este mês.</p>
        ) : null}
      </div>
    </form>
  );
}
