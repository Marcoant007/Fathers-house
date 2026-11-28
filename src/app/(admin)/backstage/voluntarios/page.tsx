import type { Metadata } from "next";
import Link from "next/link";
import type { SundayShift, VolunteerAvailability } from "@/generated/prisma/client";
import { getActor } from "@/lib/auth-and-audit";
import { getMinistryFunctions, getMinistryRoster, getRosterMinistries, type RosterEntry } from "@/lib/queries/volunteers";
import { formatPhone } from "@/lib/registration-rules";
import { birthdayLabel, birthdayStatus } from "@/lib/volunteer-details";
import { cn } from "cn";
import { MinistryIcon } from "@/components/site/MinistryIcon";
import { VolunteerRoster, type RosterPerson } from "@/components/admin/VolunteerRoster";
import { VolunteerDialog } from "@/components/admin/VolunteerDialog";
import { MinistryFunctionsDialog } from "@/components/admin/MinistryFunctionsDialog";
import { ListChecks, UserPlus } from "lucide-react";

export const metadata: Metadata = { title: "Voluntários" };

const AVAILABILITY: Record<VolunteerAvailability, string> = {
  WEEK_AND_WEEKEND: "Semana e fim de semana",
  WEEKEND_ONLY: "Só fim de semana",
  WEEKDAYS_ONLY: "Só durante a semana",
};

const SUNDAY_SHIFT: Record<SundayShift, string> = {
  MORNING: "Domingo de manhã",
  NIGHT: "Domingo à noite",
  BOTH: "Domingo manhã e noite",
};

function functionNames(functions: { function: { name: string; sortOrder: number } }[]) {
  return functions
    .map((f) => f.function)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => f.name);
}

/** Só o que a lista precisa (nada de antecedentes: esse vem só pelo "olhinho"). */
function toPerson(entry: RosterEntry): RosterPerson {
  const v = entry.volunteer;
  const availabilityLabel = [v.availability ? AVAILABILITY[v.availability] : null, v.sundayShift ? SUNDAY_SHIFT[v.sundayShift] : null]
    .filter(Boolean)
    .join(" · ");
  return {
    id: v.id,
    membershipId: entry.id,
    name: v.name,
    phone: v.phone,
    phoneLabel: v.phone ? formatPhone(v.phone) : null,
    status: entry.status,
    functions: functionNames(entry.functions),
    functionIds: entry.functions.map((f) => f.function.id),
    others: v.memberships.map((m) => ({
      ministry: m.ministry.name,
      functions: functionNames(m.functions),
      interested: m.status === "INTERESTED",
    })),
    availabilityLabel: availabilityLabel || null,
    availability: v.availability,
    sundayShift: v.sundayShift,
    termSigned: v.termSigned,
    birthDay: v.birthDay,
    birthMonth: v.birthMonth,
    birthYear: v.birthYear,
    maritalStatus: v.maritalStatus,
    city: v.city,
    baptized: v.baptized,
    convertedYear: v.convertedYear,
    birthday:
      v.birthDay && v.birthMonth
        ? { label: birthdayLabel(v.birthDay, v.birthMonth), status: birthdayStatus(v.birthDay, v.birthMonth) }
        : null,
  };
}

export default async function VoluntariosPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const actor = await getActor();
  const ministries = await getRosterMinistries(actor);

  if (ministries.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold">Voluntários</h1>
        <p className="text-soft">
          Aqui aparece a equipe do ministério que você lidera. Seu acesso ainda não está ligado a nenhum ministério:
          peça ao admin para te colocar como líder em Equipe.
        </p>
      </div>
    );
  }

  const { m } = await searchParams;
  // Só aceita ministério que a pessoa pode ver; qualquer outro id cai no primeiro.
  const current = ministries.find((x) => x.id === m) ?? ministries[0];
  const [roster, functions] = await Promise.all([getMinistryRoster(current.id), getMinistryFunctions(current.id)]);
  const context = {
    ministryId: current.id,
    ministryName: current.name,
    functions: functions.map((f) => ({ id: f.id, name: f.name })),
    // Quem chega aqui lidera o ministério (ou é Admin/Mídia): vê os antecedentes no "olhinho".
    canSeeSensitive: true,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Voluntários</h1>
        <p className="text-soft">Quem serve em cada ministério e onde mais a pessoa já serve.</p>
      </div>

      {ministries.length > 1 ? (
        <nav aria-label="Escolha o ministério" className="flex flex-wrap gap-2">
          {ministries.map((ministry) => {
            const selected = ministry.id === current.id;
            const empty = ministry._count.memberships === 0;
            return (
              <Link
                key={ministry.id}
                href={`/backstage/voluntarios?m=${ministry.id}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pr-1.5 pl-3 text-sm font-extrabold",
                  selected
                    ? "border-ink bg-ink text-paper"
                    : empty
                      ? "border-dashed border-line text-soft hover:border-ink"
                      : "border-line bg-card text-ink hover:border-ink"
                )}
              >
                <MinistryIcon ministry={ministry} size={16} />
                {ministry.name}
                <span
                  className={cn(
                    "min-w-7 rounded-full px-2 py-1 text-center text-xs",
                    selected ? "bg-paper text-ink" : empty ? "text-soft" : "bg-sand text-ink"
                  )}
                >
                  {ministry._count.memberships}
                  <span className="sr-only"> na equipe</span>
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-on-accent">
          <MinistryIcon ministry={current} size={20} />
        </span>
        <h2 className="mr-auto text-xl font-extrabold">Equipe de {current.name}</h2>
        <MinistryFunctionsDialog
          ministryId={current.id}
          ministryName={current.name}
          functions={functions.map((f) => ({ id: f.id, name: f.name, people: f._count.members }))}
          trigger={
            <>
              <ListChecks size={18} strokeWidth={2} aria-hidden="true" /> Funções ({functions.length})
            </>
          }
          triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-card px-5 text-[15px] font-extrabold text-ink hover:border-ink"
        />
        <VolunteerDialog
          {...context}
          trigger={
            <>
              <UserPlus size={18} strokeWidth={2} aria-hidden="true" /> Adicionar pessoa
            </>
          }
          triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-extrabold text-paper"
        />
      </div>

      <VolunteerRoster {...context} people={roster.map(toPerson)} />
    </div>
  );
}
