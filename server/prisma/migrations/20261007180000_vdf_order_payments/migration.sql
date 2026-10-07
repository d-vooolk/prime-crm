-- Частичное исполнение заказов vdf.by: у заказа может быть несколько оплат (расходов в кассе)
BEGIN;

-- CreateTable
CREATE TABLE "VdfOrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "cashTransactionId" TEXT NOT NULL,
    "paidByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VdfOrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VdfOrderPayment_cashTransactionId_key" ON "VdfOrderPayment"("cashTransactionId");

-- CreateIndex
CREATE INDEX "VdfOrderPayment_orderId_idx" ON "VdfOrderPayment"("orderId");

-- AddForeignKey
ALTER TABLE "VdfOrderPayment" ADD CONSTRAINT "VdfOrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VdfOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VdfOrderPayment" ADD CONSTRAINT "VdfOrderPayment_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Расходы уже исполненных заказов становятся их единственной оплатой
INSERT INTO "VdfOrderPayment" ("id", "orderId", "cashTransactionId", "paidByName", "createdAt")
SELECT 'vdfpay_' || "id", "id", "cashTransactionId", "executedByName", COALESCE("executedAt", "updatedAt")
FROM "VdfOrder"
WHERE "cashTransactionId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "VdfOrder" DROP CONSTRAINT "VdfOrder_cashTransactionId_fkey";

-- DropIndex
DROP INDEX "VdfOrder_cashTransactionId_key";

-- AlterTable
ALTER TABLE "VdfOrder" DROP COLUMN "cashTransactionId";

COMMIT;
