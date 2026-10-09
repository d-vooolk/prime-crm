-- Обнаруженные недостатки переезжают из сделки в запись: их пишут в карточке ещё до закрытия
BEGIN;

ALTER TABLE "Record" ADD COLUMN "defects" TEXT;

UPDATE "Record" r SET "defects" = d."defects"
FROM "Deal" d
WHERE d."recordId" = r."id" AND d."defects" IS NOT NULL AND d."defects" <> '';

ALTER TABLE "Deal" DROP COLUMN "defects";

COMMIT;
