-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "importKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Record_importKey_key" ON "Record"("importKey");

