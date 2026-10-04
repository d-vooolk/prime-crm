-- Безопасность, деньги в DECIMAL, связи сотрудников по ФИО внешними ключами, индексы,
-- журнал изменений, склад, медиа в записях, источник клиента.
-- Целиком в транзакции: при любой ошибке база остаётся как была.
BEGIN;

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('INSTAGRAM', 'RECOMMENDATION', 'SEARCH', 'MAPS', 'OTHER');

-- CreateEnum
CREATE TYPE "RecordMediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "clientSource" "ClientSource",
ALTER COLUMN "serviceman" DROP NOT NULL;

-- Подготовка данных к внешним ключам на Serviceman.name:
-- пустая строка вместо мастера/исполнителя — это «не указан», то есть NULL
UPDATE "Record" SET "serviceman" = NULL WHERE "serviceman" = '';
UPDATE "Record" SET "receptionist" = NULL WHERE "receptionist" = '';
UPDATE "RecordItem" SET "servicemanName" = NULL WHERE "servicemanName" = '';
-- ФИО, которых уже нет среди сотрудников (удалённые раньше), сохраняем как уволенных —
-- иначе внешний ключ не создать, а историю терять нельзя
INSERT INTO "Serviceman" ("id", "name", "isDismissed")
SELECT 'legacy_' || md5(x.n), x.n, true
FROM (
  SELECT "serviceman" AS n FROM "Record"
  UNION SELECT "receptionist" FROM "Record"
  UNION SELECT "servicemanName" FROM "RecordItem"
  UNION SELECT "servicemanName" FROM "EmployeeSalaryPayment"
  UNION SELECT "servicemanName" FROM "SalaryAdjustment"
  UNION SELECT "person" FROM "FounderSalary"
) x
WHERE x.n IS NOT NULL AND x.n <> ''
  AND NOT EXISTS (SELECT 1 FROM "Serviceman" s WHERE s."name" = x.n);

-- AlterTable
ALTER TABLE "RecordItem" ALTER COLUMN "price" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "netProfit" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "prepaidAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "prepaidCurrencyAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "standardPrice" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "finalPrice" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "splitCashAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "splitCardAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Equipment" ALTER COLUMN "wholesalePrice" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "retailPrice" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Serviceman" DROP COLUMN "plainPassword";

-- AlterTable
ALTER TABLE "SalaryRate" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "CashTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "currencyAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "FounderSalary" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "EmployeeSalaryPayment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "cardAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "SalaryAdjustment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "CapitalTransaction" ALTER COLUMN "amountByn" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "amountUsd" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "amountEur" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Debt" ALTER COLUMN "initialAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "remainingAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "DebtPayment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "MonthlyRevenue" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "WikiRevision" ALTER COLUMN "bonusAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "bonusBaseAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "WikiSettings" ALTER COLUMN "bonusAmount" SET DATA TYPE DECIMAL(14,2);

-- CreateTable
CREATE TABLE "RecordMedia" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" "RecordMediaType" NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minQuantity" DECIMAL(14,3),
    "purchasePrice" DECIMAL(14,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "delta" DECIMAL(14,3) NOT NULL,
    "quantityAfter" DECIMAL(14,3) NOT NULL,
    "comment" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordMedia_filename_key" ON "RecordMedia"("filename");

-- CreateIndex
CREATE INDEX "RecordMedia_recordId_idx" ON "RecordMedia"("recordId");

-- CreateIndex
CREATE INDEX "RecordMedia_expiresAt_idx" ON "RecordMedia"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_model_entityId_idx" ON "AuditLog"("model", "entityId");

-- CreateIndex
CREATE INDEX "StockCategory_parentId_idx" ON "StockCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCategory_parentId_name_key" ON "StockCategory"("parentId", "name");

-- CreateIndex
CREATE INDEX "StockItem_categoryId_idx" ON "StockItem"("categoryId");

-- CreateIndex
CREATE INDEX "StockItem_name_idx" ON "StockItem"("name");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "Record_scheduledAt_idx" ON "Record"("scheduledAt");

-- CreateIndex
CREATE INDEX "Record_status_scheduledAt_idx" ON "Record"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Record_clientId_idx" ON "Record"("clientId");

-- CreateIndex
CREATE INDEX "Record_carId_idx" ON "Record"("carId");

-- CreateIndex
CREATE INDEX "Record_clientSource_idx" ON "Record"("clientSource");

-- CreateIndex
CREATE INDEX "RecordItem_recordId_idx" ON "RecordItem"("recordId");

-- CreateIndex
CREATE INDEX "RecordItem_serviceId_idx" ON "RecordItem"("serviceId");

-- CreateIndex
CREATE INDEX "Deal_closedAt_idx" ON "Deal"("closedAt");

-- CreateIndex
CREATE INDEX "CashTransaction_date_idx" ON "CashTransaction"("date");

-- CreateIndex
CREATE INDEX "CashTransaction_recordId_idx" ON "CashTransaction"("recordId");

-- CreateIndex
CREATE INDEX "SalaryAdjustment_servicemanName_year_month_idx" ON "SalaryAdjustment"("servicemanName", "year", "month");

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_serviceman_fkey" FOREIGN KEY ("serviceman") REFERENCES "Serviceman"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_receptionist_fkey" FOREIGN KEY ("receptionist") REFERENCES "Serviceman"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordMedia" ADD CONSTRAINT "RecordMedia_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordItem" ADD CONSTRAINT "RecordItem_servicemanName_fkey" FOREIGN KEY ("servicemanName") REFERENCES "Serviceman"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderSalary" ADD CONSTRAINT "FounderSalary_person_fkey" FOREIGN KEY ("person") REFERENCES "Serviceman"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryPayment" ADD CONSTRAINT "EmployeeSalaryPayment_servicemanName_fkey" FOREIGN KEY ("servicemanName") REFERENCES "Serviceman"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdjustment" ADD CONSTRAINT "SalaryAdjustment_servicemanName_fkey" FOREIGN KEY ("servicemanName") REFERENCES "Serviceman"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCategory" ADD CONSTRAINT "StockCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StockCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StockCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
