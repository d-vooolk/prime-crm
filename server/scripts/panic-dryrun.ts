/**
 * Проверка облегчённого режима (тревожная кнопка) на копии базы — без реальных данных.
 *
 *   npm run panic:dryrun
 *
 * Создаёт во ВРЕМЕННОЙ транзакции по одной записи на каждый сценарий (будущая, закрытая по РС,
 * закрытая наличными, юрлицо, отменённая, импортированная …), запускает ту же самую очистку
 * wipeForLiteMode, что и боевая кнопка, и сверяет, что осталось ровно то, что должно. В конце
 * транзакция ОТКАТЫВАЕТСЯ — скрипт ничего не удаляет и не пишет, его можно гонять на dev-базе.
 *
 * Данные синтетические и помечены (телефоны DRY-…, имена DRYRUN …): настоящую базу копировать
 * на локальный компьютер не нужно и не стоит — ровно её и защищает протокол.
 */
import path from 'path';
import dotenv from 'dotenv';

// DATABASE_URL грузим до импорта клиента Prisma (он читает env при загрузке модуля), как в src/index.ts
dotenv.config({ path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`) });

import { Prisma } from '@prisma/client'; // eslint-disable-line import/first
import { prisma, DbClient } from '../src/prisma/client'; // eslint-disable-line import/first
import { wipeForLiteMode } from '../src/services/panic.service'; // eslint-disable-line import/first
const NOW = new Date(2026, 10, 5, 12); // «сегодня» для проверки
const future = new Date(2026, 10, 10, 9);
const past = new Date(2026, 10, 1, 9);

class Rollback extends Error {}

interface Case { label: string; recordId?: string; clientId?: string; keep: boolean }

async function seed(tx: DbClient): Promise<Case[]> {
  const cases: Case[] = [];

  // Справочники, которые должны полностью исчезнуть
  await tx.expenseCategory.create({ data: { name: 'DRYRUN расходники' } });
  await tx.clientSource.create({ data: { name: 'DRYRUN Instagram' } });
  await tx.wikiSection.create({ data: { name: 'DRYRUN раздел' } });
  await tx.siteLead.create({ data: { name: 'DRYRUN заявка', phone: 'DRY-lead' } });
  await tx.capitalTransaction.create({ data: { type: 'DEPOSIT', date: NOW, amountByn: 100 } });
  await tx.vdfOrder.create({
    data: { shopOrderId: -777, employeeName: 'DRYRUN', items: [], shopTotal: 10, amount: 10, completedAt: NOW },
  });

  // Сотрудники: руководители остаются, остальные и уволенные — нет
  const manager = await tx.serviceman.create({ data: { name: 'DRYRUN Менеджер', role: 'Менеджер' } });
  await tx.serviceman.create({ data: { name: 'DRYRUN Сотрудник', role: 'Сотрудник' } });
  await tx.serviceman.create({ data: { name: 'DRYRUN Уволенный', role: 'Директор', isDismissed: true } });
  await tx.note.create({ data: { servicemanId: manager.id, text: 'DRYRUN заметка' } });
  await tx.salaryRate.create({ data: { servicemanId: manager.id, year: 2026, month: 11, amount: 1000 } });

  let carSeq = 0;
  const makeRecord = async (
    label: string,
    keep: boolean,
    opts: {
      scheduledAt?: Date;
      status?: 'ACTIVE' | 'CLOSED' | 'CANCELLED';
      importKey?: string;
      isLegalEntity?: boolean;
      deal?: { isPaidByBankTransfer?: boolean; splitCashAmount?: number; currencyPayments?: Prisma.InputJsonValue };
      incomes?: Array<{ type: 'INCOME' | 'INCOME_RS'; prepayment?: boolean }>;
    },
  ) => {
    const client = await tx.client.create({ data: { name: `DRYRUN ${label}`, phone: `DRY-${carSeq}` } });
    const car = await tx.car.create({
      data: { clientId: client.id, brand: 'BMW', brandId: `b${carSeq}`, model: 'X5', modelId: `m${carSeq}`, year: '2020' },
    });
    carSeq += 1;
    const record = await tx.record.create({
      data: {
        clientId: client.id,
        carId: car.id,
        scheduledAt: opts.scheduledAt ?? past,
        status: opts.status ?? 'ACTIVE',
        importKey: opts.importKey,
        isLegalEntity: opts.isLegalEntity ?? false,
        serviceman: 'DRYRUN Менеджер',
      },
    });
    if (opts.deal) {
      await tx.deal.create({
        data: {
          recordId: record.id,
          finalPrice: 100,
          isPaidByBankTransfer: opts.deal.isPaidByBankTransfer ?? false,
          splitCashAmount: opts.deal.splitCashAmount ?? null,
          currencyPayments: opts.deal.currencyPayments ?? Prisma.DbNull,
        },
      });
    }
    for (const inc of opts.incomes ?? []) {
      await tx.cashTransaction.create({
        data: { type: inc.type, date: NOW, amount: 50, recordId: record.id, isPrepayment: inc.prepayment ?? false },
      });
    }
    cases.push({ label, recordId: record.id, clientId: client.id, keep });
  };

  // ── Остаются ─────────────────────────────────────────────
  await makeRecord('активная будущая', true, { status: 'ACTIVE', scheduledAt: future, incomes: [{ type: 'INCOME', prepayment: true }] });
  await makeRecord('активная сегодня', true, { status: 'ACTIVE', scheduledAt: NOW });
  await makeRecord('закрытая по РС', true, { status: 'CLOSED', deal: { isPaidByBankTransfer: true }, incomes: [{ type: 'INCOME_RS' }] });
  await makeRecord('закрытая картой', true, { status: 'CLOSED', deal: {}, incomes: [{ type: 'INCOME_RS' }] });
  await makeRecord('закрытая юрлицо', true, { status: 'CLOSED', isLegalEntity: true, deal: {}, incomes: [{ type: 'INCOME_RS' }] });

  // ── Удаляются ────────────────────────────────────────────
  await makeRecord('активная прошедшая', false, { status: 'ACTIVE', scheduledAt: past });
  await makeRecord('закрытая наличными', false, { status: 'CLOSED', deal: {}, incomes: [{ type: 'INCOME' }] });
  await makeRecord('закрытая нал+РС', false, { status: 'CLOSED', deal: { isPaidByBankTransfer: true }, incomes: [{ type: 'INCOME' }, { type: 'INCOME_RS' }] });
  await makeRecord('закрытая с разбивкой нал', false, { status: 'CLOSED', deal: { splitCashAmount: 40 }, incomes: [{ type: 'INCOME_RS' }] });
  await makeRecord('закрытая валютой', false, {
    status: 'CLOSED', deal: { isPaidByBankTransfer: true, currencyPayments: [{ currency: 'USD', amount: 10, rate: 3 }] },
  });
  await makeRecord('отменённая', false, { status: 'CANCELLED', scheduledAt: future, deal: {}, incomes: [{ type: 'INCOME_RS' }] });
  await makeRecord('из старой программы', false, { status: 'CLOSED', importKey: 'DRYRUN.json', deal: { isPaidByBankTransfer: true } });

  return cases;
}

async function main() {
  let failures = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const cases = await seed(tx);
      const files = await wipeForLiteMode(tx, NOW);

      console.log('\n  РАСПИСАНИЕ');
      for (const c of cases) {
        const rec = await tx.record.findUnique({ where: { id: c.recordId }, include: { deal: true } });
        const survived = !!rec;
        const ok = survived === c.keep;
        if (!ok) failures += 1;
        let note = '';
        if (survived && rec?.deal) note = rec.deal.isPaidByBankTransfer ? '  → сделка по РС' : '  → сделка НЕ по РС (!)';
        if (survived && rec?.serviceman) note += `  мастер: ${rec.serviceman}`;
        console.log(`  ${ok ? '✓' : '✗'}  ${c.keep ? 'оставить' : 'удалить '}  ${c.label}${note}`);
      }

      // Приходы: у оставшихся записей все должны стать INCOME_RS, наличных и валютных — не остаться
      const incomeByType = await tx.cashTransaction.groupBy({ by: ['type'], _count: true });
      const cashLeft = incomeByType.find(r => r.type === 'INCOME')?._count ?? 0;
      const cashCurLeft = await tx.cashTransaction.count({ where: { currency: { not: null } } });
      console.log('\n  КАССА');
      console.log(`  ${cashLeft === 0 ? '✓' : '✗'}  наличных приходов (INCOME) осталось: ${cashLeft} (ожидается 0)`);
      console.log(`  ${cashCurLeft === 0 ? '✓' : '✗'}  валютных приходов осталось: ${cashCurLeft} (ожидается 0)`);
      failures += (cashLeft === 0 ? 0 : 1) + (cashCurLeft === 0 ? 0 : 1);

      const checks: Array<[string, number]> = [
        ['категории расходов', await tx.expenseCategory.count({ where: { name: { startsWith: 'DRYRUN' } } })],
        ['источники клиентов', await tx.clientSource.count({ where: { name: { startsWith: 'DRYRUN' } } })],
        ['разделы вики', await tx.wikiSection.count({ where: { name: { startsWith: 'DRYRUN' } } })],
        ['заявки с сайта', await tx.siteLead.count({ where: { name: { startsWith: 'DRYRUN' } } })],
        ['капитал', await tx.capitalTransaction.count()],
        ['заказы VDF', await tx.vdfOrder.count({ where: { shopOrderId: -777 } })],
        ['заметки', await tx.note.count({ where: { text: { startsWith: 'DRYRUN' } } })],
        ['оклады', await tx.salaryRate.count()],
      ];
      console.log('\n  СКРЫТЫЕ РАЗДЕЛЫ (должны быть пустыми)');
      for (const [label, n] of checks) {
        if (n !== 0) failures += 1;
        console.log(`  ${n === 0 ? '✓' : '✗'}  ${label}: ${n}`);
      }

      const staff = await tx.serviceman.findMany({ where: { name: { startsWith: 'DRYRUN' } }, select: { name: true, role: true } });
      console.log('\n  СОТРУДНИКИ (остаются только Создатель/Директор/Менеджер, не уволенные)');
      const staffOk = staff.length === 1 && staff[0].role === 'Менеджер';
      if (!staffOk) failures += 1;
      console.log(`  ${staffOk ? '✓' : '✗'}  осталось: ${staff.map(s => `${s.name} (${s.role})`).join(', ') || '—'}`);

      const liteState = await tx.securityState.findUnique({ where: { id: 'singleton' } });
      console.log(`\n  ${liteState?.liteMode ? '✓' : '✗'}  облегчённый режим включён (liteMode=${liteState?.liteMode})`);
      if (!liteState?.liteMode) failures += 1;

      console.log(`\n  файлов к удалению: фото записей ${files.recordMedia.length}, фото заявок ${files.siteLeadPhotos.length}`);

      throw new Rollback(); // ничего не сохраняем
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }

  console.log(`\n${failures === 0 ? '✅ ВСЁ ВЕРНО' : `❌ ПРОВАЛЕНО ПРОВЕРОК: ${failures}`} (база не изменена — транзакция откатана)\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
