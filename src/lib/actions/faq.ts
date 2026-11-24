"use server";

import { revalidatePath } from "next/cache";
import { getActor, isEditor, audit, diff } from "@/lib/auth-and-audit";
import { faqSchema } from "@/lib/schemas/faq";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type FaqActionState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const LIST_PATH = "/backstage/tira-duvidas";

function readForm(formData: FormData) {
  return {
    question: String(formData.get("question") ?? ""),
    answer: String(formData.get("answer") ?? ""),
    keywords: String(formData.get("keywords") ?? ""),
    showWhatsapp: formData.get("showWhatsapp") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    active: formData.get("active") === "on",
    linkLabel: String(formData.get("linkLabel") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  };
}

export async function createFaq(_prev: FaqActionState, formData: FormData): Promise<FaqActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: "Só a mídia/admin gerencia o tira-dúvidas." };

  const parsed = faqSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: "Confira os campos.", fieldErrors: flatten(parsed.error) };

  await prisma.$transaction(async (tx) => {
    const created = await tx.faqEntry.create({ data: parsed.data });
    await audit(tx, actor, {
      action: "CREATE",
      entityType: "FAQ",
      entityId: created.id,
      entityLabel: created.question,
      changes: { ...parsed.data } as Prisma.InputJsonValue,
    });
  });

  revalidatePath(LIST_PATH);
  return {};
}

export async function updateFaq(id: string, _prev: FaqActionState, formData: FormData): Promise<FaqActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: "Só a mídia/admin gerencia o tira-dúvidas." };

  const parsed = faqSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: "Confira os campos.", fieldErrors: flatten(parsed.error) };

  await prisma.$transaction(async (tx) => {
    const before = await tx.faqEntry.findUniqueOrThrow({ where: { id } });
    const after = await tx.faqEntry.update({ where: { id }, data: parsed.data });
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "FAQ",
      entityId: id,
      entityLabel: after.question,
      changes: diff(before, after) as Prisma.InputJsonValue,
    });
  });

  revalidatePath(LIST_PATH);
  return {};
}

export async function deleteFaq(id: string) {
  const actor = await getActor();
  if (!isEditor(actor)) throw new Error("Só a mídia/admin gerencia o tira-dúvidas.");

  await prisma.$transaction(async (tx) => {
    const before = await tx.faqEntry.findUniqueOrThrow({ where: { id } });
    await tx.faqEntry.delete({ where: { id } });
    await audit(tx, actor, {
      action: "DELETE",
      entityType: "FAQ",
      entityId: id,
      entityLabel: before.question,
      changes: { question: before.question, answer: before.answer, keywords: before.keywords } as Prisma.InputJsonValue,
    });
  });

  revalidatePath(LIST_PATH);
}

function flatten(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
