-- Отмена заказа сотрудника из магазина vdf.by в бухгалтерии
ALTER TYPE "VdfOrderStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "VdfOrder" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledByName" TEXT,
ADD COLUMN "cancelReason" TEXT;
