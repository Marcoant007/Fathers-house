"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Cake,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "cn";
import { VolunteerDialog, type EditablePerson } from "@/components/admin/VolunteerDialog";
import { promoteVolunteer } from "@/lib/actions/volunteers";

export type RosterPerson = EditablePerson & {
  name: string;
  /** só dígitos com 55, pro link do WhatsApp */
  phone: string | null;
  status: "ACTIVE" | "INTERESTED";
  functions: string[];
  others: { ministry: string; functions: string[]; interested: boolean }[];
  /** "Semana e fim de semana · Domingo manhã e noite" */
  availabilityLabel: string | null;
  /** Aniversário ("12/03") e se é hoje ou neste mês (calculado no servidor). */
  birthday: { label: string; status: "today" | "month" | null } | null;
};

type RosterContext = {
  ministryId: string;
  ministryName: string;
  functions: { id: string; name: string }[];
  canSeeSensitive: boolean;
};

type Filter = "team" | "interested" | "pendingTerm" | "birthdays";

// Cabeçalho e linhas são grades separadas: colunas com largura fixa pra alinhar.
const COLUMNS = "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.25fr)_9rem_22rem]";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function initials(name: string) {
  const parts = name.split(" ").filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  const first = parts[0]?.[0] ?? name[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function VolunteerRoster({ people, ...context }: RosterContext & { people: RosterPerson[] }) {
  const { ministryName, canSeeSensitive } = context;
  const [filter, setFilter] = useState<Filter>("team");
  const [query, setQuery] = useState("");

  const team = people.filter((p) => p.status === "ACTIVE");
  const interested = people.filter((p) => p.status === "INTERESTED");
  const pendingTerm = team.filter((p) => p.termSigned === false);
  // Aniversariantes do mês na equipe, por dia.
  const birthdays = team
    .filter((p) => p.birthday?.status)
    .sort((a, b) => (a.birthday?.label ?? "").localeCompare(b.birthday?.label ?? ""));

  const base =
    filter === "team" ? team : filter === "interested" ? interested : filter === "pendingTerm" ? pendingTerm : birthdays;
  const q = normalize(query.trim());
  const shown = q ? base.filter((p) => normalize(p.name).includes(q)) : base;

  const filters: { value: Filter; label: string; count: number; icon: typeof Users; danger?: boolean }[] = [
    { value: "team", label: "Na equipe", count: team.length, icon: Users },
    { value: "interested", label: "Marcaram interesse", count: interested.length, icon: Sparkles },
    { value: "pendingTerm", label: "Termo pendente", count: pendingTerm.length, icon: AlertTriangle, danger: true },
    { value: "birthdays", label: "Aniversariantes do mês", count: birthdays.length, icon: Cake },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-stretch gap-3" role="group" aria-label="Filtrar a lista">
        {filters.map((f) => {
          const Icon = f.icon;
          const selected = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(f.value)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left",
                selected ? "border-ink bg-card shadow-sm" : "border-transparent bg-card/60 hover:border-line"
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  f.danger && f.count > 0 ? "bg-danger/10 text-danger" : "bg-accent/15 text-ink"
                )}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className={cn("text-xl font-extrabold", f.danger && f.count > 0 && "text-danger")}>{f.count}</span>
                <span className="text-sm font-bold text-soft">{f.label}</span>
              </span>
            </button>
          );
        })}

        <label className="ml-auto flex min-h-11 min-w-64 flex-1 items-center gap-2 self-center rounded-full border-2 border-line bg-card px-4 sm:max-w-sm">
          <Search size={16} strokeWidth={2} aria-hidden="true" className="text-soft" />
          <span className="sr-only">Buscar pelo nome</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pelo nome"
            className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-soft"
          />
        </label>
      </div>

      {filter === "interested" ? (
        <p className="text-sm text-soft">
          Escolheram {ministryName} no formulário de voluntariado, mas ainda não estão na equipe. Converse com a pessoa
          antes de escalar.
        </p>
      ) : null}
      {canSeeSensitive ? (
        <p className="text-sm text-soft">
          Antecedentes criminais ficam escondidos dentro de “Editar”: só aparecem quando você clica, e cada clique fica na Auditoria.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
        <div
          aria-hidden="true"
          className={cn("hidden gap-6 border-b border-line px-6 py-3 text-xs font-extrabold text-soft uppercase lg:grid", COLUMNS)}
        >
          <span>Pessoa</span>
          <span>Também serve em</span>
          <span>Termo</span>
          <span>Contato e ações</span>
        </div>

        {shown.length === 0 ? (
          <p className="p-8 text-soft">
            {q
              ? "Ninguém com esse nome nesta lista."
              : filter === "pendingTerm"
                ? "Ninguém com termo pendente. 🎉"
                : filter === "birthdays"
                  ? "Ninguém da equipe faz aniversário este mês."
                  : "Ninguém nesta lista ainda."}
          </p>
        ) : (
          <ul>
            {shown.map((person) => (
              <PersonRow key={person.membershipId} person={person} context={context} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PersonRow({ person, context }: { person: RosterPerson; context: RosterContext }) {
  const { ministryName } = context;
  return (
    <li className={cn("grid grid-cols-1 gap-4 border-b border-line px-6 py-5 last:border-0 lg:items-center lg:gap-6", COLUMNS)}>
      {/* Pessoa */}
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-extrabold text-ink"
        >
          {initials(person.name)}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-extrabold">
            {person.name}
            <BirthdayBadge birthday={person.birthday} />
          </p>
          {person.functions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {person.functions.map((f) => (
                <span key={f} className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-extrabold text-paper">
                  {f}
                </span>
              ))}
            </div>
          ) : null}
          <p className="flex items-center gap-1.5 text-sm text-soft">
            <CalendarClock size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            {person.availabilityLabel ?? "Não informou a disponibilidade"}
          </p>
        </div>
      </div>

      {/* Também serve em */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold text-soft uppercase lg:hidden">Também serve em</span>
        {person.others.length === 0 ? (
          <span className="text-sm text-soft">Só em {ministryName}</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {person.others.map((o) => (
              <li
                key={o.ministry}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-extrabold",
                  o.interested ? "border-2 border-dashed border-line text-soft" : "bg-accent/15 text-ink"
                )}
              >
                {o.ministry}
                {o.functions.length > 0 ? <span className="font-bold"> · {o.functions.join(", ")}</span> : null}
                {o.interested ? <span className="font-bold"> · interesse</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Termo */}
      <div>
        <TermBadge signed={person.termSigned} />
      </div>

      {/* Contato e ações */}
      <div className="flex flex-wrap items-start gap-2 lg:flex-nowrap">
        {person.phone ? (
          <a
            href={`https://wa.me/${person.phone}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp de ${person.name}: ${person.phoneLabel}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-extrabold whitespace-nowrap text-on-accent"
          >
            <MessageCircle size={16} strokeWidth={2} aria-hidden="true" />
            {person.phoneLabel}
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center text-sm text-soft">Sem telefone</span>
        )}
        {person.status === "INTERESTED" ? (
          <PromoteButton person={person} ministryName={ministryName} />
        ) : (
          <VolunteerDialog
            {...context}
            person={person}
            trigger={
              <>
                <Pencil size={16} strokeWidth={2} aria-hidden="true" /> Editar
                <span className="sr-only"> {person.name}</span>
              </>
            }
            triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-4 text-sm font-extrabold text-ink hover:border-ink"
          />
        )}
      </div>
    </li>
  );
}

/** Quem marcou interesse na inscrição entra de vez na equipe. */
function PromoteButton({ person, ministryName }: { person: RosterPerson; ministryName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await promoteVolunteer(person.membershipId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`${person.name} entrou na equipe de ${ministryName}.`);
          startTransition(() => router.refresh());
        })
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-4 text-sm font-extrabold whitespace-nowrap text-ink hover:bg-ink hover:text-paper disabled:opacity-70"
    >
      {pending ? (
        <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
      ) : (
        <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
      )}
      Colocar na equipe
      <span className="sr-only"> de {ministryName}: {person.name}</span>
    </button>
  );
}

/** Só aparece no mês do aniversário (o dia fica em "Editar → Mais detalhes"). */
function BirthdayBadge({ birthday }: { birthday: RosterPerson["birthday"] }) {
  if (!birthday?.status) return null;
  if (birthday.status === "today")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-extrabold text-on-accent">
        <Cake size={12} strokeWidth={2.5} aria-hidden="true" /> Aniversário hoje!
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-extrabold">
      <Cake size={12} strokeWidth={2.5} aria-hidden="true" /> Aniversário {birthday.label}
    </span>
  );
}

function TermBadge({ signed }: { signed: boolean | null }) {
  if (signed === true)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
        <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" /> Termo assinado
      </span>
    );
  if (signed === false)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-danger">
        <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" /> Termo pendente
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-soft">
      <CircleHelp size={16} strokeWidth={2} aria-hidden="true" /> Sem informação
    </span>
  );
}
