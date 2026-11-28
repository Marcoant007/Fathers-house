import { z } from "zod";
import { normalizePhone } from "@/lib/volunteer-import";

const emptyToNull = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .enum(values)
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v));

/** Número inteiro opcional vindo de um campo de texto/select ("" = não informado). */
const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

/** Formulário de voluntário do painel (adicionar e editar). */
export const volunteerSchema = z
  .object({
    name: z.string().trim().min(2, "Nome muito curto").max(120, "Máximo de 120 caracteres"),
    /** Vazio = sem telefone. Número sem DDD ganha o 27. Sai só com dígitos e 55. */
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const phone = normalizePhone(v);
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "Confira o número, ex.: (27) 99999-0000" });
          return z.NEVER;
        }
        return phone;
      }),
    availability: emptyToNull(["WEEK_AND_WEEKEND", "WEEKEND_ONLY", "WEEKDAYS_ONLY"]),
    sundayShift: emptyToNull(["MORNING", "NIGHT", "BOTH"]),
    termSigned: z
      .enum(["yes", "no", ""])
      .transform((v) => (v === "yes" ? true : v === "no" ? false : null)),
    functionIds: z.array(z.string().uuid()).transform((ids) => Array.from(new Set(ids))),
    // Mais detalhes (opcionais)
    birthDay: optionalInt(1, 31, "Escolha o dia"),
    birthMonth: optionalInt(1, 12, "Escolha o mês"),
    birthYear: optionalInt(1900, new Date().getFullYear(), "Ano inválido"),
    maritalStatus: emptyToNull(["SINGLE", "MARRIED", "STABLE_UNION", "DIVORCED", "WIDOWED"]),
    city: z
      .string()
      .trim()
      .max(80, "Máximo de 80 caracteres")
      .transform((v) => v || null),
    baptized: z
      .enum(["yes", "no", ""])
      .transform((v) => (v === "yes" ? true : v === "no" ? false : null)),
    convertedYear: optionalInt(1900, new Date().getFullYear(), "Ano inválido"),
  })
  .superRefine((data, ctx) => {
    if ((data.birthDay == null) !== (data.birthMonth == null)) {
      ctx.addIssue({ code: "custom", path: ["birthDay"], message: "Escolha o dia e o mês do aniversário" });
    }
    if (data.birthYear != null && data.birthDay == null) {
      ctx.addIssue({ code: "custom", path: ["birthDay"], message: "Escolha também o dia e o mês" });
    }
  });

export type VolunteerFormValues = z.infer<typeof volunteerSchema>;

export const functionNameSchema = z
  .string()
  .trim()
  .min(2, "Nome muito curto")
  .max(60, "Máximo de 60 caracteres");
