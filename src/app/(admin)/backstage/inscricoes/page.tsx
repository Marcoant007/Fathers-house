import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Users } from "lucide-react";
import { getActor, isEditor } from "@/lib/auth-and-audit";
import {
  currentMonth,
  getRegistrationEventsForMonth,
  isMonth,
  monthLabel,
  purgeExpiredRegistrations,
} from "@/lib/registrations";
import { formatEventMoment } from "@/lib/format";
import { RETENTION_DAYS } from "@/lib/registration-rules";
import { Panel } from "@/components/admin/Panel";

export const metadata: Metadata = { title: "Inscrições" };

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function InscricoesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const actor = await getActor();
  if (!isEditor(actor) && !actor.roles.some((r) => r.role === "LIDER")) {
    return <p className="text-soft">Só mídia/admin e líderes de ministério veem as inscrições.</p>;
  }

  const { mes } = await searchParams;
  const month = isMonth(mes) ? mes : currentMonth();
  await purgeExpiredRegistrations();
  const rows = await getRegistrationEventsForMonth(actor, month);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">Inscrições</h1>
          <p className="text-[15px] text-soft">
            Eventos com formulário do site. Os dados de quem se inscreveu são apagados {RETENTION_DAYS} dias depois
            do evento.
          </p>
        </div>
        {rows.length > 0 ? (
          <a
            href={`/backstage/inscricoes/exportar?mes=${month}`}
            className="flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[15px] font-extrabold text-paper"
          >
            <Download size={18} strokeWidth={2} aria-hidden="true" /> Baixar planilha do mês
          </a>
        ) : null}
      </div>

      <nav aria-label="Mês" className="flex items-center gap-2">
        <Link
          href={`/backstage/inscricoes?mes=${shiftMonth(month, -1)}`}
          aria-label="Mês anterior"
          className="flex size-11 items-center justify-center rounded-xl bg-card hover:bg-sand-2"
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
        </Link>
        <p className="min-w-48 text-center text-lg font-extrabold">{monthLabel(month)}</p>
        <Link
          href={`/backstage/inscricoes?mes=${shiftMonth(month, 1)}`}
          aria-label="Próximo mês"
          className="flex size-11 items-center justify-center rounded-xl bg-card hover:bg-sand-2"
        >
          <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
        </Link>
        {month !== currentMonth() ? (
          <Link href="/backstage/inscricoes" className="ml-2 text-sm font-bold text-soft underline">
            Mês atual
          </Link>
        ) : null}
      </nav>

      <Panel className="p-0">
        {rows.length === 0 ? (
          <p className="p-8 text-soft">
            Nenhum evento com formulário de inscrição neste mês. Pra ativar, edite o evento e escolha
            “Formulário do site” em Inscrições.
          </p>
        ) : (
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-xs font-extrabold text-soft uppercase">
                <th className="px-6 py-4">Evento</th>
                <th className="hidden px-6 py-4 md:table-cell">Data</th>
                <th className="px-6 py-4">Inscrições</th>
                <th className="px-6 py-4">Pessoas / vagas</th>
                <th className="px-6 py-4">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ event, registrations, people, unseen }) => (
                <tr key={event.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-4">
                    <Link href={`/backstage/inscricoes/${event.id}`} className="font-bold hover:underline">
                      {event.title}
                    </Link>
                    {event.ministry ? <p className="text-sm text-soft">{event.ministry.name}</p> : null}
                  </td>
                  <td className="hidden px-6 py-4 text-soft md:table-cell">{formatEventMoment(event.startsAt)}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold">{registrations}</span>
                    {unseen > 0 ? (
                      <span className="ml-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-extrabold text-on-accent">
                        {unseen} {unseen === 1 ? "nova" : "novas"}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-soft">
                    {people}
                    {event.capacity ? ` / ${event.capacity}` : " (sem limite)"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/backstage/inscricoes/${event.id}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-extrabold whitespace-nowrap text-paper hover:bg-ink-2"
                    >
                      <Users size={16} strokeWidth={2} aria-hidden="true" />
                      Ver inscritos
                      <span className="sr-only"> de {event.title}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
