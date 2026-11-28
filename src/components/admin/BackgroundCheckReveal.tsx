"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { revealBackgroundCheck } from "@/lib/actions/volunteers";

const buttonClass =
  "inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-extrabold text-ink hover:border-ink disabled:opacity-60";

/** O "olhinho": a resposta só é buscada no clique, e cada clique vai pra Auditoria. */
export function BackgroundCheckReveal({ volunteerId, volunteerName }: { volunteerId: string; volunteerName: string }) {
  const [answer, setAnswer] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (answer !== undefined) {
    return (
      <div className="flex w-full flex-col items-start gap-2 rounded-xl bg-sand px-4 py-3">
        <p className="text-xs font-extrabold text-soft uppercase">Antecedentes</p>
        <p className="text-sm">{answer?.trim() ? answer : "Não respondeu no formulário."}</p>
        <button type="button" onClick={() => setAnswer(undefined)} className={buttonClass}>
          <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> Esconder
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`Ver resposta de antecedentes de ${volunteerName}`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await revealBackgroundCheck(volunteerId);
            if ("error" in result) setError(result.error);
            else setAnswer(result.answer);
          })
        }
        className={buttonClass}
      >
        <Eye size={16} strokeWidth={2} aria-hidden="true" /> {pending ? "Abrindo…" : "Antecedentes"}
      </button>
      {error ? (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
