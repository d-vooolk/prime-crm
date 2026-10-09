-- Источник клиента: из перечисления в справочник, который правится в настройках.
-- Тип "ClientSource" удаляется до создания таблицы с тем же именем (у таблицы в Postgres свой тип)
BEGIN;

ALTER TABLE "Record" ADD COLUMN "clientSourceId" TEXT;

UPDATE "Record" SET "clientSourceId" = CASE "clientSource"
  WHEN 'INSTAGRAM' THEN 'src_instagram'
  WHEN 'RECOMMENDATION' THEN 'src_recommendation'
  WHEN 'SEARCH' THEN 'src_search'
  WHEN 'MAPS' THEN 'src_maps'
  WHEN 'OTHER' THEN 'src_other'
END
WHERE "clientSource" IS NOT NULL;

DROP INDEX "Record_clientSource_idx";
ALTER TABLE "Record" DROP COLUMN "clientSource";
DROP TYPE "ClientSource";

CREATE TABLE "ClientSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientSource_name_key" ON "ClientSource"("name");

-- Прежние варианты списка — в том же порядке
INSERT INTO "ClientSource" ("id", "name", "sortOrder") VALUES
  ('src_instagram', 'Instagram', 1),
  ('src_recommendation', 'Рекомендация', 2),
  ('src_search', 'Поиск', 3),
  ('src_maps', 'Карты', 4),
  ('src_other', 'Другое', 5);

CREATE INDEX "Record_clientSourceId_idx" ON "Record"("clientSourceId");

ALTER TABLE "Record" ADD CONSTRAINT "Record_clientSourceId_fkey" FOREIGN KEY ("clientSourceId") REFERENCES "ClientSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
