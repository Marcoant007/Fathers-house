"use server";

import { revalidatePath } from "next/cache";
import { getActor, isEditor, audit, diff } from "@/lib/auth-and-audit";
import { givingProjectSchema } from "@/lib/schemas/giving-project";
import { deleteBlobIfExists } from "@/lib/blob";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type GivingProjectActionState = { ok?: true; error?: string; fieldErrors?: Record<string, string> } | undefined;

const NO_PERMISSION = "Só a mídia/admin gerencia os projetos.";

function readForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    imagePath: String(formData.get("imagePath") ?? ""),
    visible: formData.get("visible") === "on",
  };
}

function revalidateProjects() {
  revalidatePath("/", "layout");
  revalidatePath("/backstage/projetos");
}

export async function createGivingProject(
  _prev: GivingProjectActionState,
  formData: FormData
): Promise<GivingProjectActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };

  const parsed = givingProjectSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: "Confira os campos destacados.", fieldErrors: flatten(parsed.error) };

  await prisma.$transaction(async (tx) => {
    // Projeto novo entra no fim do carrossel.
    const last = await tx.givingProject.aggregate({ _max: { sortOrder: true } });
    const created = await tx.givingProject.create({
      data: { ...parsed.data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await audit(tx, actor, {
      action: "CREATE",
      entityType: "GIVING_PROJECT",
      entityId: created.id,
      entityLabel: created.title,
      changes: { ...parsed.data } as Prisma.InputJsonValue,
    });
  });

  revalidateProjects();
  return { ok: true };
}

export async function updateGivingProject(
  id: string,
  _prev: GivingProjectActionState,
  formData: FormData
): Promise<GivingProjectActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };

  const parsed = givingProjectSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: "Confira os campos destacados.", fieldErrors: flatten(parsed.error) };

  const oldImage = await prisma.$transaction(async (tx) => {
    const before = await tx.givingProject.findUniqueOrThrow({ where: { id } });
    const after = await tx.givingProject.update({ where: { id }, data: parsed.data });
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "GIVING_PROJECT",
      entityId: id,
      entityLabel: after.title,
      changes: diff(before, after) as Prisma.InputJsonValue,
    });
    return before.imagePath !== after.imagePath ? before.imagePath : null;
  });

  await deleteBlobIfExists(oldImage);
  revalidateProjects();
  return { ok: true };
}

export async function deleteGivingProject(id: string) {
  const actor = await getActor();
  if (!isEditor(actor)) throw new Error(NO_PERMISSION);

  const before = await prisma.$transaction(async (tx) => {
    const before = await tx.givingProject.findUniqueOrThrow({ where: { id } });
    await tx.givingProject.delete({ where: { id } });
    await audit(tx, actor, {
      action: "DELETE",
      entityType: "GIVING_PROJECT",
      entityId: id,
      entityLabel: before.title,
      changes: { title: before.title, description: before.description, imagePath: before.imagePath } as Prisma.InputJsonValue,
    });
    return before;
  });

  await deleteBlobIfExists(before.imagePath);
  revalidateProjects();
}

/** Botões Subir/Descer: troca o projeto de lugar com o vizinho. */
export async function moveGivingProject(id: string, direction: "up" | "down") {
  const actor = await getActor();
  if (!isEditor(actor)) throw new Error(NO_PERMISSION);

  await prisma.$transaction(async (tx) => {
    const list = await tx.givingProject.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, sortOrder: true },
    });
    const from = list.findIndex((p) => p.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= list.length) return;

    const reordered = [...list];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    // Regrava 0..n-1 (também conserta empates antigos de sortOrder).
    for (const [index, project] of reordered.entries()) {
      if (project.sortOrder !== index) {
        await tx.givingProject.update({ where: { id: project.id }, data: { sortOrder: index } });
      }
    }
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "GIVING_PROJECT",
      entityId: id,
      entityLabel: list[from].title,
      changes: { position: { from: from + 1, to: to + 1 } } as Prisma.InputJsonValue,
    });
  });

  revalidateProjects();
}

function flatten(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
