-- Escala dos Ministérios, parte 3: escala montada (quem serve em cada culto) e
-- quantas pessoas cada ministério/função precisa por culto.

ALTER TABLE "ministries" ADD COLUMN "roster_per_service" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ministries" ADD CONSTRAINT "ministries_roster_per_service_range"
  CHECK ("roster_per_service" BETWEEN 0 AND 30);

ALTER TABLE "ministry_functions" ADD COLUMN "per_service" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ministry_functions" ADD CONSTRAINT "ministry_functions_per_service_range"
  CHECK ("per_service" BETWEEN 0 AND 30);

CREATE TABLE "roster_assignments" (
  "id" UUID NOT NULL,
  "slot_id" UUID NOT NULL,
  "ministry_id" UUID NOT NULL,
  "volunteer_id" UUID NOT NULL,
  "function_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roster_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roster_assignments_slot_id_ministry_id_volunteer_id_key"
  ON "roster_assignments"("slot_id", "ministry_id", "volunteer_id");
CREATE INDEX "roster_assignments_ministry_id_idx" ON "roster_assignments"("ministry_id");
CREATE INDEX "roster_assignments_volunteer_id_idx" ON "roster_assignments"("volunteer_id");
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_slot_id_fkey"
  FOREIGN KEY ("slot_id") REFERENCES "roster_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_ministry_id_fkey"
  FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_volunteer_id_fkey"
  FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_function_id_fkey"
  FOREIGN KEY ("function_id") REFERENCES "ministry_functions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
