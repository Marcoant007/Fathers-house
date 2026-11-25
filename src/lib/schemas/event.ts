import { z } from "zod";
import { parseSaoPauloInput } from "@/lib/datetime";
import { optionalImagePath } from "@/lib/schemas/image-path";

export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Título muito curto").max(120),
    // datetime-local sem fuso = horário de Brasília (src/lib/datetime.ts)
    startsAt: z.preprocess(parseSaoPauloInput, z.coerce.date({ error: "Data/hora de início inválida" })),
    endsAt: z.preprocess(parseSaoPauloInput, z.coerce.date({ error: "Data/hora de término inválida" })),
    location: z.string().trim().max(160).optional().or(z.literal("")),
    registrationUrl: z
      .string()
      .trim()
      .url("Precisa ser uma URL válida")
      .refine((url) => url.startsWith("https://"), "O link precisa começar com https://")
      .optional()
      .or(z.literal("")),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    coverPath: optionalImagePath(),
    ministryId: z.string().uuid().optional().or(z.literal("")),
    isFeatured: z.boolean().default(false),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    // Inscrições (FA-28)
    registrationMode: z.enum(["NONE", "EXTERNAL", "INTERNAL"]).default("NONE"),
    capacity: z
      .union([z.literal(""), z.coerce.number().int("Só números inteiros").min(1, "Pelo menos 1 vaga").max(100000)])
      .optional(),
    registrationClosesOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .optional()
      .or(z.literal("")),
    askPartySize: z.boolean().default(false),
    askFirstTime: z.boolean().default(false),
  })
  .refine((data) => data.registrationMode !== "EXTERNAL" || !!data.registrationUrl, {
    message: "Cole o link do formulário externo",
    path: ["registrationUrl"],
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "O término precisa ser depois do início",
    path: ["endsAt"],
  });

export type EventFormValues = z.infer<typeof eventSchema>;
