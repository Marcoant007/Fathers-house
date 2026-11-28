"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Eraser, EyeOff, LoaderCircle, Send, Sparkles } from "lucide-react";
import { fieldInputClass } from "@/components/admin/FormField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { clearRoster, setRosterPublished, suggestRosterAction } from "@/lib/actions/roster-assignments";

// Botões do topo do "Montar escala" (sugerir, copiar, limpar) e o jeito comum
// de chamar uma ação e recarregar a página. O quadro fica em RosterBoard.

const spinner = <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />;
export const rosterSpinner = spinner;

export function useRosterAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run<T extends { error?: string }>(task: () => Promise<T>, onOk: (result: T) => void) {
    startTransition(async () => {
      const result = await task();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onOk(result);
      startTransition(() => router.refresh());
    });
  }
  return { pending, run };
}

/** Copia a escala pro grupo. Publicada, vai junto o link pra cada um ver as próprias datas. */
export function CopyRosterButton({ text, disabled, linkPath }: { text: string; disabled: boolean; linkPath?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        try {
          const link = linkPath ? `\n\nVeja as suas datas (é só digitar o seu WhatsApp):\n${window.location.origin}${linkPath}` : "";
          await navigator.clipboard.writeText(text + link);
          toast.success("Escala copiada! É só colar no grupo.");
        } catch {
          toast.error("Não deu pra copiar. Tente de novo.");
        }
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-5 text-sm font-extrabold hover:border-ink disabled:opacity-40"
    >
      <Copy size={16} strokeWidth={2} aria-hidden="true" /> Copiar escala pro WhatsApp
    </button>
  );
}

/** Publicar a escala (a equipe passa a ver as próprias datas no link do mês) ou tirar do ar. */
export function PublishRosterButton({
  periodId,
  ministryId,
  ministryName,
  published,
  disabled,
}: {
  periodId: string;
  ministryId: string;
  ministryName: string;
  published: boolean;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRosterAction();

  const act = () =>
    run(
      () => setRosterPublished({ periodId, ministryId, published: !published }),
      () => {
        toast.success(
          published
            ? "Escala tirada do ar. A equipe não vê mais as datas no link."
            : "Escala publicada! Agora copie a mensagem pro grupo do WhatsApp."
        );
        setConfirming(false);
      }
    );

  if (!confirming) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setConfirming(true)}
        className={
          published
            ? "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-soft hover:text-danger"
            : "inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-extrabold text-paper disabled:opacity-40"
        }
      >
        {published ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Send size={16} strokeWidth={2} aria-hidden="true" />}
        {published ? "Tirar do ar" : "Publicar escala"}
      </button>
    );
  }
  return (
    <div role="alert" className="flex w-full flex-col gap-3 rounded-2xl bg-sand px-4 py-3">
      <p className="text-sm">
        {published ? (
          <>
            Tirar a escala de <b>{ministryName}</b> do ar? A equipe deixa de ver as datas no link. A escala montada
            continua aqui.
          </>
        ) : (
          <>
            Publicar a escala de <b>{ministryName}</b>? Cada pessoa da equipe passa a ver as próprias datas no link do
            mês, digitando o WhatsApp. Se você mudar algo depois, a mudança aparece na hora pra ela.
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-full px-4 text-sm font-extrabold text-soft"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={act}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-extrabold text-paper disabled:opacity-60"
        >
          {pending ? spinner : null}
          {published ? "Sim, tirar do ar" : "Sim, publicar"}
        </button>
      </div>
    </div>
  );
}

export function ClearRosterButton({ periodId, ministryId }: { periodId: string; ministryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRosterAction();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-soft hover:text-danger"
      >
        <Eraser size={16} strokeWidth={2} aria-hidden="true" /> Limpar escala
      </button>
    );
  }
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-danger/10 px-3 py-2">
      <span className="text-sm font-bold text-danger">Tirar todo mundo dos cultos que ainda não passaram?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-full px-3 text-sm font-extrabold text-soft"
      >
        Cancelar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            () => clearRoster(periodId, ministryId),
            (r) => {
              toast.success(r.removed ? `Escala limpa (${r.removed} tirada(s)).` : "A escala já estava vazia.");
              setConfirming(false);
            }
          )
        }
        className="flex min-h-11 items-center gap-2 rounded-full bg-danger px-4 text-sm font-extrabold text-paper disabled:opacity-80"
      >
        {pending ? spinner : null}
        Sim, limpar
      </button>
    </div>
  );
}

type NeedField = { key: string; label: string; value: number };

