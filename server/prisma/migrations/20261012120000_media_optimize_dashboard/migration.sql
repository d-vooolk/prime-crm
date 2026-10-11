-- Сжатие фото/видео записей (превью, перекодирование видео) и скрытие сотрудников из дашборда
-- AlterTable
ALTER TABLE "Serviceman" ADD COLUMN "showInDashboard" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "RecordMedia" ADD COLUMN "processing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "optimized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "thumbFilename" TEXT;
