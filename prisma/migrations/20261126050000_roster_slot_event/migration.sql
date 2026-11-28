-- Escala: além dos cultos fixos (services), os eventos do mês (events) também
-- entram na lista do mês e têm escala.

ALTER TABLE "roster_slots" ADD COLUMN "event_id" UUID;
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "roster_slots_event_id_idx" ON "roster_slots"("event_id");
