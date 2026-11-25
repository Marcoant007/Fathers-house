import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, QrCode, Search } from "lucide-react";
import { cn } from "cn";
import { getActor, isEditor } from "@/lib/auth-and-audit";
import { prisma } from "@/lib/prisma";
import {
  canSeeRegistrations,
  getEventRegistrations,
  markRegistrationsSeen,
  purgeExpiredRegistrations,
} from "@/lib/registrations";
import {
  countByFilter,
  filterRegistrations,
  formatPhone,
  isRegistrationFilter,
  registrationState,
  spotsLeft,
  type RegistrationFilter,
} from "@/lib/registration-rules";
import { formatEventRange, formatRelative } from "@/lib/format";
import { Panel } from "@/components/admin/Panel";
import { RegistrationRowActions } from "@/components/admin/RegistrationRowActions";

export const metadata: Metadata = { title: "Inscritos" };

const STATE_LABELS = {
  open: { label: "Inscrições abertas", className: "bg-success/10 text-success" },
  full: { label: "Esgotado", className: "bg-danger/10 text-danger" },
  closed: { label: "Inscrições encerradas", className: "bg-sand text-soft" },
  disabled: { label: "Não publicado / sem formulário", className: "bg-sand text-soft" },
} as const;

const FILTER_LABELS: Record<RegistrationFilter, string> = {
  todos: "Todos",
  "primeira-vez": "Primeira vez",
  "ja-frequenta": "Já frequenta",
  presentes: "Presentes",
  faltam: "Ainda não chegaram",
  canceladas: "Canceladas",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card px-5 py-4">
      <span className="text-2xl font-black">{value}</span>
      <span className="text-sm text-soft">{label}</span>
    </div>
  );
}

