"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, LoaderCircle, MessageCircle, RefreshCw } from "lucide-react";
import { fieldInputClass } from "@/components/admin/FormField";
import { syncRosterSlots, updateRosterDeadline } from "@/lib/actions/roster-periods";

/** Link público do mês + mensagem pronta pros grupos + prazo (admin muda). */
export function RosterLinkCard({
  periodId,
  month,
  monthName,
  open,
  deadlineLabel,
  deadlineInput,
  canEdit,
}: {
  periodId: string;
  month: string;
  monthName: string;
  open: boolean;
  /** "quinta-feira, 25/11" */
  deadlineLabel: string;
  /** "2026-11-25" */
  deadlineInput: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [deadline, setDeadline] = useState(deadlineInput);
  const [pending, startTransition] = useTransition();
  const path = `/escala/${month}`;

  const url = () => `${window.location.origin}${path}`;
  const message = () =>
    `Escala de ${monthName}! 🙌\nMarque até ${deadlineLabel} em quais cultos e eventos você pode servir:\n${url()}\n\nQuem não responder pode ser escalado em qualquer data.`;

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("Não deu pra copiar. Selecione o link e copie na mão.");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent/15">
          <Link2 size={18} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-extrabold">Link pra mandar nos grupos</p>
          <p className="truncate text-sm text-soft">{path}</p>
        </div>
        <span
          className={
            "rounded-full px-3 py-1 text-xs font-extrabold " +
            (open ? "bg-accent/15 text-ink" : "bg-sand text-soft")
          }
        >
          {open ? `Aberta até ${deadlineLabel}` : `Encerrada em ${deadlineLabel}`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(message(), "Mensagem copiada! É só colar no grupo.")}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-extrabold text-on-accent"
        >
          <MessageCircle size={16} strokeWidth={2} aria-hidden="true" /> Copiar mensagem pro WhatsApp
        </button>
        <button
          type="button"
          onClick={() => copy(url(), "Link copiado!")}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-5 text-sm font-extrabold hover:border-ink"
        >
          <Copy size={16} strokeWidth={2} aria-hidden="true" /> Copiar só o link
        </button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-5 text-sm font-extrabold hover:border-ink"
        >
          <ExternalLink size={16} strokeWidth={2} aria-hidden="true" /> Ver como o voluntário vê
        </a>
      </div>

      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await updateRosterDeadline(periodId, deadline);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Prazo atualizado.");
              startTransition(() => router.refresh());
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="roster-deadline" className="text-sm font-extrabold">
              Prazo pra responder
            </label>
            <input
              id="roster-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={fieldInputClass() + " w-48"}
            />
          </div>
          <button
            type="submit"
            disabled={pending || deadline === deadlineInput || !deadline}
            className="flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-extrabold text-paper disabled:opacity-40"
          >
            {pending ? <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" /> : null}
            Mudar prazo
          </button>
        </form>
      ) : null}
      {canEdit ? <SyncSlotsButton periodId={periodId} /> : null}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Traz pra lista do mês o que mudou em Cultos depois que o mês foi aberto. */
function SyncSlotsButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
      <p className="min-w-60 flex-1 text-sm text-soft">
        Eventos publicados na Agenda já entram sozinhos. Mudou algo em <b className="text-ink">Cultos</b> depois de abrir o mês? Atualize a lista aqui.
        Só mudam as datas que ainda não passaram, e quem já respondeu aparece com “?” nos itens novos.
      </p>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await syncRosterSlots(periodId);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            const { added = 0, removed = 0, renamed = 0, keptWithMarks = 0 } = result;
            const changes = [
              added ? plural(added, "item novo", "itens novos") : null,
              removed ? plural(removed, "removido", "removidos") : null,
              renamed ? plural(renamed, "renomeado", "renomeados") : null,
            ].filter(Boolean);
            if (changes.length === 0) toast.success("Nada pra atualizar: a lista do mês já bate com Cultos e Agenda.");
            else toast.success(`Lista do mês atualizada: ${changes.join(", ")}.`);
            if (keptWithMarks > 0) {
              toast.warning(
                `${plural(keptWithMarks, "item saiu", "itens saíram")} de Cultos/Agenda mas ficou na lista, porque já tem gente que marcou.`
              );
            }
            startTransition(() => router.refresh());
          })
        }
        className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-5 text-sm font-extrabold disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
        ) : (
          <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
        )}
        Atualizar cultos e eventos do mês
      </button>
    </div>
  );
}
