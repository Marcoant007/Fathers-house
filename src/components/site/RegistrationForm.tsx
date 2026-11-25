"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { cn } from "cn";
import { registerForEvent, type RegisterState } from "@/lib/actions/registrations";
import { RETENTION_DAYS } from "@/lib/registration-rules";
import { useFormSubmit } from "@/lib/use-form-submit";

const inputClass = (error?: string) =>
  cn(
    "h-14 w-full rounded-2xl border-2 bg-card px-5 text-[17px] outline-none",
    error ? "border-danger" : "border-line focus:border-ink"
  );

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm font-bold text-danger">
      {message}
    </p>
  ) : null;
}

export function RegistrationForm({
  slug,
  askPartySize,
  askFirstTime,
  maxPartySize,
  source,
  openedAt,
  calendarHref,
  whatsappHref,
}: {
  slug: string;
  askPartySize: boolean;
  askFirstTime: boolean;
  maxPartySize: number;
  source: "site" | "qr";
  openedAt: number;
  calendarHref: string;
  whatsappHref: string | null;
}) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerForEvent.bind(null, slug),
    undefined
  );
  const { formProps, fieldErrors } = useFormSubmit(state, formAction);

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col gap-5 rounded-3xl border border-line bg-card p-7">
        <CheckCircle2 size={40} strokeWidth={2} className="text-success" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-black">
            {state.already ? "Você já está inscrito(a)!" : "Inscrição confirmada!"}
          </p>
          <p className="text-[17px] text-soft">
            {state.already
              ? "Esse WhatsApp já estava na lista deste evento. Te esperamos!"
              : `${state.firstName ? `${state.firstName}, t` : "T"}e esperamos lá! Se precisar, a equipe fala com você pelo WhatsApp.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={calendarHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15px] font-extrabold text-on-accent"
          >
            <CalendarPlus size={18} strokeWidth={2} aria-hidden="true" />
            Adicionar à agenda
          </a>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-ink px-6 text-[15px] font-extrabold"
            >
              Falar no WhatsApp
            </a>
          ) : null}
          <Link href="/agenda" className="inline-flex min-h-12 items-center justify-center px-2 link-more">
            Ver a agenda
          </Link>
        </div>
      </div>
    );
  }

  const err = fieldErrors;

  return (
    <form {...formProps} className="flex flex-col gap-6" noValidate>
      {state && !state.ok ? (
        <p role="alert" className="rounded-2xl bg-danger/10 px-5 py-4 text-[15px] font-bold text-danger">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="t" value={openedAt} />
      {/* Armadilha pra robô: pessoa não vê nem alcança pelo teclado. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Não preencha</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-[15px] font-extrabold">
          Seu nome
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          required
          maxLength={120}
          aria-invalid={!!err?.name}
          aria-describedby={err?.name ? "name-error" : undefined}
          className={inputClass(err?.name)}
        />
        <FieldError id="name-error" message={err?.name} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="phone" className="text-[15px] font-extrabold">
          WhatsApp, com DDD
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(27) 99999-0000"
          required
          aria-invalid={!!err?.phone}
          aria-describedby={err?.phone ? "phone-error" : undefined}
          className={inputClass(err?.phone)}
        />
        <FieldError id="phone-error" message={err?.phone} />
      </div>

      {askPartySize ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="partySize" className="text-[15px] font-extrabold">
            Quantas pessoas vêm, contando você?
          </label>
          <select
            id="partySize"
            name="partySize"
            defaultValue="1"
            aria-invalid={!!err?.partySize}
            className={inputClass(err?.partySize)}
          >
            {Array.from({ length: Math.max(maxPartySize, 1) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Só eu" : `${n} pessoas`}
              </option>
            ))}
          </select>
          <FieldError id="partySize-error" message={err?.partySize} />
        </div>
      ) : null}

      {askFirstTime ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-extrabold">É sua primeira vez na igreja?</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "sim", label: "Sim" },
              { value: "nao", label: "Não" },
            ].map((o) => (
              <label
                key={o.value}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-card px-5 text-[17px] font-bold has-[:checked]:border-ink has-[:checked]:bg-sand"
              >
                <input
                  type="radio"
                  name="firstTime"
                  value={o.value}
                  className="size-5 accent-ink"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input
            type="checkbox"
            name="consent"
            required
            aria-invalid={!!err?.consent}
            className="mt-0.5 size-5 shrink-0 accent-ink"
          />
          <span>
            Autorizo a igreja a usar meu nome e WhatsApp só pra falar comigo sobre este evento. Os dados são apagados{" "}
            {RETENTION_DAYS} dias depois dele.
          </span>
        </label>
        <FieldError id="consent-error" message={err?.consent} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-full bg-ink px-8 text-[17px] font-extrabold text-paper disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Confirmar inscrição"}
      </button>
    </form>
  );
}
