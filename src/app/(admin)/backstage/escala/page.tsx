import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Check, ClipboardList, MessageSquareText, Table2 } from "lucide-react";
import { cn } from "cn";
import { getActor, isEditor } from "@/lib/auth-and-audit";
import { getRosterMinistries } from "@/lib/queries/volunteers";
import { getRosterPeriods, getRosterPlan, getRosterSlots, getTeamAvailability } from "@/lib/queries/roster";
import { describeSlot, isPeriodOpen, monthLabel, monthName, selectableMonths } from "@/lib/roster-period";
import { dateInputFromClosesAt } from "@/lib/registration-rules";
import { MinistryIcon } from "@/components/site/MinistryIcon";
import { MinistryPicker } from "@/components/admin/MinistryPicker";
import { OpenRosterPeriodDialog } from "@/components/admin/OpenRosterPeriodDialog";
import { RosterLinkCard } from "@/components/admin/RosterLinkCard";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteRosterPeriod } from "@/lib/actions/roster-periods";
import { RosterPlanView, type PlanPersonRow } from "@/components/admin/RosterPlanView";

export const metadata: Metadata = { title: "Escala" };

const deadlineFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

const pill = (selected: boolean) =>
  cn(
    "flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold",
    selected ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink"
  );

export default async function EscalaPage({ searchParams }: { searchParams: Promise<{ mes?: string; m?: string; v?: string }> }) {
  const actor = await getActor();
  const isManager = isEditor(actor); // Admin ou Mídia
  const [ministries, periods] = await Promise.all([getRosterMinistries(actor), getRosterPeriods()]);

  if (!isManager && ministries.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold">Escala</h1>
        <p className="text-soft">
          Aqui aparece a disponibilidade da equipe que você lidera. Peça ao admin pra te colocar como líder em Equipe.
        </p>
      </div>
    );
  }

  const { mes, m, v } = await searchParams;
  const period = periods.find((p) => p.month === mes) ?? periods[0];
  const openableMonths = selectableMonths().filter((month) => !periods.some((p) => p.month === month));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">Escala</h1>
          <p className="text-soft">Quem pode servir em cada culto e evento do mês, pela resposta do link, e a escala montada.</p>
        </div>
        {isManager ? (
          <OpenRosterPeriodDialog
            months={openableMonths}
            triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-extrabold text-paper disabled:opacity-40"
          />
        ) : null}
      </div>

      {!period ? (
        <div className="flex flex-col items-start gap-3 rounded-3xl bg-card p-8 shadow-sm">
          <CalendarCheck size={28} strokeWidth={2} aria-hidden="true" />
          <p className="text-lg font-extrabold">Nenhuma escala aberta ainda.</p>
          <p className="text-soft">
            {isManager
              ? "Clique em “Abrir escala de um mês”. Antes, confira se todos os horários de culto estão em Cultos."
              : "Quando o admin ou a Mídia abrirem a escala do mês, as respostas da sua equipe aparecem aqui."}
          </p>
        </div>
      ) : (
        <PeriodView
          period={period}
          periods={periods}
          ministries={ministries}
          ministryParam={m}
          building={v !== "respostas"}
          isManager={isManager}
        />
      )}
    </div>
  );
}

