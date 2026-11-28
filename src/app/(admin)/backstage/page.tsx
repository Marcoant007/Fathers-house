import type { Metadata } from "next";
import { getActor, describeRoles } from "@/lib/auth-and-audit";
import { Panel } from "@/components/admin/Panel";
import { WaitingForAccess } from "@/components/admin/WaitingForAccess";
import { getUpcomingEvents } from "@/lib/queries/events";
import { formatEventMoment } from "@/lib/format";

export const metadata: Metadata = { title: "Painel" };

export default async function AdminHomePage() {
  const actor = await getActor();
  if (actor.roles.length === 0) return <WaitingForAccess />;
  const upcoming = await getUpcomingEvents(5);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold">Olá, {actor.name.split(" ")[0]}</h1>
        <p className="text-soft">{describeRoles(actor)}</p>
      </div>

      <Panel className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Próximos eventos</h2>
        {upcoming.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {upcoming.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 text-[15px]">
                <span className="font-bold">{event.title}</span>
                <span className="text-soft">{formatEventMoment(event.startsAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-soft">Nenhum evento publicado por enquanto.</p>
        )}
      </Panel>

      <Panel>
        <p className="text-soft">
          A fila de aprovação e a atividade recente aparecem aqui quando os fluxos de
          eventos, avisos e auditoria forem implementados.
        </p>
      </Panel>
    </div>
  );
}
