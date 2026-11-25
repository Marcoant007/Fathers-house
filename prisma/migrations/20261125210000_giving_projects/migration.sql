-- Carrossel "Projetos da igreja" na seção Contribua (dízimos e ofertas).

ALTER TYPE "audit_entity" ADD VALUE 'GIVING_PROJECT';

CREATE TABLE "giving_projects" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_path" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "giving_projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "giving_projects_title_length" CHECK (char_length("title") BETWEEN 2 AND 80),
    CONSTRAINT "giving_projects_description_length" CHECK ("description" IS NULL OR char_length("description") <= 400),
    CONSTRAINT "giving_projects_image_path" CHECK ("image_path" LIKE 'https://%' OR "image_path" LIKE '/%')
);

CREATE INDEX "giving_projects_sort_order_idx" ON "giving_projects"("sort_order");
