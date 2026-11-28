import { AlertTriangle, CheckCircle2, Eye, Users } from "lucide-react";
import { cn } from "cn";
import { describeSlot, monthLabel } from "@/lib/roster-period";
import type { getRosterPlan } from "@/lib/queries/roster";
import {
  ClearRosterButton,
  CopyRosterButton,
  PublishRosterButton,
  SuggestRosterDialog,
} from "@/components/admin/RosterBuilder";
import { RosterBoard, type BoardAssignment, type BoardNeed, type BoardPerson, type BoardSlot } from "@/components/admin/RosterBoard";

// Montar a escala do ministério no mês (tela C): lista de cultos/eventos à
// esquerda, o dia escolhido à direita, função digitada na hora. Ainda é prévia:
// só o painel vê.

export type PlanPersonRow = {
  volunteerId: string;
  name: string;
  functions: { id: string; name: string }[];
  /** slotId → "yes" | "no". Ausente = não respondeu sobre esse culto. */
  answers: Map<string, "yes" | "no">;
};

type Slot = { id: string; label: string; startsAt: Date; eventId: string | null };
type Plan = Awaited<ReturnType<typeof getRosterPlan>>;

const publishedFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Componente de servidor: roda uma vez por pedido, então ler o relógio aqui é seguro.
const hasPassed = (d: Date) => d.getTime() <= Date.now();

/** "Maria Aparecida da Silva" → "Maria Silva" (cabe melhor na mensagem do grupo). */
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
};

