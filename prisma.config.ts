import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

/**
 * O CLI do Prisma (migrate, studio) usa a conexão DIRETA do Neon, não o pooler:
 * o `migrate` segura uma trava de sessão (pg_advisory_lock) e, pelo pgbouncer
 * em modo transação, o "soltar a trava" pode ir pra outra conexão — a trava
 * fica presa e as próximas migrações dão timeout. O app (runtime) continua no
 * pooler via src/lib/prisma.ts.
 * Use DIRECT_URL se existir; senão tira o "-pooler" do host do DATABASE_URL.
 */
function directUrl(): string | undefined {
  if (process.env["DIRECT_URL"]) return process.env["DIRECT_URL"];
  const url = process.env["DATABASE_URL"];
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace("-pooler.", ".");
    return parsed.toString();
  } catch {
    return url;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl(),
  },
});
