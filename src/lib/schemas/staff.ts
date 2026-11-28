import { z } from "zod";

export const ROLE_VALUES = ["ADMIN", "MIDIA", "LIDER"] as const;

/** Convite: papéis gerais (Admin/Mídia) + os ministérios que a pessoa lidera. */
export const inviteMemberSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("E-mail inválido"),
    roles: z.array(z.enum(["ADMIN", "MIDIA"])),
    leaderOf: z.array(z.string().uuid()).transform((ids) => Array.from(new Set(ids))),
  })
  .refine((data) => data.roles.length + data.leaderOf.length > 0, {
    message: "Escolha ao menos um papel",
    path: ["roles"],
  });

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

export const grantRoleSchema = z
  .object({
    role: z.enum(ROLE_VALUES),
    ministryId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
  })
  .refine((data) => data.role !== "LIDER" || !!data.ministryId, {
    message: "Escolha o ministério do líder",
    path: ["ministryId"],
  });

export type GrantRoleValues = z.infer<typeof grantRoleSchema>;