/** Monta a escala sozinho com quem marcou que pode; o líder ajusta depois. */
export function SuggestRosterDialog({
  periodId,
  ministryId,
  ministryName,
  needs,
  hasAssignments,
}: {
  periodId: string;
  ministryId: string;
  ministryName: string;
  /** Por função (key = functionId) ou um campo só (key = "") quando não há funções. */
  needs: NeedField[];
  hasAssignments: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-extrabold text-on-accent">
        <Sparkles size={16} strokeWidth={2} aria-hidden="true" /> Sugerir escala automática
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sugerir escala · {ministryName}</DialogTitle>
        </DialogHeader>
        <SuggestForm
          periodId={periodId}
          ministryId={ministryId}
          needs={needs}
          hasAssignments={hasAssignments}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SuggestForm({
  periodId,
  ministryId,
  needs,
  hasAssignments,
  onDone,
}: {
  periodId: string;
  ministryId: string;
  needs: NeedField[];
  hasAssignments: boolean;
  onDone: () => void;
}) {
  const [values, setValues] = useState(() => Object.fromEntries(needs.map((n) => [n.key, String(n.value)])));
  const [maxPerWeekday, setMax] = useState("2");
  const [mode, setMode] = useState<"fill" | "redo">("fill");
  const { pending, run } = useRosterAction();
  const single = needs.length === 1 && needs[0].key === "";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => suggestRosterAction({ periodId, ministryId, mode, maxPerWeekday, needs: values }),
          (r) => {
            const added = r.added ?? 0;
            toast.success(
              added === 0
                ? "Nada novo pra escalar: as vagas já estão preenchidas ou não sobrou ninguém disponível."
                : `Sugestão pronta: ${added} ${added === 1 ? "pessoa escalada" : "escalações"}. Confira e ajuste o que precisar.`
            );
            if (r.missingSlots) {
              toast.warning(
                `Faltou gente em ${r.missingSlots} ${r.missingSlots === 1 ? "culto" : "cultos"}. Eles aparecem marcados com “Falta”.`
              );
            }
            onDone();
          }
        );
      }}
    >
      <p className="text-[15px] text-soft">
        O sistema escolhe primeiro quem marcou que pode, dividindo igual. Quem não respondeu só entra se faltar gente, e
        quem disse que não pode nunca entra. Depois você ajusta à mão.
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-extrabold">Quantas pessoas cada culto precisa?</legend>
        {needs.map((n) => (
          <div key={n.key} className="flex items-center justify-between gap-3">
            <label htmlFor={`need-${n.key || "all"}`} className="text-[15px] font-bold">
              {single ? "Pessoas por culto" : n.label}
            </label>
            <input
              id={`need-${n.key || "all"}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              value={values[n.key]}
              onChange={(e) => setValues((v) => ({ ...v, [n.key]: e.target.value }))}
              className={fieldInputClass() + " w-24 text-center"}
            />
          </div>
        ))}
        {!single ? <p className="text-xs text-soft">0 = essa função não entra na sugestão.</p> : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="max-per-weekday" className="text-sm font-extrabold">
          Máximo de vezes por pessoa no mês
        </label>
        <input
          id="max-per-weekday"
          type="number"
          inputMode="numeric"
          min={1}
          max={5}
          value={maxPerWeekday}
          onChange={(e) => setMax(e.target.value)}
          className={fieldInputClass() + " w-24 text-center"}
        />
        <p className="text-xs text-soft">
          Conta por dia da semana: com 2, a pessoa serve até 2 domingos e até 2 terças (somando os outros ministérios).
          Manhã e noite do mesmo domingo, a sugestão não junta.
        </p>
      </div>

      {hasAssignments ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-extrabold">Já tem gente escalada. O que fazer?</legend>
          {(
            [
              ["fill", "Só completar as vagas que faltam", "Mantém quem você já escalou."],
              ["redo", "Refazer do zero", "Tira todo mundo dos cultos que ainda não passaram e monta de novo."],
            ] as const
          ).map(([key, title, hint]) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line p-3 has-[:checked]:border-ink"
            >
              <input
                type="radio"
                name="mode"
                value={key}
                checked={mode === key}
                onChange={() => setMode(key)}
                className="mt-1 size-4 accent-current"
              />
              <span className="flex flex-col">
                <span className="text-[15px] font-extrabold">{title}</span>
                <span className="text-sm text-soft">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 font-extrabold text-paper disabled:opacity-60"
      >
        {pending ? spinner : <Sparkles size={16} strokeWidth={2} aria-hidden="true" />}
        Montar sugestão
      </button>
    </form>
  );
}
