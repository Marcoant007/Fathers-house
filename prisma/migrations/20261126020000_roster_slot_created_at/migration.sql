-- Quando cada culto entrou na lista do mês. Serve pra saber se quem respondeu
-- já viu o culto (culto incluído depois, pelo "Atualizar cultos do mês", aparece
-- como "?" pra quem respondeu antes). Linhas que já existem recebem a data de
-- abertura do mês, pra as respostas atuais continuarem valendo.
ALTER TABLE "roster_slots" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "roster_slots" s SET "created_at" = p."created_at" FROM "roster_periods" p WHERE s."period_id" = p."id";
