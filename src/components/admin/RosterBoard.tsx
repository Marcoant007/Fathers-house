"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeftRight, Ban, CalendarDays, Check, CircleHelp, GripVertical, Undo2, UserPlus, UsersRound } from "lucide-react";
import { cn } from "cn";
import { useRosterAction, rosterSpinner } from "@/components/admin/RosterBuilder";
import {
  assignManyToSlot,
  assignToSlot,
  setAssignmentFunction,
  setSlotServed,
  swapAssignment,
  unassign,
} from "@/lib/actions/roster-assignments";

// Tela C do "Montar escala": lista de cultos/eventos + painel do dia escolhido.
// Os dados vêm prontos do servidor (RosterPlanView); cada botão chama uma
// Server Action e a página recarrega os dados.

export type BoardSlot = {
  id: string;
  day: string; // "Dom 04/01"
  time: string; // "18h"
  label: string; // "Culto da Família" / "Café com Pastor"
  isEvent: boolean;
  past: boolean;
  skipped: boolean;
};
export type BoardPerson = {
  volunteerId: string;
  name: string;
  usualFunction: string;
  /** slotId → resposta. Ausente = não respondeu sobre esse culto. */
  answers: Record<string, "yes" | "no">;
};
export type BoardAssignment = { id: string; slotId: string; volunteerId: string; functionId: string | null; label: string };
export type BoardNeed = { functionId: string | null; label: string; count: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const DRAG_TYPE = "application/x-escala-pessoa";

/**
 * Aviso de carga, contando com esse dia:
 * amarelo = 3x no mês, ou colado no culto anterior/seguinte;
 * vermelho = 4x ou mais no mês, ou 3 cultos seguidos.
 */
type Streak = { level: "warning" | "danger"; text: string };

/** Quem vai sair quando se clica em "Trocar". */
type SwapTarget = { assignmentId: string; name: string; label: string };
const MONTH_WARNING = 3;
const MONTH_DANGER = 4;

const streakRow = (streak: Streak | null) =>
  streak?.level === "danger"
    ? "border-2 border-danger bg-danger/5"
    : streak?.level === "warning"
      ? "border-2 border-warning bg-warning/5"
      : null;

function StreakNote({ streak }: { streak: Streak | null }) {
  if (!streak) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-extrabold",
        streak.level === "danger" ? "text-danger" : "text-warning"
      )}
    >
      <AlertTriangle size={12} strokeWidth={2.5} aria-hidden="true" /> {streak.text}
    </span>
  );
}

