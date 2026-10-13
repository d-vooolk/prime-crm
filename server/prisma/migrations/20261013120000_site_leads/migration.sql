-- CreateEnum
CREATE TYPE "SiteLeadStatus" AS ENUM ('NEW', 'DONE', 'RECORDED');

-- CreateTable
CREATE TABLE "SiteLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "page" TEXT,
    "source" TEXT,
    "photos" TEXT[],
    "status" "SiteLeadStatus" NOT NULL DEFAULT 'NEW',
    "handledAt" TIMESTAMP(3),
    "handledByName" TEXT,
    "recordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteLead_status_createdAt_idx" ON "SiteLead"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SiteLead" ADD CONSTRAINT "SiteLead_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

