import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Campos sensíveis que NENHUMA consulta traz por padrão. Pra ler, a consulta
 * tem que pedir explicitamente (`omit: { campo: false }`), e isso só acontece
 * em ação que checa permissão e registra na Auditoria (ver
 * src/lib/actions/volunteers.ts → revealBackgroundCheck).
 */
const SENSITIVE_OMIT = {
  volunteer: { backgroundCheckAnswer: true },
} as const;

function createClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter, omit: SENSITIVE_OMIT });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
