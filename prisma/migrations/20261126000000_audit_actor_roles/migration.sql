-- Papéis da pessoa no momento da ação ("Mídia · Líder (Kids)"), copiados como
-- texto: se o papel mudar depois, o histórico continua dizendo em que papel
-- ela agiu. Linhas antigas ficam NULL (a tabela é só-inserção).
ALTER TABLE "audit_logs" ADD COLUMN "actor_roles" TEXT;
