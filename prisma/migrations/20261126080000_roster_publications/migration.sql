-- Escala, parte 3b: publicar a escala do ministério no mês. A equipe passa a
-- ver as próprias datas no link do mês. Sem linha = rascunho.

CREATE TABLE "roster_publications" (
  "period_id" UUID NOT NULL,
  "ministry_id" UUID NOT NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_by_id" UUID,
  CONSTRAINT "roster_publications_pkey" PRIMARY KEY ("period_id", "ministry_id")
);
CREATE INDEX "roster_publications_ministry_id_idx" ON "roster_publications"("ministry_id");
ALTER TABLE "roster_publications" ADD CONSTRAINT "roster_publications_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "roster_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roster_publications" ADD CONSTRAINT "roster_publications_ministry_id_fkey"
  FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roster_publications" ADD CONSTRAINT "roster_publications_published_by_id_fkey"
  FOREIGN KEY ("published_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
