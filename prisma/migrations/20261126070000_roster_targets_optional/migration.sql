-- Escala: a quantidade de pessoas por culto vira meta OPCIONAL (0 = sem meta).
-- Os padrões antigos (2 por culto, 1 por função) não foram escolhidos pela
-- igreja e pareciam limite ("2 de 2"). Valores mudados por alguém ficam.

ALTER TABLE "ministries" ALTER COLUMN "roster_per_service" SET DEFAULT 0;
ALTER TABLE "ministry_functions" ALTER COLUMN "per_service" SET DEFAULT 0;
UPDATE "ministries" SET "roster_per_service" = 0 WHERE "roster_per_service" = 2;
UPDATE "ministry_functions" SET "per_service" = 0 WHERE "per_service" = 1;
