-- Страница записи для клиента (код записи, типы ремонта с фото и вопросами) и приём почты по IMAP
BEGIN;

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "publicToken" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "repairTypeId" TEXT;

-- CreateTable
CREATE TABLE "RepairType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "faq" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairTypePhoto" (
    "id" TEXT NOT NULL,
    "repairTypeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairTypePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "uidValidity" BIGINT NOT NULL,
    "uid" INTEGER NOT NULL,
    "messageId" TEXT,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "to" TEXT,
    "subject" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "preview" TEXT,
    "text" TEXT,
    "html" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "MailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailSyncState" (
    "mailbox" TEXT NOT NULL,
    "uidValidity" BIGINT NOT NULL,
    "lastUid" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSyncState_pkey" PRIMARY KEY ("mailbox")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepairType_name_key" ON "RepairType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RepairTypePhoto_filename_key" ON "RepairTypePhoto"("filename");

-- CreateIndex
CREATE INDEX "RepairTypePhoto_repairTypeId_idx" ON "RepairTypePhoto"("repairTypeId");

-- CreateIndex
CREATE INDEX "MailMessage_date_idx" ON "MailMessage"("date");

-- CreateIndex
CREATE INDEX "MailMessage_isRead_idx" ON "MailMessage"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_mailbox_uidValidity_uid_key" ON "MailMessage"("mailbox", "uidValidity", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "MailAttachment_filename_key" ON "MailAttachment"("filename");

-- CreateIndex
CREATE INDEX "MailAttachment_messageId_idx" ON "MailAttachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Record_publicToken_key" ON "Record"("publicToken");

-- CreateIndex
CREATE INDEX "Service_repairTypeId_idx" ON "Service"("repairTypeId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_repairTypeId_fkey" FOREIGN KEY ("repairTypeId") REFERENCES "RepairType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairTypePhoto" ADD CONSTRAINT "RepairTypePhoto_repairTypeId_fkey" FOREIGN KEY ("repairTypeId") REFERENCES "RepairType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Код страницы для уже существующих записей: 12 случайных символов
UPDATE "Record" SET "publicToken" = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) WHERE "publicToken" IS NULL;

COMMIT;
