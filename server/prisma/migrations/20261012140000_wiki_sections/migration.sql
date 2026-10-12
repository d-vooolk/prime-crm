-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "wikiSectionId" TEXT;

-- AlterTable
ALTER TABLE "WikiMedia" ADD COLUMN     "sectionId" TEXT;

-- AlterTable
ALTER TABLE "WikiRevision" ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "WikiSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiEntrySection" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiEntrySection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WikiSection_name_key" ON "WikiSection"("name");

-- CreateIndex
CREATE INDEX "WikiEntrySection_sectionId_idx" ON "WikiEntrySection"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiEntrySection_entryId_sectionId_key" ON "WikiEntrySection"("entryId", "sectionId");

-- CreateIndex
CREATE INDEX "Service_wikiSectionId_idx" ON "Service"("wikiSectionId");

-- CreateIndex
CREATE INDEX "WikiMedia_sectionId_idx" ON "WikiMedia"("sectionId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_wikiSectionId_fkey" FOREIGN KEY ("wikiSectionId") REFERENCES "WikiSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiEntrySection" ADD CONSTRAINT "WikiEntrySection_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WikiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiEntrySection" ADD CONSTRAINT "WikiEntrySection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WikiSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiMedia" ADD CONSTRAINT "WikiMedia_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WikiSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiRevision" ADD CONSTRAINT "WikiRevision_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WikiSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

