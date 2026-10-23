BEGIN;

CREATE TABLE "DealSalaryTransfer" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "servicemanName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,

    CONSTRAINT "DealSalaryTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealSalaryTransfer_dealId_servicemanName_key" ON "DealSalaryTransfer"("dealId", "servicemanName");

CREATE INDEX "DealSalaryTransfer_servicemanName_year_month_idx" ON "DealSalaryTransfer"("servicemanName", "year", "month");

ALTER TABLE "DealSalaryTransfer" ADD CONSTRAINT "DealSalaryTransfer_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealSalaryTransfer" ADD CONSTRAINT "DealSalaryTransfer_servicemanName_fkey" FOREIGN KEY ("servicemanName") REFERENCES "Serviceman"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Прежний перенос — дата на всю сделку. Он переносится каждому участнику сделки (исполнители
-- позиций и участники дележа) расчётным месяцем этой даты: с 25-го числа — уже следующий.
-- Даты в базе — UTC, а период считается по времени Минска (TZ контейнера сервера)
INSERT INTO "DealSalaryTransfer" ("id", "dealId", "servicemanName", "year", "month")
SELECT gen_random_uuid()::text, p."dealId", p."name",
       EXTRACT(YEAR FROM p."local" + CASE WHEN EXTRACT(DAY FROM p."local") >= 25 THEN INTERVAL '1 month' ELSE INTERVAL '0' END)::int,
       EXTRACT(MONTH FROM p."local" + CASE WHEN EXTRACT(DAY FROM p."local") >= 25 THEN INTERVAL '1 month' ELSE INTERVAL '0' END)::int
FROM (
    SELECT DISTINCT d."id" AS "dealId",
           d."salaryDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Minsk' AS "local",
           COALESCE(s.elem->>'name', i."servicemanName") AS "name"
    FROM "Deal" d
    JOIN "RecordItem" i ON i."recordId" = d."recordId"
    LEFT JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(i."servicemanSplit") = 'array' THEN i."servicemanSplit" ELSE '[]'::jsonb END
    ) AS s(elem) ON TRUE
    WHERE d."salaryDate" IS NOT NULL
      AND (jsonb_typeof(i."servicemanSplit") = 'array' AND s.elem IS NOT NULL
           OR i."servicemanSplit" IS NULL OR jsonb_typeof(i."servicemanSplit") <> 'array')
) p
JOIN "Serviceman" sm ON sm."name" = p."name";

ALTER TABLE "Deal" DROP COLUMN "salaryDate";

COMMIT;
