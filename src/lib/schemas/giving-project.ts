import { z } from "zod";
import { imagePath } from "@/lib/schemas/image-path";

export const givingProjectSchema = z.object({
  title: z.string().trim().min(2, "Nome muito curto").max(80, "Máximo de 80 caracteres"),
  description: z
    .string()
    .trim()
    .max(400, "Máximo de 400 caracteres")
    .transform((v) => (v === "" ? null : v)),
  imagePath: z.string().trim().min(1, "Escolha uma foto do projeto").pipe(imagePath()),
  visible: z.boolean(),
});

export type GivingProjectFormValues = z.infer<typeof givingProjectSchema>;