async function PeriodView({
  period,
  periods,
  ministries,
  ministryParam,
  building,
  isManager,
}: {
  period: Awaited<ReturnType<typeof getRosterPeriods>>[number];
  periods: Awaited<ReturnType<typeof getRosterPeriods>>;
  ministries: Awaited<ReturnType<typeof getRosterMinistries>>;
  ministryParam: string | undefined;
  building: boolean;
  isManager: boolean;
}) {
  const ministry = ministries.find((x) => x.id === ministryParam) ?? ministries[0];
  const [slots, team, plan] = await Promise.all([
    getRosterSlots(period.id),
    ministry ? getTeamAvailability(period.id, ministry.id) : Promise.resolve([]),
    ministry && building ? getRosterPlan(period.id, ministry.id) : Promise.resolve(null),
  ]);
  const open = isPeriodOpen(period);
  const deadline = deadlineFormatter.format(period.closesAt);
  const base = `/backstage/escala?mes=${period.month}`;

  const columns = slots.map((slot, i) => {
    const d = describeSlot(slot.startsAt);
    const dayIndex = new Set(slots.slice(0, i + 1).map((s) => describeSlot(s.startsAt).dateKey)).size;
    return { id: slot.id, day: d.day, time: d.time, label: slot.label, createdAt: slot.createdAt, shade: dayIndex % 2 === 0 };
  });

  const rows = team.map((entry) => {
    const response = entry.volunteer.availabilityResponses[0] ?? null;
    const functionList = entry.functions.map((f) => f.function).sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: entry.id,
      volunteerId: entry.volunteer.id,
      name: entry.volunteer.name,
      functionList,
      functions: functionList.map((f) => f.name),
      answered: !!response,
      respondedAt: response?.updatedAt ?? null,
      note: response?.note ?? null,
      available: new Set(response?.slots.map((s) => s.slotId) ?? []),
    };
  });
  const answered = rows.filter((r) => r.answered).length;
  const missing = rows.length - answered;
  // Culto incluído depois que a pessoa respondeu ("Atualizar cultos e eventos do mês" ou evento publicado): ela ainda não viu.
  const sawSlot = (row: (typeof rows)[number], column: (typeof columns)[number]) =>
    !!row.respondedAt && row.respondedAt.getTime() >= column.createdAt.getTime();

  const planPeople: PlanPersonRow[] = rows.map((row) => {
    const answers = new Map<string, "yes" | "no">();
    for (const c of columns) {
      if (row.available.has(c.id)) answers.set(c.id, "yes");
      else if (sawSlot(row, c)) answers.set(c.id, "no");
    }
    return {
      volunteerId: row.volunteerId,
      name: row.name,
      functions: row.functionList.map((f) => ({ id: f.id, name: f.name })),
      answers,
    };
  });

  return (
    <>
      {periods.length > 1 ? (
        <nav aria-label="Escolha o mês" className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/backstage/escala?mes=${p.month}${ministry ? `&m=${ministry.id}` : ""}${building ? "" : "&v=respostas"}`}
              aria-current={p.id === period.id ? "page" : undefined}
              className={pill(p.id === period.id)}
            >
              {monthLabel(p.month).replace(/^./, (c) => c.toUpperCase())}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Escala de {monthLabel(period.month)}</h2>
        {isManager ? (
          <DeleteButton
            itemId={period.id}
            itemTitle={`Escala de ${monthLabel(period.month)}`}
            itemLabel="mês"
            listHref="/backstage/escala"
            deleteAction={deleteRosterPeriod}
            variant="compact"
            description={`Isso apaga o link e as ${period._count.responses} resposta(s) já recebidas. Não dá pra desfazer.`}
          />
        ) : null}
      </div>

      <RosterLinkCard
        periodId={period.id}
        month={period.month}
        monthName={monthName(period.month)}
        open={open}
        deadlineLabel={deadline}
        deadlineInput={dateInputFromClosesAt(period.closesAt)}
        canEdit={isManager}
      />

      {ministries.length > 1 && ministry ? (
        <MinistryPicker
          value={ministry.id}
          options={ministries.map((x) => ({
            id: x.id,
            name: x.name,
            href: `${base}&m=${x.id}${building ? "" : "&v=respostas"}`,
          }))}
        />
      ) : null}

      {ministry && rows.length > 0 ? (
        <nav aria-label="O que ver" className="flex flex-wrap gap-1 self-start rounded-full bg-sand p-1">
          {(
            [
              [true, "Montar escala", ClipboardList],
              [false, "Ver todas as respostas", Table2],
            ] as const
          ).map(([isBuild, label, Icon]) => (
            <Link
              key={label}
              href={`${base}&m=${ministry.id}${isBuild ? "" : "&v=respostas"}`}
              aria-current={building === isBuild ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold",
                building === isBuild ? "bg-card shadow-sm" : "text-soft hover:text-ink"
              )}
            >
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      ) : null}

      {!ministry ? null : rows.length === 0 ? (
        <p className="rounded-3xl bg-card p-8 text-soft shadow-sm">Ninguém na equipe de {ministry.name} ainda.</p>
      ) : building && plan ? (
        <RosterPlanView
          period={period}
          ministry={ministry}
          slots={slots}
          people={planPeople}
          plan={plan}
          open={open}
          deadline={deadline}
        />
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="quadro-titulo">
          <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-card p-5 shadow-sm">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-on-accent">
              <MinistryIcon ministry={ministry} size={20} />
            </span>
            <div className="flex min-w-52 flex-1 flex-col gap-2">
              <h3 id="quadro-titulo" className="font-extrabold">
                {ministry.name}: {answered} de {rows.length} responderam
              </h3>
              <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-sand" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(answered / rows.length) * 100}%` }} />
              </div>
            </div>
            {missing > 0 ? (
              <p className="text-sm text-soft">
                <b className="text-ink">{missing} sem resposta</b>
                {open ? " — ainda dá tempo até o prazo." : " — entram como disponíveis em qualquer data."}
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-3xl bg-card shadow-sm">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-60 border-b border-line bg-card px-5 py-3 text-xs font-extrabold text-soft uppercase">
                    Pessoa
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      title={c.label}
                      className={cn("min-w-16 border-b border-line px-1 py-3 text-center", c.shade && "bg-sand/60")}
                    >
                      <span className="block text-xs font-extrabold whitespace-nowrap">{c.day}</span>
                      <span className="block text-xs font-bold text-soft">{c.time}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="sticky left-0 z-10 border-b border-line bg-card px-5 py-3 align-top font-normal">
                      <span className="block font-extrabold">{row.name}</span>
                      {row.functions.length > 0 ? (
                        <span className="block text-xs font-bold text-soft">{row.functions.join(", ")}</span>
                      ) : null}
                      {row.answered ? (
                        <span className="block text-xs font-bold text-success">
                          Respondeu · {row.available.size} {row.available.size === 1 ? "culto" : "cultos"}
                        </span>
                      ) : (
                        <span className="block text-xs font-bold text-soft">Sem resposta</span>
                      )}
                      {row.note ? (
                        <span className="mt-1 flex max-w-60 items-start gap-1.5 text-xs text-ink italic">
                          <MessageSquareText size={14} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />“
                          {row.note}”
                        </span>
                      ) : null}
                    </th>
                    {columns.map((c) => (
                      <td key={c.id} className={cn("border-b border-line px-1 py-3 text-center align-middle", c.shade && "bg-sand/60")}>
                        <AvailabilityCell answered={sawSlot(row, c)} available={row.available.has(c.id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="sticky left-0 z-10 bg-card px-5 py-3 text-xs font-extrabold text-soft uppercase">
                    Podem servir
                  </th>
                  {columns.map((c) => {
                    const yes = rows.filter((r) => r.available.has(c.id)).length;
                    const unknown = rows.filter((r) => !sawSlot(r, c)).length;
                    return (
                      <td key={c.id} className={cn("px-1 py-3 text-center", c.shade && "bg-sand/60")}>
                        <span className="block text-base font-extrabold">{yes}</span>
                        {unknown > 0 ? <span className="block text-[11px] font-bold text-soft">+{unknown} ?</span> : null}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-sm text-soft">
            <Check size={14} strokeWidth={3} aria-hidden="true" className="inline" /> pode servir · ponto = não pode ·
            ? = ainda não respondeu sobre esse culto. “+N ?” embaixo é quem ainda não respondeu.
          </p>
        </section>
      )}
    </>
  );
}

function AvailabilityCell({ answered, available }: { answered: boolean; available: boolean }) {
  if (!answered)
    return (
      <span className="font-extrabold text-soft">
        ?<span className="sr-only">sem resposta</span>
      </span>
    );
  if (available)
    return (
      <span className="mx-auto flex size-7 items-center justify-center rounded-full bg-accent text-on-accent">
        <Check size={14} strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">pode</span>
      </span>
    );
  return (
    <span className="mx-auto block size-2.5 rounded-full bg-soft-dark">
      <span className="sr-only">não pode</span>
    </span>
  );
}
