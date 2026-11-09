-- CreateEnum
CREATE TYPE "ServicemanBadge" AS ENUM ('EMPLOYEE', 'ADMIN', 'OTHER');

-- AlterTable
ALTER TABLE "Serviceman" ADD COLUMN "badge" "ServicemanBadge";
