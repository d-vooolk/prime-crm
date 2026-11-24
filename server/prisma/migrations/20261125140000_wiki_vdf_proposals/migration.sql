-- AlterEnum
ALTER TYPE "WikiRevisionStatus" ADD VALUE 'DRAFT';
ALTER TYPE "WikiRevisionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "WikiRevision" ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "proposalText" TEXT,
ADD COLUMN "authorPhone" TEXT;

ALTER TABLE "WikiMedia" ADD COLUMN "revisionId" TEXT;
ALTER TABLE "WikiProduct" ADD COLUMN "revisionId" TEXT;

-- CreateIndex
CREATE INDEX "WikiRevision_authorId_idx" ON "WikiRevision"("authorId");
CREATE INDEX "WikiMedia_revisionId_idx" ON "WikiMedia"("revisionId");
CREATE INDEX "WikiProduct_revisionId_idx" ON "WikiProduct"("revisionId");

-- AddForeignKey
ALTER TABLE "WikiMedia" ADD CONSTRAINT "WikiMedia_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WikiRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WikiProduct" ADD CONSTRAINT "WikiProduct_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WikiRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
