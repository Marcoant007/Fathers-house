-- Escala dos Ministérios, parte 2: mês de escala, cultos do mês e respostas de disponibilidade.

ALTER TYPE "audit_entity" ADD VALUE 'ROSTER_PERIOD';

CREATE TABLE "roster_periods" (
  "id" UUID NOT NULL,
  "month" TEXT NOT NULL,
  "closes_at" TIMESTAMPTZ(6) NOT NULL,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "roster_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roster_periods_month_format" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE UNIQUE INDEX "roster_periods_month_key" ON "roster_periods"("month");
ALTER TABLE "roster_periods" ADD CONSTRAINT "roster_periods_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "roster_slots" (
  "id" UUID NOT NULL,
  "period_id" UUID NOT NULL,
  "service_id" UUID,
  "label" TEXT NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "roster_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roster_slots_label_length" CHECK (char_length("label") BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX "roster_slots_period_id_starts_at_key" ON "roster_slots"("period_id", "starts_at");
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "roster_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "availability_responses" (
  "id" UUID NOT NULL,
  "period_id" UUID NOT NULL,
  "volunteer_id" UUID NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "availability_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_responses_note_length" CHECK ("note" IS NULL OR char_length("note") <= 300)
);
CREATE UNIQUE INDEX "availability_responses_period_id_volunteer_id_key"
  ON "availability_responses"("period_id", "volunteer_id");
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "roster_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_volunteer_id_fkey"
  FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "availability_response_slots" (
  "response_id" UUID NOT NULL,
  "slot_id" UUID NOT NULL,
  CONSTRAINT "availability_response_slots_pkey" PRIMARY KEY ("response_id", "slot_id")
);
ALTER TABLE "availability_response_slots" ADD CONSTRAINT "availability_response_slots_response_id_fkey"
  FOREIGN KEY ("response_id") REFERENCES "availability_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "availability_response_slots" ADD CONSTRAINT "availability_response_slots_slot_id_fkey"
  FOREIGN KEY ("slot_id") REFERENCES "roster_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
