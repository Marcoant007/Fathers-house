-- Escala dos Ministérios, parte 1: voluntários, funções e equipes.

ALTER TYPE "audit_action" ADD VALUE 'VIEW_SENSITIVE';
ALTER TYPE "audit_entity" ADD VALUE 'VOLUNTEER';
ALTER TYPE "audit_entity" ADD VALUE 'MINISTRY_FUNCTION';

CREATE TYPE "volunteer_availability" AS ENUM ('WEEK_AND_WEEKEND', 'WEEKEND_ONLY', 'WEEKDAYS_ONLY');
CREATE TYPE "sunday_shift" AS ENUM ('MORNING', 'NIGHT', 'BOTH');
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'INTERESTED');

-- Ministério e departamento viram o mesmo cadastro. Os que já existem continuam
-- aparecendo no site; quem tem escala é marcado pela importação/painel.
ALTER TABLE "ministries"
    ADD COLUMN "show_on_site" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "has_roster" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "volunteers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "availability" "volunteer_availability",
    "sunday_shift" "sunday_shift",
    "term_signed" BOOLEAN,
    "background_check_answer" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "volunteers_name_length" CHECK (char_length("name") BETWEEN 2 AND 120),
    CONSTRAINT "volunteers_phone_digits" CHECK ("phone" IS NULL OR "phone" ~ '^[0-9]{10,13}$'),
    CONSTRAINT "volunteers_notes_length" CHECK ("notes" IS NULL OR char_length("notes") <= 1000)
);
CREATE UNIQUE INDEX "volunteers_phone_key" ON "volunteers"("phone");
CREATE INDEX "volunteers_name_idx" ON "volunteers"("name");

CREATE TABLE "ministry_functions" (
    "id" UUID NOT NULL,
    "ministry_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ministry_functions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ministry_functions_name_length" CHECK (char_length("name") BETWEEN 2 AND 60)
);
CREATE UNIQUE INDEX "ministry_functions_ministry_id_name_key" ON "ministry_functions"("ministry_id", "name");
ALTER TABLE "ministry_functions" ADD CONSTRAINT "ministry_functions_ministry_id_fkey"
    FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "volunteer_memberships" (
    "id" UUID NOT NULL,
    "volunteer_id" UUID NOT NULL,
    "ministry_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "volunteer_memberships_volunteer_id_ministry_id_key" ON "volunteer_memberships"("volunteer_id", "ministry_id");
CREATE INDEX "volunteer_memberships_ministry_id_status_idx" ON "volunteer_memberships"("ministry_id", "status");
ALTER TABLE "volunteer_memberships" ADD CONSTRAINT "volunteer_memberships_volunteer_id_fkey"
    FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "volunteer_memberships" ADD CONSTRAINT "volunteer_memberships_ministry_id_fkey"
    FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "volunteer_membership_functions" (
    "membership_id" UUID NOT NULL,
    "function_id" UUID NOT NULL,

    CONSTRAINT "volunteer_membership_functions_pkey" PRIMARY KEY ("membership_id", "function_id")
);
ALTER TABLE "volunteer_membership_functions" ADD CONSTRAINT "volunteer_membership_functions_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "volunteer_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "volunteer_membership_functions" ADD CONSTRAINT "volunteer_membership_functions_function_id_fkey"
    FOREIGN KEY ("function_id") REFERENCES "ministry_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
