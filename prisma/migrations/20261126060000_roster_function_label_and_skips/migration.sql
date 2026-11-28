-- Escala: função digitada na hora de escalar, e ministério que não serve num
-- culto/evento (opcional; sem linha = serve).

ALTER TABLE "roster_assignments" ADD COLUMN "function_label" TEXT;
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_function_label_check"
  CHECK ("function_label" IS NULL OR char_length("function_label") BETWEEN 1 AND 40);

CREATE TABLE "roster_slot_skips" (
  "slot_id" UUID NOT NULL,
  "ministry_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roster_slot_skips_pkey" PRIMARY KEY ("slot_id", "ministry_id")
);
CREATE INDEX "roster_slot_skips_ministry_id_idx" ON "roster_slot_skips"("ministry_id");
ALTER TABLE "roster_slot_skips" ADD CONSTRAINT "roster_slot_skips_slot_id_fkey"
  FOREIGN KEY ("slot_id") REFERENCES "roster_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roster_slot_skips" ADD CONSTRAINT "roster_slot_skips_ministry_id_fkey"
  FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