export default async function InscritosPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ filtro?: string; busca?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const filter: RegistrationFilter = isRegistrationFilter(query.filtro) ? query.filtro : "todos";
  const search = (query.busca ?? "").slice(0, 80).trim();
  const actor = await getActor();
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { ministry: true } });
  if (!event || !canSeeRegistrations(actor, event.ministryId)) notFound();

  await purgeExpiredRegistrations();
  const registrations = await getEventRegistrations(event.id);
  // Guarda quem era novo antes de marcar como visto, pra destacar nesta visita.
  const newIds = new Set(registrations.filter((r) => !r.seenAt).map((r) => r.id));
  if (newIds.size > 0) await markRegistrationsSeen(event.id);

  const confirmed = registrations.filter((r) => r.status === "CONFIRMED");
  const people = confirmed.reduce((sum, r) => sum + r.partySize, 0);
  const present = confirmed.filter((r) => r.checkedInAt).reduce((sum, r) => sum + r.partySize, 0);
  const firstTimers = confirmed.filter((r) => r.firstTime).length;
  const left = spotsLeft(event.capacity, people);
  const state = STATE_LABELS[registrationState(event, people)];

  const filters = (Object.keys(FILTER_LABELS) as RegistrationFilter[]).filter(
    (f) => event.askFirstTime || (f !== "primeira-vez" && f !== "ja-frequenta")
  );
  const counts = countByFilter(registrations, search);
  const shown = filterRegistrations(registrations, filter, search);
  const filtering = filter !== "todos" || search !== "";
  const basePath = `/backstage/inscricoes/${event.id}`;
  const hrefFor = (f: RegistrationFilter) => {
    const qs = new URLSearchParams();
    if (f !== "todos") qs.set("filtro", f);
    if (search) qs.set("busca", search);
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/backstage/inscricoes" className="text-sm font-bold text-soft hover:text-ink">
          ← Inscrições
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{event.title}</h1>
          <span className={cn("rounded-full px-3 py-1 text-xs font-extrabold", state.className)}>{state.label}</span>
        </div>
        <p className="text-[15px] text-soft">
          {formatEventRange(event.startsAt, event.endsAt)}
          {event.ministry ? ` · ${event.ministry.name}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={`/backstage/inscricoes/exportar?evento=${event.id}`}
          className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-extrabold text-paper"
        >
          <Download size={18} strokeWidth={2} aria-hidden="true" /> Baixar planilha
        </a>
        <a
          href={`/backstage/inscricoes/${event.id}/qrcode?formato=png`}
          className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-5 text-[15px] font-extrabold"
        >
          <QrCode size={18} strokeWidth={2} aria-hidden="true" /> QR code (post/telão)
        </a>
        <a
          href={`/backstage/inscricoes/${event.id}/qrcode?formato=svg`}
          className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-5 text-[15px] font-extrabold"
        >
          <QrCode size={18} strokeWidth={2} aria-hidden="true" /> QR code (impressão)
        </a>
        <a
          href={`/agenda/${event.slug}/inscricao`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-2 px-3 text-[15px] font-extrabold text-soft hover:text-ink"
        >
          <ExternalLink size={18} strokeWidth={2} aria-hidden="true" /> Ver formulário
        </a>
        {isEditor(actor) ? (
          <Link
            href={`/backstage/eventos/${event.id}`}
            className="flex min-h-11 items-center px-3 text-[15px] font-extrabold text-soft hover:text-ink"
          >
            Editar evento
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="inscrições" value={confirmed.length} />
        <Stat label={event.capacity ? `pessoas · ${left} vagas sobrando` : "pessoas (sem limite)"} value={people} />
        <Stat label="presentes" value={present} />
        <Stat label={event.askFirstTime ? "primeira vez" : "primeira vez (não perguntado)"} value={firstTimers} />
      </div>

      {registrations.length > 0 ? (
        <div className="flex flex-col gap-4">
          <form action={basePath} className="flex flex-wrap items-end gap-3">
            {filter !== "todos" ? <input type="hidden" name="filtro" value={filter} /> : null}
            <label className="flex min-w-64 flex-1 flex-col gap-1 sm:max-w-md">
              <span className="text-sm font-extrabold">Procurar pessoa</span>
              <input
                type="search"
                name="busca"
                defaultValue={search}
                placeholder="Nome ou WhatsApp"
                className="min-h-11 rounded-xl border-2 border-line bg-card px-4 text-[15px] focus:border-ink focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-extrabold text-paper"
            >
              <Search size={18} strokeWidth={2} aria-hidden="true" /> Buscar
            </button>
            {filtering ? (
              <Link href={basePath} className="flex min-h-11 items-center px-3 text-[15px] font-extrabold text-soft underline hover:text-ink">
                Limpar filtros
              </Link>
            ) : null}
          </form>

          <nav aria-label="Filtrar inscritos" className="flex flex-col gap-2">
            <span className="text-sm font-extrabold">Mostrar</span>
            <ul className="flex flex-wrap gap-2">
              {filters.map((f) => {
                const active = f === filter;
                return (
                  <li key={f}>
                    <Link
                      href={hrefFor(f)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold",
                        active ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink"
                      )}
                    >
                      {FILTER_LABELS[f]}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          active ? "bg-paper/20 text-paper" : "bg-sand text-soft"
                        )}
                      >
                        {counts[f]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}

      <Panel className="overflow-x-auto p-0">
        {registrations.length === 0 ? (
          <p className="p-8 text-soft">Ninguém se inscreveu ainda. Divulgue o QR code!</p>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-8">
            <p className="text-soft">
              Ninguém encontrado
              {filter !== "todos" ? ` em “${FILTER_LABELS[filter]}”` : ""}
              {search ? ` com “${search}”` : ""}.
            </p>
            <Link
              href={basePath}
              className="flex min-h-11 items-center rounded-full border-2 border-ink px-5 text-[15px] font-extrabold"
            >
              Mostrar todos os inscritos
            </Link>
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-xs font-extrabold text-soft uppercase">
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">WhatsApp</th>
                {event.askPartySize ? <th className="px-6 py-4">Pessoas</th> : null}
                {event.askFirstTime ? <th className="px-6 py-4">1ª vez</th> : null}
                <th className="px-6 py-4">Inscrição</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const cancelled = r.status === "CANCELLED";
                return (
                  <tr key={r.id} className={cn("border-b border-line last:border-0", cancelled && "opacity-50")}>
                    <td className="px-6 py-4 font-bold">
                      {r.name}
                      {newIds.has(r.id) && !cancelled ? (
                        <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-on-accent">
                          nova
                        </span>
                      ) : null}
                      {cancelled ? <span className="ml-2 text-xs font-extrabold text-danger">cancelada</span> : null}
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`https://wa.me/${r.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold underline decoration-accent decoration-2 underline-offset-4"
                      >
                        {formatPhone(r.phone)}
                      </a>
                    </td>
                    {event.askPartySize ? <td className="px-6 py-4">{r.partySize}</td> : null}
                    {event.askFirstTime ? (
                      <td className="px-6 py-4">{r.firstTime === null ? "—" : r.firstTime ? "Sim" : "Não"}</td>
                    ) : null}
                    <td className="px-6 py-4 text-sm text-soft">
                      {formatRelative(r.createdAt)}
                      {r.source === "qr" ? " · QR" : ""}
                    </td>
                    <td className="px-6 py-4">
                      <RegistrationRowActions id={r.id} present={!!r.checkedInAt} cancelled={cancelled} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
