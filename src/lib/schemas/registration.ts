import { z } from "zod";
import { normalizePhone } from "@/lib/registration-rules";

/** Formulário público de inscrição (FA-29). Os extras só valem se o evento pedir. */
export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Digite seu nome").max(120, "Nome muito longo"),
  phone: z
    .string()
    .transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Confira o WhatsApp, com DDD. Ex.: (27) 99999-0000" });
        return z.NEVER;
      }
      return phone;
    }),
  partySize: z.coerce
    .number({ error: "Quantas pessoas?" })
    .int()
    .min(1, "Pelo menos 1")
    .max(20, "Pra mais de 20 pessoas, fale com a gente no WhatsApp"),
  firstTime: z.enum(["sim", "nao", ""]).transform((v) => (v === "" ? null : v === "sim")),
  consent: z.literal("on", { error: "Precisamos da sua autorização pra guardar a inscrição" }),
  source: z.enum(["site", "qr"]).catch("site"),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