export function RosterBoard({
  ministry,
  slots,
  people,
  assignments,
  needs,
  elsewhere,
  functionNames,
}: {
  ministry: { id: string; name: string };
  slots: BoardSlot[];
  people: BoardPerson[];
  assignments: BoardAssignment[];
  needs: BoardNeed[];
  /** `${slotId}:${volunteerId}` → nome do outro ministério */
  elsewhere: Record<string, string>;
  functionNames: string[];
}) {
  const bySlot = new Map<string, BoardAssignment[]>();
  for (const a of assignments) bySlot.set(a.slotId, [...(bySlot.get(a.slotId) ?? []), a]);
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const position = new Map(slots.map((s, i) => [s.id, i]));
  const daysOf = (volunteerId: string) =>
    assignments
      .filter((a) => a.volunteerId === volunteerId)
      .sort((a, b) => (position.get(a.slotId) ?? 0) - (position.get(b.slotId) ?? 0))
      .map((a) => slotById.get(a.slotId)?.day ?? "");

  // Cultos seguidos: a ordem dos dias em que o ministério serve (pula os "não servimos").
  const servedOrder = slots.filter((s) => !s.skipped).map((s) => s.id);
  const assigned = new Set(assignments.map((a) => `${a.slotId}:${a.volunteerId}`));
  const streakOf = (volunteerId: string, slotId: string): Streak | null => {
    const i = servedOrder.indexOf(slotId);
    if (i < 0) return null;
    const isIn = (j: number) => j >= 0 && j < servedOrder.length && assigned.has(`${servedOrder[j]}:${volunteerId}`);
    let before = 0;
    while (isIn(i - 1 - before)) before++;
    let after = 0;
    while (isIn(i + 1 + after)) after++;
    const run = before + 1 + after;
    // Quem ainda não está nesse dia: o aviso fala do que aconteceria se escalar.
    const here = assigned.has(`${slotId}:${volunteerId}`);
    const total = assignments.filter((a) => a.volunteerId === volunteerId).length + (here ? 0 : 1);

    const reasons: Streak[] = [];
    if (total >= MONTH_DANGER) reasons.push({ level: "danger", text: here ? `${total}x no mês` : `Ficaria ${total}x no mês` });
    else if (total >= MONTH_WARNING) reasons.push({ level: "warning", text: here ? `${total}x no mês` : `Ficaria ${total}x no mês` });
    if (run >= 3) reasons.push({ level: "danger", text: here ? `${run} cultos seguidos` : `Ficaria ${run} cultos seguidos` });
    else if (before > 0) reasons.push({ level: "warning", text: here ? "Também no culto anterior" : "Serviu no culto anterior" });
    else if (after > 0) reasons.push({ level: "warning", text: "Também está no culto seguinte" });
    if (reasons.length === 0) return null;
    return {
      level: reasons.some((r) => r.level === "danger") ? "danger" : "warning",
      text: reasons.map((r) => r.text).join(" · "),
    };
  };

  const totalNeeded = needs.reduce((sum, n) => sum + n.count, 0);
  const missingIn = (slotId: string) =>
    needs
      .map((n) => {
        const here = bySlot.get(slotId) ?? [];
        const have = here.filter((a) => n.functionId === null || a.functionId === n.functionId).length;
        return { label: n.label, missing: Math.max(0, n.count - have), single: n.functionId === null };
      })
      .filter((m) => m.missing > 0);

  const status = (slot: BoardSlot) => {
    const count = bySlot.get(slot.id)?.length ?? 0;
    if (slot.skipped) return { text: "Não servimos", short: "—", tone: "muted" as const };
    if (needs.length === 0) return { text: plural(count, "escalado", "escalados"), short: String(count), tone: "muted" as const };
    const missing = missingIn(slot.id);
    const short = `${count}/${totalNeeded}`;
    if (missing.length === 0) return { text: "Completo", short, tone: "ok" as const };
    const total = missing.reduce((s, m) => s + m.missing, 0);
    const text =
      missing.length === 1 && missing[0].single
        ? `${total === 1 ? "Falta" : "Faltam"} ${plural(total, "pessoa", "pessoas")}`
        : `${total === 1 ? "Falta" : "Faltam"} ${missing.map((m) => `${m.missing} ${m.label}`).join(", ")}`;
    return { text, short, tone: slot.past ? ("muted" as const) : ("missing" as const) };
  };

  const firstOpen =
    slots.find((s) => !s.past && !s.skipped && status(s).tone === "missing") ?? slots.find((s) => !s.past) ?? slots[0];
  const [selectedId, setSelectedId] = useState(firstOpen?.id ?? "");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<SwapTarget | null>(null);
  const { pending: dropping, run } = useRosterAction();
  const slot = slotById.get(selectedId) ?? firstOpen;

  if (!slot) return <p className="rounded-3xl bg-card p-8 text-soft shadow-sm">Esse mês não tem cultos nem eventos.</p>;

  const here = bySlot.get(slot.id) ?? [];
  const taken = new Set(here.map((a) => a.volunteerId));
  const answerOf = (p: BoardPerson): "yes" | "no" | "unknown" => p.answers[slot.id] ?? "unknown";
  const free = people.filter((p) => !taken.has(p.volunteerId));
  const groups = {
    yes: free.filter((p) => answerOf(p) === "yes"),
    unknown: free.filter((p) => answerOf(p) === "unknown"),
    no: free.filter((p) => answerOf(p) === "no"),
  };
  const byId = new Map(people.map((p) => [p.volunteerId, p]));
  const current = status(slot);
  // Depois da troca (ou se a pessoa saiu), o modo troca some sozinho.
  const activeSwap = swapFor && here.some((a) => a.id === swapFor.assignmentId) ? swapFor : null;
  const listId = `funcoes-${ministry.id}`;

  // Arrastar um nome pra "Escalados" (ou pra outro dia na lista) escala a pessoa
  // com a função que está escrita na linha dela.
  const dropProps = (targetSlotId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (dropTarget !== targetSlotId) setDropTarget(targetSlotId);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDropTarget((t) => (t === targetSlotId ? null : t));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      const raw = e.dataTransfer.getData(DRAG_TYPE);
      if (!raw) return;
      const { volunteerId, fn, name } = JSON.parse(raw) as { volunteerId: string; fn: string; name: string };
      const target = slotById.get(targetSlotId);
      run(
        () => assignToSlot({ slotId: targetSlotId, ministryId: ministry.id, volunteerId, functionLabel: fn }),
        () => toast.success(`${name} escalado(a) em ${target ? `${target.day} ${target.time}` : "esse dia"}.`)
      );
    },
  });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <datalist id={listId}>
        {functionNames.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <nav
        aria-label="Cultos e eventos do mês"
        className="flex gap-1.5 overflow-x-auto rounded-3xl bg-card p-3 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:w-72 lg:shrink-0 lg:flex-col lg:overflow-y-auto"
      >
        {slots.map((s) => {
          const st = status(s);
          const selected = s.id === slot.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedId(s.id);
                setSwapFor(null);
              }}
              {...(s.skipped ? {} : dropProps(s.id))}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex min-h-13 min-w-44 shrink-0 items-center justify-between gap-3 rounded-2xl border-2 px-3.5 py-2 text-left lg:min-w-0",
                selected ? "border-ink bg-paper" : "border-transparent hover:bg-sand/60",
                dropTarget === s.id && "border-dashed border-ink bg-accent/10",
                (s.past || s.skipped) && !selected && "opacity-60"
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-extrabold">
                  {s.day} <span className="font-bold text-soft">· {s.time}</span>
                </span>
                <span className="flex items-center gap-1 truncate text-xs font-bold text-soft">
                  {s.isEvent ? <CalendarDays size={12} strokeWidth={2} aria-hidden="true" className="shrink-0" /> : null}
                  <span className="truncate">{s.label}</span>
                </span>
              </span>
              <StatusPill tone={st.tone} label={st.text}>
                {st.short}
              </StatusPill>
            </button>
          );
        })}
      </nav>

      <section
        aria-labelledby="dia-titulo"
        className="flex min-w-0 flex-1 flex-col gap-5 rounded-3xl bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 id="dia-titulo" className="text-xl font-extrabold">
              {slot.day} · {slot.time}
            </h3>
            <p className="text-sm font-bold text-soft">
              {slot.label}
              {slot.isEvent ? " · evento da Agenda" : ""}
              {!slot.skipped && totalNeeded > 0 ? ` · meta de ${plural(totalNeeded, "pessoa", "pessoas")}` : ""}
            </p>
            {slot.past ? <p className="text-xs font-bold text-soft">Esse dia já passou.</p> : null}
          </div>
          <span
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-extrabold",
              current.tone === "ok" && "bg-accent/15",
              current.tone === "missing" && "bg-danger/10 text-danger",
              current.tone === "muted" && "bg-sand text-soft"
            )}
          >
            {current.tone === "ok" ? <Check size={14} strokeWidth={3} aria-hidden="true" className="mr-1 inline" /> : null}
            {current.text}
          </span>
        </div>

        {slot.skipped ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-sand px-4 py-4">
            <p className="flex items-start gap-2 text-[15px]">
              <Ban size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                Marcado: <b>{ministry.name} não serve nesse dia.</b> Ele fica fora da sugestão automática e da mensagem
                do WhatsApp.
              </span>
            </p>
            <ServedButton slotId={slot.id} ministryId={ministry.id} served />
          </div>
        ) : (
          <>
            <div
              {...dropProps(slot.id)}
              className={cn(
                "-m-2 flex flex-col gap-2 rounded-2xl border-2 border-dashed p-2 transition-colors",
                dropTarget === slot.id ? "border-ink bg-accent/10" : "border-transparent"
              )}
            >
              <h4 className="flex flex-wrap items-center gap-x-2 text-xs font-extrabold text-soft uppercase">
                Escalados ({here.length})
                {totalNeeded > 0 ? <span className="normal-case">· meta de {totalNeeded}, pode passar</span> : null}
                {dropping ? rosterSpinner : null}
              </h4>
              {here.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm text-soft">
                  Ninguém escalado ainda. Clique em “Escalar” ou arraste um nome pra cá.
                </p>
              ) : null}
              {here.map((a) => {
                const p = byId.get(a.volunteerId);
                if (!p) return null;
                return (
                  <AssignedRow
                    key={`${a.id}:${a.label}`}
                    assignment={a}
                    person={p}
                    answer={answerOf(p)}
                    times={daysOf(p.volunteerId).length}
                    streak={streakOf(p.volunteerId, slot.id)}
                    other={elsewhere[`${slot.id}:${p.volunteerId}`]}
                    listId={listId}
                    swapping={activeSwap?.assignmentId === a.id}
                    onSwap={() =>
                      setSwapFor(
                        activeSwap?.assignmentId === a.id ? null : { assignmentId: a.id, name: p.name, label: a.label }
                      )
                    }
                  />
                );
              })}
            </div>

            {activeSwap ? (
              <div
                role="status"
                className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink px-4 py-3 text-paper shadow-sm"
              >
                <p className="flex items-center gap-2 text-sm font-bold">
                  <ArrowLeftRight size={16} strokeWidth={2} aria-hidden="true" />
                  Trocando {activeSwap.name}: clique em “Pôr no lugar” em quem vai entrar.
                </p>
                <button
                  type="button"
                  onClick={() => setSwapFor(null)}
                  className="min-h-11 rounded-full border-2 border-paper/40 px-4 text-xs font-extrabold hover:border-paper"
                >
                  Cancelar troca
                </button>
              </div>
            ) : null}

            <PeopleGroup
              title={`Marcaram que podem (${groups.yes.length})`}
              tone="yes"
              people={groups.yes}
              empty="Ninguém mais marcou que pode nesse dia."
              slot={slot}
              ministryId={ministry.id}
              daysOf={daysOf}
              streakOf={streakOf}
              elsewhere={elsewhere}
              listId={listId}
              swapFor={activeSwap}
            />

            {groups.unknown.length > 0 ? (
              <details className="border-t border-line pt-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-xs font-extrabold text-soft uppercase">
                  Não responderam ({groups.unknown.length}) · podem entrar se faltar gente
                </summary>
                <PeopleGroup
                  tone="unknown"
                  people={groups.unknown}
                  slot={slot}
                  ministryId={ministry.id}
                  daysOf={daysOf}
                  streakOf={streakOf}
                  elsewhere={elsewhere}
                  listId={listId}
                  swapFor={activeSwap}
                />
              </details>
            ) : null}

            {groups.no.length > 0 ? (
              <details className="border-t border-line pt-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-xs font-extrabold text-soft uppercase">
                  Disseram que não podem ({groups.no.length})
                </summary>
                <PeopleGroup
                  tone="no"
                  people={groups.no}
                  slot={slot}
                  ministryId={ministry.id}
                  daysOf={daysOf}
                  streakOf={streakOf}
                  elsewhere={elsewhere}
                  listId={listId}
                  swapFor={activeSwap}
                />
              </details>
            ) : null}

            <div className="flex flex-col items-start gap-1 border-t border-line pt-4">
              <ServedButton slotId={slot.id} ministryId={ministry.id} served={false} disabled={here.length > 0} />
              <p className="text-xs text-soft">
                {here.length > 0
                  ? "Pra marcar que o ministério não serve, tire antes quem está escalado."
                  : "Use quando o ministério não trabalha nesse culto ou evento (ex.: Kids no Café com Pastor)."}
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StatusPill({ tone, label, children }: { tone: "ok" | "missing" | "muted"; label: string; children: React.ReactNode }) {
  return (
    <span
      title={label}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold",
        tone === "ok" && "bg-accent/15",
        tone === "missing" && "bg-danger/10 text-danger",
        tone === "muted" && "bg-sand text-soft"
      )}
    >
      {children}
      <span className="sr-only"> · {label}</span>
    </span>
  );
}

