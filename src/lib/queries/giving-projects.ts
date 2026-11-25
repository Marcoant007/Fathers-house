import "server-only";
import { prisma } from "@/lib/prisma";

const ORDER = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

/** Painel: todos, na ordem do carrossel. */
export async function getGivingProjects() {
  return prisma.givingProject.findMany({ orderBy: ORDER });
}

/** Site: só os visíveis. */
export async function getVisibleGivingProjects() {
  return prisma.givingProject.findMany({
    where: { visible: true },
    orderBy: ORDER,
    select: { id: true, title: true, description: true, imagePath: true },
  });
}
