-- Услуги, которые не предлагаются в «Открытых возможностях» карточки записи
-- AlterTable
ALTER TABLE "Service" ADD COLUMN "excludeFromOpportunities" BOOLEAN NOT NULL DEFAULT false;
