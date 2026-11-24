import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/** "gfc, grupo familiar\ncélula" → ["gfc", "grupo familiar", "célula"] */
export function parseKeywords(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,;\n]/)
        .map((k) => k.trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  );
}

export const faqSchema = z
  .object({
    question: z.string().trim().min(3, "Pergunta muito curta").max(160, "Máximo de 160 caracteres"),
    answer: z.string().trim().min(3, "Resposta muito curta").max(1500, "Máximo de 1500 caracteres"),
    keywords: z
      .string()
      .transform(parseKeywords)
      .pipe(z.array(z.string().max(60, "Palavra-chave muito longa")).min(1, "Coloque pelo menos uma palavra-chave").max(40)),
    showWhatsapp: z.boolean(),
    isFeatured: z.boolean(),
    active: z.boolean(),
    linkLabel: optionalText(40),
    linkUrl: optionalText(500).refine(
      (v) => v === null || v.startsWith("/") || /^https:\/\/\S+$/.test(v),
      "Use um caminho do site (ex.: /agenda) ou um link https://"
    ),
    sortOrder: z.coerce.number().int().default(0),
  })
  .refine((d) => (d.linkLabel === null) === (d.linkUrl === null), {
    message: "Preencha o texto e o link do botão (ou deixe os dois vazios)",
    path: ["linkUrl"],
  });

export type FaqFormValues = z.infer<typeof faqSchema>;