function FunctionInput({
  id,
  value,
  onChange,
  listId,
  name,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  listId: string;
  name: string;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-xs font-extrabold text-soft">
      Função
      <input
        id={id}
        list={listId}
        value={value}
        maxLength={40}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite a função"
        aria-label={`Função de ${name}`}
        className="min-h-11 w-44 rounded-xl border-2 border-line bg-card px-3 text-sm font-bold text-ink focus-visible:border-ink focus-visible:outline-none"
      />
    </label>
  );
}

function AssignedRow({
  assignment,
  person,
  answer,
  times,
  streak,
  other,
  listId,
  swapping,
  onSwap,
}: {
  assignment: BoardAssignment;
  person: BoardPerson;
  answer: "yes" | "no" | "unknown";
  times: number;
  streak: Streak | null;
  other?: string;
  listId: string;
  swapping: boolean;
  onSwap: () => void;
}) {
  const [fn, setFn] = useState(assignment.label);
  const { pending, run } = useRosterAction();
  const dirty = fn.trim() !== assignment.label;

  return (
    <form
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-accent/10 py-2 pr-3 pl-4",
        streakRow(streak),
        swapping && "ring-2 ring-ink ring-offset-2"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty) return;
        run(() => setAssignmentFunction(assignment.id, fn), () => toast.success("Função salva."));
      }}
    >
      <span className="flex min-w-40 flex-1 flex-col">
        <span className="font-extrabold">{person.name}</span>
        {answer === "no" ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-danger">
            <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" /> Disse que não pode nesse dia
          </span>
        ) : answer === "unknown" ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-soft">
            <CircleHelp size={12} strokeWidth={2} aria-hidden="true" /> Não respondeu
          </span>
        ) : null}
        <StreakNote streak={streak} />
        {other ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-danger">
            <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" /> Também em {other} nesse horário
          </span>
        ) : null}
      </span>
      <FunctionInput id={`fn-${assignment.id}`} value={fn} onChange={setFn} listId={listId} name={person.name} />
      {dirty ? (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-extrabold text-paper disabled:opacity-50"
        >
          {pending ? rosterSpinner : null}
          Salvar função
        </button>
      ) : null}
      <span className="text-xs font-bold text-soft">{times}x no mês</span>
      <button
        type="button"
        disabled={pending}
        onClick={onSwap}
        aria-pressed={swapping}
        aria-label={swapping ? `Cancelar troca de ${person.name}` : `Trocar ${person.name} por outra pessoa`}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-xs font-extrabold disabled:opacity-50",
          swapping ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink"
        )}
      >
        <ArrowLeftRight size={14} strokeWidth={2} aria-hidden="true" />
        {swapping ? "Cancelar" : "Trocar"}
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label={`Tirar ${person.name} desse dia`}
        onClick={() => run(() => unassign(assignment.id), () => toast.success(`${person.name} saiu desse dia.`))}
        className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-line bg-card px-4 text-xs font-extrabold hover:border-danger hover:text-danger disabled:opacity-50"
      >
        Tirar
      </button>
    </form>
  );
}

