-- AlterEnum
ALTER TYPE "WikiRevisionStatus" ADD VALUE 'CHANGES_REQUESTED';

-- AlterTable
ALTER TABLE "WikiRevision" ADD COLUMN "reviewNotes" JSONB;
