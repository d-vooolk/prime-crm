import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { auditExtension } from './audit';

/**
 * Деньги хранятся в DECIMAL(14,2) — без накопления копеечной погрешности в базе и в SQL-суммах.
 * Наружу Prisma отдала бы их объектами Decimal (в JSON — строками), поэтому здесь они
 * превращаются обратно в number: код сервиса и клиент работают с числами как раньше.
 * Расширение применяется и к вложенным include/select.
 */
const num = <K extends string>(field: K) => ({
  needs: { [field]: true } as { [P in K]: true },
  compute: (row: { [P in K]: Prisma.Decimal }) => row[field].toNumber(),
});
const numOrNull = <K extends string>(field: K) => ({
  needs: { [field]: true } as { [P in K]: true },
  compute: (row: { [P in K]: Prisma.Decimal | null }) => (row[field] == null ? null : row[field]!.toNumber()),
});

const decimalsAsNumbers = Prisma.defineExtension({
  name: 'decimalsAsNumbers',
  result: {
    recordItem: {
      price: num('price'),
      netProfit: numOrNull('netProfit'),
      prepaidAmount: num('prepaidAmount'),
      prepaidCurrencyAmount: numOrNull('prepaidCurrencyAmount'),
    },
    service: { standardPrice: num('standardPrice') },
    deal: {
      finalPrice: num('finalPrice'),
      splitCashAmount: numOrNull('splitCashAmount'),
      splitCardAmount: numOrNull('splitCardAmount'),
    },
    equipment: { wholesalePrice: numOrNull('wholesalePrice'), retailPrice: numOrNull('retailPrice') },
    salaryRate: { amount: num('amount') },
    cashTransaction: { amount: num('amount'), currencyAmount: numOrNull('currencyAmount') },
    founderSalary: { amount: num('amount') },
    employeeSalaryPayment: { amount: num('amount'), cardAmount: num('cardAmount') },
    salaryAdjustment: { amount: num('amount') },
    capitalTransaction: {
      amountByn: numOrNull('amountByn'),
      amountUsd: numOrNull('amountUsd'),
      amountEur: numOrNull('amountEur'),
    },
    debt: { initialAmount: num('initialAmount'), remainingAmount: num('remainingAmount') },
    debtPayment: { amount: num('amount'), paidAmount: numOrNull('paidAmount') },
    monthlyRevenue: { amount: num('amount') },
    wikiRevision: { bonusAmount: numOrNull('bonusAmount'), bonusBaseAmount: numOrNull('bonusBaseAmount') },
    wikiSettings: { bonusAmount: num('bonusAmount') },
    stockItem: {
      quantity: num('quantity'),
      minQuantity: numOrNull('minQuantity'),
      purchasePrice: numOrNull('purchasePrice'),
    },
    stockMovement: { delta: num('delta'), quantityAfter: num('quantityAfter') },
    vdfOrder: { shopTotal: num('shopTotal'), amount: num('amount') },
  },
});

function createBaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Хеш пароля никогда не уходит в ответы API. Где он нужен (вход) — запрашивается явно
    omit: { serviceman: { password: true } },
  });
}

type BaseClient = ReturnType<typeof createBaseClient>;

function createPrismaClient(base: BaseClient) {
  return base.$extends(decimalsAsNumbers).$extends(auditExtension(base));
}

type ExtendedClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prismaBase?: BaseClient; prisma?: ExtendedClient };

/** Клиент без расширений — для служебных записей (журнал изменений), чтобы не зациклиться. */
export const prismaBase = globalForPrisma.prismaBase ?? createBaseClient();
export const prisma = globalForPrisma.prisma ?? createPrismaClient(prismaBase);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = prismaBase;
  globalForPrisma.prisma = prisma;
}

/** Клиент внутри prisma.$transaction(async tx => …) */
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
/** Любой клиент: обычный или транзакционный */
export type DbClient = typeof prisma | TxClient;
