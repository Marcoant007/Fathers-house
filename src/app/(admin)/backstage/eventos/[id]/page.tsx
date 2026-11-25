import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getActor, hasRole, isEditor } from "@/lib/auth-and-audit";
import { EventForm } from "@/components/admin/EventForm";
import { ApprovalActions } from "@/components/admin/ApprovalActions";
import { AuditTimeline } from "@/components/admin/AuditTimeline";
import { SimpleTabs } from "@/components/admin/SimpleTabs";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SaveSuccessDialog } from "@/components/admin/SaveSuccessDialog";
import { getEventById } from "@/lib/queries/events";
import { approveEvent, rejectEvent, deleteEvent } from "@/lib/actions/events";
import { getAllCategories } from "@/lib/queries/categories";
import { getMinistries } from "@/lib/queries/ministries";
import { getEntityAuditLog } from "@/lib/queries/audit";
import { canSeeRegistrations, takenSpots } from "@/lib/registrations";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { QrCode, Users } from "lucide-react";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor();
  const editor = isEditor(actor);

  const event = await getEventById(id);
  if (!event) notFound();

  const ownDraft = hasRole(actor, "LIDER", event.ministryId) && event.createdById === actor.id;
  if (!editor && !ownDraft) notFound();

  const [categories, allMinistries, auditLog] = await Promise.all([
    getAllCategories(),
    getMinistries(),
    getEntityAuditLog("EVENT", id),
  ]);
  const ministries = editor ? allMinistries : allMinistries.filter((m) => hasRole(actor, "LIDER", m.id));

  const showRegistrations = event.registrationMode === "INTERNAL" && canSeeRegistrations(actor, event.ministryId);
  const [people, registrationCount] = showRegistrations
    ? await Promise.all([
        takenSpots(event.id),
        prisma.eventRegistration.count({ where: { eventId: event.id, status: "CONFIRMED" } }),
      ])
    : [0, 0];

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <SaveSuccessDialog
          messages={{
            draft: "Rascunho salvo!",
            submit: "Enviado para aprovação!",
            publish: "Evento publicado!",
            reject: "Evento devolvido!",
          }}
        />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold">{event.title}</h1>
        {editor ? (
          <DeleteButton
            itemId={event.id}
            itemTitle={event.title}
            itemLabel="evento"
            listHref="/backstage/eventos"
            deleteAction={deleteEvent}
          />
        ) : null}
      </div>

      {editor && event.status === "PENDING" ? (
        <ApprovalActions
          entityId={event.id}
          entityLabel="evento"
          onApprove={approveEvent}
          onReject={rejectEvent}
        />
      ) : null}

      <SimpleTabs
        tabs={[
          {
            value: "detalhes",
            label: "Detalhes",
            content: <EventForm event={event} categories={categories} ministries={ministries} isEditor={editor} />,
          },
          ...(showRegistrations
            ? [
                {
                  value: "inscricoes",
                  label: "Inscrições",
                  content: (
                    <div className="flex flex-col gap-5">
                      <p className="text-[15px]">
                        <b>{registrationCount}</b> {registrationCount === 1 ? "inscrição" : "inscrições"} ·{" "}
                        <b>{people}</b> {people === 1 ? "pessoa" : "pessoas"}
                        {event.capacity ? ` de ${event.capacity} vagas` : " (sem limite de vagas)"}
                      </p>
                      {event.status !== "PUBLISHED" ? (
                        <p className="text-[15px] text-soft">
                          O formulário só abre pro público depois que o evento for publicado.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/backstage/inscricoes/${event.id}`}
                          className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-extrabold text-paper"
                        >
                          <Users size={18} strokeWidth={2} aria-hidden="true" /> Ver inscritos
                        </Link>
                        <a
                          href={`/backstage/inscricoes/${event.id}/qrcode?formato=png`}
                          className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-5 text-[15px] font-extrabold"
                        >
                          <QrCode size={18} strokeWidth={2} aria-hidden="true" /> Baixar QR code
                        </a>
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
          { value: "historico", label: "Histórico", content: <AuditTimeline entries={auditLog} /> },
        ]}
      />
    </div>
  );
}
