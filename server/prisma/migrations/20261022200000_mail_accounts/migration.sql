-- Несколько почтовых ящиков: у письма и состояния синхронизации — адрес ящика.
-- Старые строки получают адрес первого ящика (MAIL_USER) при старте сервера (mail.service.ts)
-- DropIndex
DROP INDEX "MailMessage_isRead_idx";

-- DropIndex
DROP INDEX "MailMessage_mailbox_uidValidity_uid_key";

-- AlterTable
ALTER TABLE "MailMessage" ADD COLUMN     "account" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "MailSyncState" DROP CONSTRAINT "MailSyncState_pkey",
ADD COLUMN     "account" TEXT NOT NULL DEFAULT '',
ADD CONSTRAINT "MailSyncState_pkey" PRIMARY KEY ("account", "mailbox");

-- CreateIndex
CREATE INDEX "MailMessage_account_isRead_idx" ON "MailMessage"("account", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_account_mailbox_uidValidity_uid_key" ON "MailMessage"("account", "mailbox", "uidValidity", "uid");

