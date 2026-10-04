-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmsType" AS ENUM ('ON_CREATE', 'REMINDER', 'CAR_READY', 'REVIEW_REQUEST');

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('INCOME', 'INCOME_RS', 'EXPENSE', 'MANUAL_INCOME');

-- CreateEnum
CREATE TYPE "CapitalTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "SalaryAdjustmentType" AS ENUM ('FINE', 'BONUS');

-- CreateEnum
CREATE TYPE "SalaryPaymentType" AS ENUM ('ADVANCE', 'FINAL');

-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('WE_OWE', 'OWED_TO_US');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'SETTLED');

-- CreateEnum
CREATE TYPE "NotePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('SNAPSHOT', 'MANUAL');

-- CreateEnum
CREATE TYPE "WikiMediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "WikiRevisionStatus" AS ENUM ('PENDING', 'REVIEWED', 'REWARDED');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "generation" TEXT,
    "generationId" TEXT,
    "generationName" TEXT,
    "year" TEXT NOT NULL,
    "plateNumber" TEXT,
    "mileage" TEXT,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "serviceman" TEXT NOT NULL,
    "receptionist" TEXT,
    "notes" TEXT,
    "documentNumber" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "isLegalEntity" BOOLEAN NOT NULL DEFAULT false,
    "legalCompanyName" TEXT,
    "legalAddress" TEXT,
    "legalActualAddress" TEXT,
    "legalPostalAddress" TEXT,
    "legalBankDetails" TEXT,
    "legalBic" TEXT,
    "legalUnp" TEXT,
    "legalOkpo" TEXT,
    "legalPhone" TEXT,
    "legalEmail" TEXT,
    "legalRepresentativePosition" TEXT,
    "legalRepresentativePositionGenitive" TEXT,
    "legalRepresentative" TEXT,
    "legalRepresentativeGenitive" TEXT,
    "legalBasis" TEXT,
    "legalVin" TEXT,
    "legalEndDate" TEXT,
    "executorSignatoryName" TEXT,
    "executorSignatoryNameGenitive" TEXT,
    "executorSignatoryPosition" TEXT,
    "executorSignatoryPositionGenitive" TEXT,
    "executorSignatoryBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordItem" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "netProfit" DOUBLE PRECISION,
    "servicemanName" TEXT,
    "servicemanSplit" JSONB,
    "equipmentId" TEXT,
    "prepaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prepaidByCard" BOOLEAN NOT NULL DEFAULT false,
    "prepaidCurrency" TEXT,
    "prepaidCurrencyAmount" DOUBLE PRECISION,
    "prepaidRate" DOUBLE PRECISION,

    CONSTRAINT "RecordItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "standardPrice" DOUBLE PRECISION NOT NULL,
    "estimatedTime" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasEquipment" BOOLEAN NOT NULL DEFAULT false,
    "isProduct" BOOLEAN NOT NULL DEFAULT false,
    "customPercent" DOUBLE PRECISION,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "customPercent" DOUBLE PRECISION,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "finalPrice" DOUBLE PRECISION NOT NULL,
    "priceIncreaseReason" TEXT,
    "defects" TEXT,
    "recommendations" TEXT,
    "warranty" TEXT,
    "isPaidByBankTransfer" BOOLEAN NOT NULL DEFAULT false,
    "splitCashAmount" DOUBLE PRECISION,
    "splitCardAmount" DOUBLE PRECISION,
    "currencyPayments" JSONB,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salaryDate" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealEquipment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,

    CONSTRAINT "DealEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warranty" TEXT,
    "wholesalePrice" DOUBLE PRECISION,
    "retailPrice" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Serviceman" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "role" TEXT,
    "email" TEXT,
    "password" TEXT,
    "photoUrl" TEXT,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "isReceptionist" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPerformer" BOOLEAN,
    "profitPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plainPassword" TEXT,
    "birthday" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Serviceman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRate" (
    "id" TEXT NOT NULL,
    "servicemanId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "directorName" TEXT,
    "directorNameGenitive" TEXT,
    "directorPosition" TEXT,
    "directorPositionGenitive" TEXT,
    "directorBasis" TEXT,
    "authorizedPersons" JSONB,
    "legalAddress" TEXT,
    "actualAddress" TEXT,
    "postalAddress" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxId" TEXT,
    "bic" TEXT,
    "okpo" TEXT,
    "bankDetails" TEXT,
    "logoUrl" TEXT,
    "documentPrefix" TEXT NOT NULL DEFAULT 'ПА',
    "nextDocumentNumber" INTEGER NOT NULL DEFAULT 1,
    "actMemo" TEXT,
    "actMemoBlocks" JSONB,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL DEFAULT '',
    "alphanameId" TEXT NOT NULL DEFAULT '',
    "alphaname" TEXT NOT NULL DEFAULT '',
    "onCreateTemplate" TEXT NOT NULL DEFAULT 'Здравствуйте, {{clientName}}! Вы записаны на {{date}} в {{time}}. {{carBrand}} {{carModel}}{{plateNumber}}. Ждём вас! {{companyName}}',
    "reminderTemplate" TEXT NOT NULL DEFAULT 'Напоминаем о записи завтра {{date}} в {{time}}. {{carBrand}} {{carModel}}{{plateNumber}}. До встречи! {{companyName}}',
    "carReadyTemplate" TEXT NOT NULL DEFAULT 'Здравствуйте, {{clientName}}! Ваш {{carBrand}} {{carModel}}{{plateNumber}} готов к выдаче. Ждём вас! {{companyName}}',
    "reviewRequestTemplate" TEXT NOT NULL DEFAULT 'Здравствуйте, {{clientName}}! Будем благодарны за ваш отзыв о нашей работе. {{companyName}}',

    CONSTRAINT "SmsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" "SmsType" NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'work_order',
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "type" "CashTransactionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "carInfo" TEXT,
    "description" TEXT,
    "person" TEXT,
    "recordId" TEXT,
    "isPrepayment" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT,
    "currencyAmount" DOUBLE PRECISION,
    "currencyRate" DOUBLE PRECISION,
    "linkedIncomeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseCategoryId" TEXT,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderSalary" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "person" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT,

    CONSTRAINT "FounderSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryPayment" (
    "id" TEXT NOT NULL,
    "servicemanName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "type" "SalaryPaymentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "cardAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT,

    CONSTRAINT "EmployeeSalaryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdjustment" (
    "id" TEXT NOT NULL,
    "servicemanName" TEXT NOT NULL,
    "type" "SalaryAdjustmentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalTransaction" (
    "id" TEXT NOT NULL,
    "type" "CapitalTransactionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountByn" DOUBLE PRECISION,
    "amountUsd" DOUBLE PRECISION,
    "amountEur" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "description" TEXT,
    "person" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT,

    CONSTRAINT "CapitalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BYN',
    "initialAmount" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "expenseCategoryId" TEXT,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidCurrency" TEXT NOT NULL DEFAULT 'BYN',
    "paidAmount" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT,
    "capitalTransactionId" TEXT,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRevenue" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRecordCount" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRecordCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "servicemanId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "time" TEXT,
    "repeat" TEXT,
    "priority" "NotePriority" NOT NULL DEFAULT 'MEDIUM',
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarMark" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "logo" TEXT,
    "source" "CatalogSource" NOT NULL DEFAULT 'SNAPSHOT',

    CONSTRAINT "CarMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarModel" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "source" "CatalogSource" NOT NULL DEFAULT 'SNAPSHOT',

    CONSTRAINT "CarModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarGeneration" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "photo" TEXT,
    "source" "CatalogSource" NOT NULL DEFAULT 'SNAPSHOT',

    CONSTRAINT "CarGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiEntry" (
    "id" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "markName" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "generationName" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "legacyId" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiMedia" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "type" "WikiMediaType" NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "width" INTEGER,
    "height" INTEGER,
    "placeholder" TEXT,
    "thumbFilename" TEXT,
    "displayFilename" TEXT,
    "mediumFilename" TEXT,
    "variantsVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WikiMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "prevContent" TEXT NOT NULL,
    "newContent" TEXT NOT NULL,
    "addedMedia" JSONB,
    "removedMedia" JSONB,
    "status" "WikiRevisionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "bonusAmount" DOUBLE PRECISION,
    "bonusBaseAmount" DOUBLE PRECISION,
    "salaryAdjustmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiSettings" (
    "id" TEXT NOT NULL,
    "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "WikiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Car_clientId_brandId_modelId_year_key" ON "Car"("clientId", "brandId", "modelId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Record_documentNumber_key" ON "Record"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_recordId_key" ON "Deal"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_name_key" ON "Equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Serviceman_name_key" ON "Serviceman"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRate_servicemanId_year_month_key" ON "SalaryRate"("servicemanId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_linkedIncomeId_key" ON "CashTransaction"("linkedIncomeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FounderSalary_cashTransactionId_key" ON "FounderSalary"("cashTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSalaryPayment_cashTransactionId_key" ON "EmployeeSalaryPayment"("cashTransactionId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryPayment_servicemanName_year_month_idx" ON "EmployeeSalaryPayment"("servicemanName", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalTransaction_cashTransactionId_key" ON "CapitalTransaction"("cashTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_cashTransactionId_key" ON "DebtPayment"("cashTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_capitalTransactionId_key" ON "DebtPayment"("capitalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRevenue_year_month_key" ON "MonthlyRevenue"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRecordCount_year_month_key" ON "MonthlyRecordCount"("year", "month");

-- CreateIndex
CREATE INDEX "CarMark_name_idx" ON "CarMark"("name");

-- CreateIndex
CREATE INDEX "CarMark_source_idx" ON "CarMark"("source");

-- CreateIndex
CREATE INDEX "CarModel_name_idx" ON "CarModel"("name");

-- CreateIndex
CREATE INDEX "CarModel_source_idx" ON "CarModel"("source");

-- CreateIndex
CREATE UNIQUE INDEX "CarModel_markId_externalId_key" ON "CarModel"("markId", "externalId");

-- CreateIndex
CREATE INDEX "CarGeneration_source_idx" ON "CarGeneration"("source");

-- CreateIndex
CREATE UNIQUE INDEX "CarGeneration_modelId_externalId_key" ON "CarGeneration"("modelId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiEntry_legacyId_key" ON "WikiEntry"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiEntry_markId_modelId_generationId_key" ON "WikiEntry"("markId", "modelId", "generationId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiMedia_filename_key" ON "WikiMedia"("filename");

-- CreateIndex
CREATE INDEX "WikiMedia_entryId_idx" ON "WikiMedia"("entryId");

-- CreateIndex
CREATE INDEX "WikiRevision_status_idx" ON "WikiRevision"("status");

-- CreateIndex
CREATE INDEX "WikiRevision_entryId_idx" ON "WikiRevision"("entryId");

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordItem" ADD CONSTRAINT "RecordItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordItem" ADD CONSTRAINT "RecordItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordItem" ADD CONSTRAINT "RecordItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEquipment" ADD CONSTRAINT "DealEquipment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEquipment" ADD CONSTRAINT "DealEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRate" ADD CONSTRAINT "SalaryRate_servicemanId_fkey" FOREIGN KEY ("servicemanId") REFERENCES "Serviceman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_linkedIncomeId_fkey" FOREIGN KEY ("linkedIncomeId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderSalary" ADD CONSTRAINT "FounderSalary_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryPayment" ADD CONSTRAINT "EmployeeSalaryPayment_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalTransaction" ADD CONSTRAINT "CapitalTransaction_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_capitalTransactionId_fkey" FOREIGN KEY ("capitalTransactionId") REFERENCES "CapitalTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_servicemanId_fkey" FOREIGN KEY ("servicemanId") REFERENCES "Serviceman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarModel" ADD CONSTRAINT "CarModel_markId_fkey" FOREIGN KEY ("markId") REFERENCES "CarMark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarGeneration" ADD CONSTRAINT "CarGeneration_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "CarModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiMedia" ADD CONSTRAINT "WikiMedia_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WikiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiRevision" ADD CONSTRAINT "WikiRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WikiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
