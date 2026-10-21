CREATE TABLE "WikiProduct" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sectionId" TEXT,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "addedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiProduct_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WikiProduct_entryId_idx" ON "WikiProduct"("entryId");

CREATE INDEX "WikiProduct_sectionId_idx" ON "WikiProduct"("sectionId");

ALTER TABLE "WikiProduct" ADD CONSTRAINT "WikiProduct_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WikiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WikiProduct" ADD CONSTRAINT "WikiProduct_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WikiSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