function PeopleGroup({
  title,
  tone,
  people,
  empty,
  slot,
  ministryId,
  daysOf,
  streakOf,
  elsewhere,
  listId,
  swapFor,
}: {
  title?: string;
  tone: "yes" | "unknown" | "no";
  people: BoardPerson[];
  empty?: string;
  slot: BoardSlot;
  ministryId: string;
  daysOf: (volunteerId: string) => string[];
  streakOf: (volunteerId: string, slotId: string) => Streak | null;
  elsewhere: Record<string, string>;
  listId: string;
  swapFor: SwapTarget | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-extrabold text-success uppercase">{title}</h4>
          {people.length > 1 ? <BulkAssignButton slotId={slot.id} ministryId={ministryId} people={people} /> : null}
        </div>
      ) : null}
      {people.length === 0 && empty ? <p className="text-sm text-soft">{empty}</p> : null}
      {people.map((p) => (
        <CandidateRow
          key={`${slot.id}:${p.volunteerId}`}
          person={p}
          tone={tone}
          slotId={slot.id}
          ministryId={ministryId}
          days={daysOf(p.volunteerId)}
          streak={streakOf(p.volunteerId, slot.id)}
          other={elsewhere[`${slot.id}:${p.volunteerId}`]}
          listId={listId}
          swapFor={swapFor}
        />
      ))}
    </div>
  );
}

