import { z } from "zod";

/** Upload (https://…blob.vercel-storage.com/…) ou arquivo do próprio site (public/, ex.: /projetos/sala-do.jpg). */
export function isImagePath(value: string): boolean {
  return /^https:\/\/\S+$/.test(value) || /^\/[^\s/]\S*$/.test(value);
}

export const imagePath = (max = 2048) => z.string().trim().max(max).refine(isImagePath, "Imagem inválida");

/** Campo de imagem opcional: vazio = sem imagem. */
export const optionalImagePath = (max = 2048) => imagePath(max).optional().or(z.literal(""));
