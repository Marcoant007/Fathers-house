-- Mais detalhes do voluntário (da planilha / inscrição): aniversário, estado civil,
-- cidade, batismo e ano de conversão. Só aparecem em "Editar".

CREATE TYPE "marital_status" AS ENUM ('SINGLE', 'MARRIED', 'STABLE_UNION', 'DIVORCED', 'WIDOWED');

ALTER TABLE "volunteers"
  ADD COLUMN "birth_day" INTEGER,
  ADD COLUMN "birth_month" INTEGER,
  ADD COLUMN "birth_year" INTEGER,
  ADD COLUMN "marital_status" "marital_status",
  ADD COLUMN "city" TEXT,
  ADD COLUMN "baptized" BOOLEAN,
  ADD COLUMN "converted_year" INTEGER;

ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_birth_day_month"
  CHECK (("birth_day" IS NULL) = ("birth_month" IS NULL));
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_birth_day_range"
  CHECK ("birth_day" IS NULL OR "birth_day" BETWEEN 1 AND 31);
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_birth_month_range"
  CHECK ("birth_month" IS NULL OR "birth_month" BETWEEN 1 AND 12);
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_birth_year_range"
  CHECK ("birth_year" IS NULL OR "birth_year" BETWEEN 1900 AND 2100);
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_converted_year_range"
  CHECK ("converted_year" IS NULL OR "converted_year" BETWEEN 1900 AND 2100);
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_city_length"
  CHECK ("city" IS NULL OR char_length("city") <= 80);

CREATE INDEX "volunteers_birth_month_idx" ON "volunteers"("birth_month");
