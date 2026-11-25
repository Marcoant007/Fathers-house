"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActor, audit } from "@/lib/auth-and-audit";
import { canSeeRegistrations, takenSpots } from "@/lib/registrations";
import { registrationState, spotsLeft } from "@/lib/registration-rules";
import { registrationSchema } from "@/lib/schemas/registration";

export type RegisterState =
  | { ok: true; firstName: string; already: boolean }
  | { ok?: false; error: string; fieldErrors?: Record<string, string>}
  | undefined;

/** Envio mais rápido que isso é robô (o formulário manda a hora em que foi aberto). */
const MIN_FILL_MS = 2500;

/**
 * Inscrição pública (FA-29). Sem login. Anti-spam: campo escondido (honeypot) +
 * tempo mínimo de preenchimento + um WhatsApp por evento (índice único).
 */
export async function registerForEvent(slug: string, _prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const firstName = String(formData.get("name") ?? "").trim().split(/\s+/)[0] || "";

  // Robô preencheu o campo escondido: finge que deu certo e não salva nada.
  if (String(formData.get("website") ?? "") !== "") return { ok: true, firstName, already: false };
  const openedAt = Number(formData.get("t") ?? 0);
  if (!openedAt || Date.now() - openedAt < MIN_FILL_MS) {
    return { error: "Opa, foi rápido demais. Confira os dados e envie de novo." };
  }

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event || event.status !== "PUBLISHED" || event.registrationMode !== "INTERNAL") {
    return { error: "Este evento não está recebendo inscrições pelo site." };
  }

  const parsed = registrationSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    partySize: event.askPartySize ? (formData.get("partySize") ?? "1") : "1",
    firstTime: event.askFirstTime ? (formData.get("firstTime") ?? "") : "",
    consent: formData.get("consent") ?? "",
    source: formData.get("source") ?? "site",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Confira os campos destacados.", fieldErrors };
  }
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Trava a linha do evento: duas inscrições ao mesmo tempo não estouram as vagas.
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${event.id}::uuid FOR UPDATE`;

      const existing = await tx.eventRegistration.findUnique({
        where: { eventId_phone: { eventId: event.id, phone: data.phone } },
      });
      if (existing?.status === "CONFIRMED") return { already: true } as const;

      const taken = await takenSpots(event.id, tx);
      const state = registrationState(event, taken);
      if (state === "closed") return { error: "As inscrições pra este evento já encerraram." } as const;
      const left = spotsLeft(event.capacity, taken);
      if (state === "full" || (left !== null && data.partySize > left)) {
        return {
          error: left ? `Só restam ${left} vaga${left > 1 ? "s" : ""}.` : "As vagas esgotaram.",
        } as const;
      }

      const fields = {
        name: data.name,
        partySize: data.partySize,
        firstTime: data.firstTime,
        source: data.source,
        consentAt: new Date(),
        status: "CONFIRMED" as const,
        seenAt: null,
        checkedInAt: null,
      };
      if (existing) {
        // Tinha cancelado e se inscreveu de novo.
        await tx.eventRegistration.update({ where: { id: existing.id }, data: fields });
      } else {
        await tx.eventRegistration.create({ data: { ...fields, eventId: event.id, phone: data.phone } });
      }
      return { already: false } as const;
    });

    if ("error" in result) return { error: result.error ?? "Não deu pra concluir a inscrição." };
    return { ok: true, firstName: data.name.split(/\s+/)[0], already: result.already };
  } catch (err) {
    console.error("registerForEvent", err);
    return { error: "Não consegui salvar sua inscrição agora. Tente de novo em instantes." };
  }
}

// ---------------------------------------------------------------------
// Equipe (FA-31)
// Na auditoria vai só o nome do evento, nunca o nome/WhatsApp da pessoa: o
// audit_logs não pode ser apagado, e a inscrição precisa sumir em 90 dias (LGPD).
// ---------------------------------------------------------------------

async function loadForStaff(id: string) {
  const actor = await getActor();
  const registration = await prisma.eventRegistration.findUniqueOrThrow({
    where: { id },
    include: { event: { select: { id: true, title: true, ministryId: true } } },
  });
  if (!canSeeRegistrations(actor, registration.event.ministryId)) throw new Error("Sem permissão.");
  return { actor, registration };
}

export async function setRegistrationCheckIn(id: string, present: boolean) {
  const { actor, registration } = await loadForStaff(id);
  await prisma.$transaction(async (tx) => {
    await tx.eventRegistration.update({ where: { id }, data: { checkedInAt: present ? new Date() : null } });
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "REGISTRATION",
      entityId: id,
      entityLabel: `Inscrição · ${registration.event.title}`,
      changes: { presenca: { from: !!registration.checkedInAt, to: present } },
    });
  });
  revalidatePath(`/backstage/inscricoes/${registration.event.id}`);
}

export async function setRegistrationCancelled(id: string, cancelled: boolean) {
  const { actor, registration } = await loadForStaff(id);
  await prisma.$transaction(async (tx) => {
    await tx.eventRegistration.update({
      where: { id },
      data: { status: cancelled ? "CANCELLED" : "CONFIRMED", checkedInAt: cancelled ? null : registration.checkedInAt },
    });
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "REGISTRATION",
      entityId: id,
      entityLabel: `Inscrição · ${registration.event.title}`,
      changes: { status: { from: registration.status, to: cancelled ? "CANCELLED" : "CONFIRMED" } },
    });
  });
  revalidatePath(`/backstage/inscricoes/${registration.event.id}`);
  revalidatePath("/backstage/inscricoes");
}