export function RosterPlanView({
  period,
  ministry,
  slots,
  people,
  plan,
  open,
  deadline,
}: {
  period: { id: string; month: string };
  ministry: { id: string; name: string };
  slots: Slot[];
  people: PlanPersonRow[];
  plan: Plan;
  open: boolean;
  deadline: string;
}) {
  const skipped = new Set(plan.skipped);
  const published = !!plan.publication;
  const publishedLabel = plan.publication ? publishedFormatter.format(plan.publication.publishedAt) : "";
  const byId = new Map(people.map((p) => [p.volunteerId, p]));

  const assignments: BoardAssignment[] = plan.here.map((a) => ({
    id: a.id,
    slotId: a.slotId,
    volunteerId: a.volunteerId,
    functionId: a.functionId,
    label: a.functionLabel ?? a.function?.name ?? "",
  }));

  // O que cada culto precisa: por função, ou um número só.
  const needs: BoardNeed[] = plan.functions.length
    ? plan.functions.filter((f) => f.perService > 0).map((f) => ({ functionId: f.id, label: f.name, count: f.perService }))
    : plan.perService > 0
      ? [{ functionId: null, label: "pessoa", count: plan.perService }]
      : [];

  const boardSlots: BoardSlot[] = slots.map((s) => {
    const d = describeSlot(s.startsAt);
    return {
      id: s.id,
      day: d.day,
      time: d.time,
      label: s.label,
      isEvent: !!s.eventId,
      past: hasPassed(s.startsAt),
      skipped: skipped.has(s.id),
    };
  });

  const boardPeople: BoardPerson[] = people.map((p) => ({
    volunteerId: p.volunteerId,
    name: p.name,
    usualFunction: p.functions[0]?.name ?? "",
    answers: Object.fromEntries(p.answers),
  }));

  const elsewhere = Object.fromEntries(plan.elsewhere.map((a) => [`${a.slotId}:${a.volunteerId}`, a.ministry.name]));
  const functionNames = [
    ...new Set([...plan.functions.map((f) => f.name), ...assignments.map((a) => a.label).filter(Boolean)]),
  ];

  // Mensagem do grupo: dia a dia, só os dias em que o ministério serve.
  const slotById = new Map(boardSlots.map((s) => [s.id, s]));
  const bySlot = new Map<string, BoardAssignment[]>();
  for (const a of assignments) bySlot.set(a.slotId, [...(bySlot.get(a.slotId) ?? []), a]);
  const served = boardSlots.filter((s) => !s.skipped);
  const days: { day: string; slots: BoardSlot[] }[] = [];
  for (const s of served) {
    const last = days[days.length - 1];
    if (last?.day === s.day) last.slots.push(s);
    else days.push({ day: s.day, slots: [s] });
  }
  const whatsapp = [
    `*Escala ${ministry.name} — ${monthLabel(period.month)}*`,
    ...days.map((d) =>
      [
        "",
        `*${d.day}*`,
        ...d.slots.map((s) => {
          const names = (bySlot.get(s.id) ?? []).map((a) => {
            const p = byId.get(a.volunteerId);
            return `${p ? shortName(p.name) : "?"}${a.label ? ` (${a.label})` : ""}`;
          });
          return `• ${s.time} · ${s.label}: ${names.length ? names.join(", ") : "a definir"}`;
        }),
      ].join("\n")
    ),
  ].join("\n");

  // Quantas vezes cada um (neste ministério).
  const timesHere = new Map<string, string[]>();
  for (const a of assignments) {
    const s = slotById.get(a.slotId);
    if (s) timesHere.set(a.volunteerId, [...(timesHere.get(a.volunteerId) ?? []), s.day]);
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="previa-titulo">
      <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
            {published ? (
              <CheckCircle2 size={18} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Eye size={18} strokeWidth={2} aria-hidden="true" />
            )}
          </span>
          <div className="flex min-w-60 flex-1 flex-col gap-0.5">
            <h3 id="previa-titulo" className="flex flex-wrap items-center gap-2 font-extrabold">
              Escala · {ministry.name}
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                  published ? "bg-accent text-on-accent" : "bg-sand text-soft"
                )}
              >
                {published ? "Publicada" : "Rascunho"}
              </span>
            </h3>
            <p className="text-sm text-soft">
              {published ? (
                <>
                  Publicada em {publishedLabel}
                  {plan.publication?.publishedBy ? ` por ${plan.publication.publishedBy.name}` : ""}. A equipe vê as
                  próprias datas no link do mês; o que você mudar aqui aparece na hora pra ela.
                </>
              ) : (
                <>
                  Escolha um culto ou evento na lista e escale ao lado: clique em “Escalar” ou arraste o nome. Pode
                  escalar quantas pessoas quiser, e a função você digita na hora. É um rascunho: a equipe só vê depois
                  que você clicar em “Publicar escala”.
                </>
              )}
            </p>
          </div>
        </div>
        {open && !published ? (
          <p className="flex items-start gap-2 rounded-2xl bg-sand px-4 py-3 text-sm">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
            As respostas ainda podem chegar até {deadline}. Dá pra montar já, mas confira de novo depois do prazo.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <SuggestRosterDialog
            periodId={period.id}
            ministryId={ministry.id}
            ministryName={ministry.name}
            hasAssignments={assignments.length > 0}
            needs={
              plan.functions.length
                ? plan.functions.map((f) => ({ key: f.id, label: f.name, value: f.perService || 1 }))
                : [{ key: "", label: "Pessoas por culto", value: plan.perService || 2 }]
            }
          />
          <CopyRosterButton
            text={whatsapp}
            disabled={assignments.length === 0}
            linkPath={published ? `/escala/${period.month}` : undefined}
          />
          <PublishRosterButton
            periodId={period.id}
            ministryId={ministry.id}
            ministryName={ministry.name}
            published={published}
            disabled={!published && assignments.length === 0}
          />
          {assignments.length > 0 ? <ClearRosterButton periodId={period.id} ministryId={ministry.id} /> : null}
        </div>
      </div>

      <RosterBoard
        ministry={ministry}
        slots={boardSlots}
        people={boardPeople}
        assignments={assignments}
        needs={needs}
        elsewhere={elsewhere}
        functionNames={functionNames}
      />

      <details className="rounded-3xl bg-card p-5 shadow-sm">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-extrabold">
          <Users size={16} strokeWidth={2} aria-hidden="true" /> Quantas vezes cada um no mês
        </summary>
        <p className="mt-1 text-xs text-soft">Pra dividir igual. Conta só neste ministério.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...people]
            .sort((a, b) => (timesHere.get(b.volunteerId)?.length ?? 0) - (timesHere.get(a.volunteerId)?.length ?? 0))
            .map((p) => {
              const times = timesHere.get(p.volunteerId) ?? [];
              return (
                <li key={p.volunteerId} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      times.length ? "bg-accent text-on-accent" : "bg-sand text-soft"
                    )}
                  >
                    {times.length}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-extrabold">{p.name}</span>
                    <span className="text-xs text-soft">{times.length ? times.join(", ") : "Ainda não escalado"}</span>
                  </span>
                </li>
              );
            })}
        </ul>
      </details>
    </section>
  );
}
