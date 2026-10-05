-- Заказы сотрудников из магазина vdf.by, ожидающие исполнения в бухгалтерии
BEGIN;

-- CreateEnum
CREATE TYPE "VdfOrderStatus" AS ENUM ('PENDING', 'EXECUTED');

-- CreateTable
CREATE TABLE "VdfOrder" (
    "id" TEXT NOT NULL,
    "shopOrderId" INTEGER NOT NULL,
    "status" "VdfOrderStatus" NOT NULL DEFAULT 'PENDING',
    "employeeName" TEXT NOT NULL,
    "employeePhone" TEXT,
    "items" JSONB NOT NULL,
    "shopTotal" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "amountEdited" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "shopCancelled" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "executedByName" TEXT,
    "cashTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VdfOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VdfOrder_shopOrderId_key" ON "VdfOrder"("shopOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "VdfOrder_cashTransactionId_key" ON "VdfOrder"("cashTransactionId");

-- CreateIndex
CREATE INDEX "VdfOrder_status_idx" ON "VdfOrder"("status");

-- AddForeignKey
ALTER TABLE "VdfOrder" ADD CONSTRAINT "VdfOrder_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
