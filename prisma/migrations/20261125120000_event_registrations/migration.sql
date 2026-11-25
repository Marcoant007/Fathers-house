-- CreateEnum
CREATE TYPE "registration_mode" AS ENUM ('NONE', 'EXTERNAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "registration_status" AS ENUM ('CONFIRMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "audit_action" ADD VALUE 'EXPORT';

-- AlterEnum
ALTER TYPE "audit_entity" ADD VALUE 'REGISTRATION';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "ask_first_time" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ask_party_size" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "registration_closes_at" TIMESTAMPTZ(6),
ADD COLUMN     "registration_mode" "registration_mode" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL DEFAULT 1,
    "first_time" BOOLEAN,
    "status" "registration_status" NOT NULL DEFAULT 'CONFIRMED',
    "source" TEXT NOT NULL DEFAULT 'site',
    "checked_in_at" TIMESTAMPTZ(6),
    "seen_at" TIMESTAMPTZ(6),
    "consent_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_registrations_event_id_created_at_idx" ON "event_registrations"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "event_registrations_seen_at_idx" ON "event_registrations"("seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_event_id_phone_key" ON "event_registrations"("event_id", "phone");

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Eventos que já tinham link de inscrição passam a ser "link externo".
UPDATE "events" SET "registration_mode" = 'EXTERNAL' WHERE "registration_url" IS NOT NULL AND "registration_url" <> '';

ALTER TABLE "events"
  ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);

ALTER TABLE "event_registrations"
  ADD CONSTRAINT "event_registrations_party_size_range" CHECK ("party_size" BETWEEN 1 AND 20),
  ADD CONSTRAINT "event_registrations_name_len" CHECK (char_length(btrim("name")) BETWEEN 2 AND 120),
  ADD CONSTRAINT "event_registrations_phone_digits" CHECK ("phone" ~ '^[0-9]{10,15}$'),
  ADD CONSTRAINT "event_registrations_source" CHECK ("source" IN ('site', 'qr'));
