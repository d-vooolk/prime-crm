-- Пополнение капитала из магазина vdf.by: валюта, полученная там по долгу
ALTER TABLE "CapitalTransaction" ADD COLUMN "vdfRef" TEXT;

CREATE UNIQUE INDEX "CapitalTransaction_vdfRef_key" ON "CapitalTransaction"("vdfRef");
