import "server-only";
import { prisma } from "@/lib/prisma";

/** Painel: todos (ministérios do site e departamentos só de voluntariado). */
export async function getMinistries() {
  return prisma.ministry.findMany({ orderBy: { sortOrder: "asc" } });
}

/** Site público: só os marcados pra aparecer no site. */
export async function getPublicMinistries() {
  return prisma.ministry.findMany({ where: { showOnSite: true }, orderBy: { sortOrder: "asc" } });
}
