"use server";

import { revalidatePath } from "next/cache";
import { getActor, isEditor, audit, diff } from "@/lib/auth-and-audit";
import { liveChannelsSchema, liveStreamSchema } from "@/lib/schemas/live";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type LiveActionState = { ok?: true; error?: string; fieldErrors?: Record<string, string> } | undefined;

const NO_PERMISSION = "Só a mídia/admin gerencia as lives.";

function readLiveForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    youtubeUrl: String(formData.get("youtubeUrl") ?? ""),
    spotifyUrl: String(formData.get("spotifyUrl") ?? ""),
    description: String(formData.get("description") ?? ""),
    visible: formData.get("visible") === "on",
  };
}

function revalidateLive() {
  revalidatePath("/", "layout");
  revalidatePath("/backstage/live");
}

export async function createLiveStream(_prev: LiveActionState, formData: FormData): Promise<LiveActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };

  const parsed = liveStreamSchema.safeParse(readLiveForm(formData));
  if (!parsed.success) return { error: "Confira os campos destacados.", fieldErrors: flatten(parsed.error) };

  await prisma.$transaction(async (tx) => {
    const created = await tx.liveStream.create({ data: parsed.data });
    await audit(tx, actor, {
      action: "CREATE",
      entityType: "LIVE_STREAM",
      entityId: created.id,
      entityLabel: created.title,
    });
  });

  revalidateLive();
  return { ok: true };
}

export async function updateLiveStream(
  id: string,
  _prev: LiveActionState,
  formData: FormData
): Promise<LiveActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };

  const parsed = liveStreamSchema.safeParse(readLiveForm(formData));
  if (!parsed.success) return { error: "Confira os campos destacados.", fieldErrors: flatten(parsed.error) };

  await prisma.$transaction(async (tx) => {
    const before = await tx.liveStream.findUniqueOrThrow({ where: { id } });
    const after = await tx.liveStream.update({ where: { id }, data: parsed.data });
    await audit(tx, actor, {
      action: "UPDATE",
      entityType: "LIVE_STREAM",
      entityId: id,
      entityLabel: after.title,
      changes: diff(before, after) as Prisma.InputJsonValue,
    });
  });

  revalidateLive();
  return { ok: true };
}

export async function deleteLiveStream(id: string) {
  const actor = await getActor();
  if (!isEditor(actor)) throw new Error(NO_PERMISSION);

  await prisma.$transaction(async (tx) => {
    const before = await tx.liveStream.findUniqueOrThrow({ where: { id } });
    await tx.liveStream.delete({ where: { id } });
    await audit(tx, actor, { action: "DELETE", entityType: "LIVE_STREAM", entityId: id, entityLabel: before.title });
  });

  revalidateLive();
}

/** Canal do YouTube e perfil do Spotify da igreja (rodapé e tira-dúvidas). */
export async function updateLiveChannels(_prev: LiveActionState, formData: FormData): Promise<LiveActionState> {
  const actor = await getActor();
  if (!isEditor(actor)) return { error: NO_PERMISSION };

  const parsed = liveChannelsSchema.safeParse({
    youtube: String(formData.get("youtube") ?? ""),
    spotify: String(formData.get("spotify") ?? ""),
  });
  if (!parsed.success) return { error: "Confira os links.", fieldErrors: flatten(parsed.error) };

  await prisma.$transaction(async (tx) => {
    const before = await tx.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
    const after = await tx.siteSettings.update({
      where: { id: 1 },
      data: { ...parsed.data, updatedBy: { connect: { id: actor.id } } },
    });
    await audit(tx, actor, {
      action: "SETTINGS_CHANGE",
      entityType: "SITE_SETTINGS",
      entityId: "1",
      entityLabel: "Canais (Live)",
      changes: diff(before, after) as Prisma.InputJsonValue,
    });
  });

  revalidateLive();
  return { ok: true };
}

function flatten(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
