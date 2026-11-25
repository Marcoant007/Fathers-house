-- Menu "Live" (FA-19/FA-20): cada culto transmitido vira uma linha, em vez de
-- um único link em site_settings que era sobrescrito toda semana.

ALTER TYPE "audit_entity" ADD VALUE 'LIVE_STREAM';

CREATE TABLE "live_streams" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "youtube_url" TEXT,
    "spotify_url" TEXT,
    "description" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "live_streams_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "live_streams_title_length" CHECK (char_length("title") BETWEEN 2 AND 140),
    CONSTRAINT "live_streams_has_link" CHECK ("youtube_url" IS NOT NULL OR "spotify_url" IS NOT NULL)
);

CREATE INDEX "live_streams_starts_at_idx" ON "live_streams"("starts_at");

-- A live que estava cadastrada em Aparência vira a primeira da lista.
INSERT INTO "live_streams" ("id", "title", "starts_at", "youtube_url", "spotify_url", "updated_at")
SELECT gen_random_uuid(), 'Culto ao vivo', COALESCE("live_at", "updated_at"), "live_video_url", "live_audio_url", now()
FROM "site_settings"
WHERE "live_video_url" IS NOT NULL OR "live_audio_url" IS NOT NULL;

-- Canal do Spotify da igreja (o do YouTube já existia).
ALTER TABLE "site_settings"
    DROP COLUMN "live_at",
    DROP COLUMN "live_audio_url",
    DROP COLUMN "live_video_url",
    ADD COLUMN "spotify" TEXT;