/** Escala de uma vez todo mundo da lista, cada um com a função de costume. */
function BulkAssignButton({ slotId, ministryId, people }: { slotId: string; ministryId: string; people: BoardPerson[] }) {
  const [confirming, setConfirming] = useState(false);
  const { pending, run } = useRosterAction();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-card px-4 text-xs font-extrabold"
      >
        <UsersRound size={14} strokeWidth={2} aria-hidden="true" /> Escalar todos ({people.length})
      </button>
    );
  }
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-sand px-3 py-2">
      <span className="text-sm font-bold">Escalar as {people.length} pessoas, cada uma na função de costume?</span>
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
            () =>
              assignManyToSlot({
                slotId,
                ministryId,
                people: people.map((p) => ({ volunteerId: p.volunteerId, functionLabel: p.usualFunction })),
              }),
            (r) => {
              toast.success(`${plural(r.added ?? 0, "pessoa escalada", "pessoas escaladas")}. Ajuste as funções se precisar.`);
              setConfirming(false);
            }
          )
        }
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-extrabold text-paper disabled:opacity-60"
      >
        {pending ? rosterSpinner : null}
        Sim, escalar todos
      </button>
    </div>
  );
}

function CandidateRow({
  person,
  tone,
  slotId,
  ministryId,
  days,
  streak,
  other,
  listId,
  swapFor,
}: {
  person: BoardPerson;
  tone: "yes" | "unknown" | "no";
  slotId: string;
  ministryId: string;
  days: string[];
  streak: Streak | null;
  other?: string;
  listId: string;
  swapFor: SwapTarget | null;
}) {
  const [fn, setFn] = useState(person.usualFunction);
  const { pending, run } = useRosterAction();

  return (
    <form
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl py-2 pr-3 pl-4",
        streakRow(streak) ?? (tone === "yes" ? "border border-line" : "border border-dashed border-soft/50")
      )}
      onSubmit={(e) => {
        e.preventDefault();
        if (swapFor) {
          // Quem entra fica com a função de quem saiu (se tinha); senão, a escrita aqui.
          const label = swapFor.label || fn;
          run(
            () => swapAssignment({ assignmentId: swapFor.assignmentId, volunteerId: person.volunteerId, functionLabel: label }),
            () => toast.success(`Trocado: sai ${swapFor.name}, entra ${person.name}${label.trim() ? ` (${label.trim()})` : ""}.`)
          );
          return;
        }
        run(
          () => assignToSlot({ slotId, ministryId, volunteerId: person.volunteerId, functionLabel: fn }),
          () => toast.success(`${person.name} escalado(a)${fn.trim() ? ` em ${fn.trim()}` : ""}.`)
        );
      }}
    >
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ volunteerId: person.volunteerId, fn: fn.trim(), name: person.name }));
          e.dataTransfer.effectAllowed = "copy";
        }}
        title="Arraste pra “Escalados” ou pra outro dia da lista"
        className="flex min-w-40 flex-1 cursor-grab items-start gap-2 active:cursor-grabbing"
      >
        <GripVertical size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-soft" />
        <span className="flex flex-col">
          <span className="font-extrabold">{person.name}</span>
          <span className="text-xs text-soft">
            {days.length ? `Já escalado: ${days.join(", ")}` : "Ainda não foi escalado"}
          </span>
          <StreakNote streak={streak} />
          {other ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-danger">
              <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" /> Já está em {other} nesse horário
            </span>
          ) : null}
        </span>
      </span>
      <FunctionInput id={`fn-${slotId}-${person.volunteerId}`} value={fn} onChange={setFn} listId={listId} name={person.name} />
      <span className="text-xs font-bold text-soft">{days.length}x no mês</span>
      <button
        type="submit"
        disabled={pending}
        aria-label={swapFor ? `Pôr ${person.name} no lugar de ${swapFor.name}` : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold disabled:opacity-50",
          tone === "yes" || swapFor ? "bg-ink text-paper" : "border-2 border-ink bg-card text-ink"
        )}
      >
        {pending ? (
          rosterSpinner
        ) : swapFor ? (
          <ArrowLeftRight size={14} strokeWidth={2} aria-hidden="true" />
        ) : (
          <UserPlus size={14} strokeWidth={2} aria-hidden="true" />
        )}
        {swapFor ? "Pôr no lugar" : tone === "yes" ? "Escalar" : "Escalar mesmo assim"}
      </button>
    </form>
  );
}

function ServedButton({
  slotId,
  ministryId,
  served,
  disabled = false,
}: {
  slotId: string;
  ministryId: string;
  served: boolean;
  disabled?: boolean;
}) {
  const { pending, run } = useRosterAction();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        run(
          () => setSlotServed({ slotId, ministryId, served }),
          () => toast.success(served ? "Pronto: o ministério volta a servir nesse dia." : "Marcado: o ministério não serve nesse dia.")
        )
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-card px-4 text-sm font-extrabold hover:border-ink disabled:opacity-40"
    >
      {pending ? rosterSpinner : served ? <Undo2 size={16} strokeWidth={2} aria-hidden="true" /> : <Ban size={16} strokeWidth={2} aria-hidden="true" />}
      {served ? "Voltar a servir nesse dia" : "Nosso ministério não serve nesse dia"}
    </button>
  );
}
