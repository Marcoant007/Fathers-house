-- Descrição do culto fixo (menu Cultos), mostrada na Agenda em "Toda semana".
ALTER TABLE "services" ADD COLUMN "description" TEXT;
ALTER TABLE "services" ADD CONSTRAINT "services_description_length" CHECK ("description" IS NULL OR char_length("description") <= 500);
