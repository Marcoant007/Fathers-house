-- Ícone do ministério escolhido no painel. NULL = automático pelo nome
-- (src/lib/ministry-icons.ts). A lista de chaves válidas é validada no Zod.
ALTER TABLE "ministries" ADD COLUMN "icon" TEXT;
ALTER TABLE "ministries" ADD CONSTRAINT "ministries_icon_format" CHECK ("icon" IS NULL OR "icon" ~ '^[a-z]{2,30}$');
