/**
 * Обильный демонстрационный сид для локальной проверки (в т.ч. тревожной кнопки).
 *
 *   npm run db:seed:demo
 *
 * Полностью пересоздаёт прикладные данные: сотрудники всех ролей, услуги, оборудование, вики,
 * клиенты и записи на все сценарии оплаты/статуса, касса (нал/РС/валюта), капитал, зарплаты,
 * долги, VDF, заметки, заявки, склад. Справочник авто (CarMark/Model/Generation) и историю
 * миграций не трогает. После прогона тревожной кнопки сид можно запустить снова — он всё обновит.
 *
 * ВНИМАНИЕ: стирает все прикладные данные выбранной базы. Только для dev/стенда.
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`) });

import { Prisma } from '@prisma/client'; // eslint-disable-line import/first
import { prisma } from '../src/prisma/client'; // eslint-disable-line import/first

const PASSWORD = 'test1234'; // пароль всех тестовых сотрудников

const day = 24 * 60 * 60 * 1000;
const now = new Date();
const inDays = (n: number) => new Date(now.getTime() + n * day);

async function wipe() {
  // CASCADE подхватит зависимые таблицы (Record, Deal, зарплаты, вики-контент, склад …)
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      "Client","Serviceman","Category","Equipment","RepairType","WikiSection","WikiEntry",
      "ExpenseCategory","ClientSource","StockCategory","CashTransaction","CapitalTransaction",
      "Debt","VdfOrder","Note","SiteLead","MonthlyRevenue","MonthlyRecordCount",
      "DocumentTemplate","SmsSettings","CompanySettings","AuditLog"
    RESTART IDENTITY CASCADE
  `);
  // Вернуть обычный режим (вдруг база осталась после теста кнопки)
  await prisma.securityState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', liteMode: false },
    update: { liteMode: false, sessionsRevokedAt: null },
  });
}

async function main() {
  await wipe();

  // ─── Компания, SMS, шаблоны ──────────────────────────────
  await prisma.companySettings.create({
    data: {
      name: 'Prime Auto (DEMO)', directorName: 'Иванов И. И.', phone: '+375 29 000-00-00',
      email: 'info@prime-auto.by', legalAddress: 'г. Минск, ул. Демо, 1', documentPrefix: 'ПА',
    },
  });
  await prisma.smsSettings.create({ data: { enabled: false } });
  await prisma.documentTemplate.createMany({
    data: [
      { name: 'Заявка на работы', type: 'work_order', content: '<h1>Заявка</h1>', isDefault: true },
      { name: 'Акт выполненных работ', type: 'act', content: '<h1>Акт</h1>', isDefault: true },
    ],
  });

  // ─── Сотрудники всех ролей (пароль у всех test1234) ──────
  const mk = (name: string, role: string, extra: Record<string, unknown> = {}) =>
    prisma.serviceman.create({
      data: {
        name, role, email: extra.email as string | undefined, password: PASSWORD,
        isPerformer: true, inSalaryFund: true, showInDashboard: true, profitPercent: 40, ...extra,
      },
    });
  const creator = await mk('Создатель Демо', 'Создатель', { email: 'creator@test', inSalaryFund: false });
  const director = await mk('Директор Демо', 'Директор', { email: 'director@test', inSalaryFund: false });
  const manager = await mk('Менеджер Демо', 'Менеджер', { email: 'manager@test', isReceptionist: true, isDefault: true });
  const master1 = await mk('Мастер Пётр', 'Сотрудник', { email: 'petr@test' });
  const master2 = await mk('Мастер Олег', 'Сотрудник', { email: 'oleg@test' });
  await mk('Уволенный Семён', 'Сотрудник', { email: 'fired@test', isDismissed: true, isPerformer: false });

  // ─── Категории и услуги ──────────────────────────────────
  const wikiBiLed = await prisma.wikiSection.create({ data: { name: 'Bi-Led модули', sortOrder: 1 } });
  const wikiDho = await prisma.wikiSection.create({ data: { name: 'Ремонт ДХО', sortOrder: 2 } });

  const catLights = await prisma.category.create({ data: { name: 'Ремонт фар', color: '#A2DB00' } });
  const catTint = await prisma.category.create({ data: { name: 'Тонировка' } });
  const catWrap = await prisma.category.create({ data: { name: 'Оклейка' } });

  const equip = await prisma.equipment.create({
    data: { name: 'Bi-Led модуль Aozoom A5+', warranty: '12 месяцев', wholesalePrice: 200, retailPrice: 350 },
  });

  const svcLens = await prisma.service.create({
    data: { name: 'Замена линз (2 фары)', categoryId: catLights.id, standardPrice: 900, estimatedTime: 300, hasEquipment: true, wikiSectionId: wikiBiLed.id },
  });
  const svcDho = await prisma.service.create({
    data: { name: 'Ремонт ДХО', categoryId: catLights.id, standardPrice: 300, estimatedTime: 120, wikiSectionId: wikiDho.id },
  });
  const svcTint = await prisma.service.create({
    data: { name: 'Тонировка 3 стекла', categoryId: catTint.id, standardPrice: 250, estimatedTime: 90 },
  });
  const svcWrap = await prisma.service.create({
    data: { name: 'Оклейка капота', categoryId: catWrap.id, standardPrice: 600, estimatedTime: 240 },
  });

  // ─── Вики: карточка + разделы + товар + правка (ждёт проверки) ──
  const entry = await prisma.wikiEntry.create({
    data: {
      markId: 'bmw', modelId: 'x5', generationId: 'g05', markName: 'BMW', modelName: 'X5', generationName: 'G05',
      content: 'Общая информация по кузову G05.', updatedByName: master1.name,
    },
  });
  await prisma.wikiEntrySection.createMany({
    data: [
      { entryId: entry.id, sectionId: wikiBiLed.id, content: 'Подходит модуль Aozoom A5+, рамка №12.' },
      { entryId: entry.id, sectionId: wikiDho.id, content: 'ДХО лечится заменой платы.' },
    ],
  });
  await prisma.wikiProduct.create({
    data: { entryId: entry.id, sectionId: wikiBiLed.id, productId: '12345', title: 'Переходная рамка G05', url: 'https://vdf.by/p/12345' },
  });
  await prisma.wikiRevision.create({
    data: {
      entryId: entry.id, authorId: master1.id, authorName: master1.name, authorRole: 'Сотрудник',
      sectionId: wikiDho.id, prevContent: '', newContent: 'Добавил артикул платы ДХО.', status: 'PENDING',
    },
  });

  // ─── Справочники: источники клиентов, категории расходов ──
  const [srcInsta, srcGoogle, srcFriends] = await Promise.all([
    prisma.clientSource.create({ data: { name: 'Instagram', sortOrder: 1 } }),
    prisma.clientSource.create({ data: { name: 'Google', sortOrder: 2 } }),
    prisma.clientSource.create({ data: { name: 'По рекомендации', sortOrder: 3 } }),
  ]);
  const [ecParts, ecFood, ecRent] = await Promise.all([
    prisma.expenseCategory.create({ data: { name: 'Расходники', sortOrder: 1 } }),
    prisma.expenseCategory.create({ data: { name: 'Еда в офис', sortOrder: 2 } }),
    prisma.expenseCategory.create({ data: { name: 'Аренда', sortOrder: 3 } }),
  ]);

  // ─── Склад (с закупочными ценами — после кнопки обнулятся) ──
  const stockRoot = await prisma.stockCategory.create({ data: { name: 'Плёнка', sortOrder: 1 } });
  const stockItem = await prisma.stockItem.create({
    data: { categoryId: stockRoot.id, name: 'Плёнка SunTek PPF', unit: 'м', quantity: 30, minQuantity: 10, purchasePrice: 45 },
  });
  await prisma.stockMovement.create({ data: { itemId: stockItem.id, type: 'IN', delta: 30, quantityAfter: 30, comment: 'Поступление', userName: manager.name } });

  // ─── Клиенты с машинами и записями на все сценарии ───────
  let seq = 0;
  const performers = [master1.name, master2.name];

  type Income = { type: 'INCOME' | 'INCOME_RS'; amount: number; prepayment?: boolean; currency?: string; currencyAmount?: number; currencyRate?: number };
  interface Scenario {
    label: string;
    scheduledAt: Date;
    status?: 'ACTIVE' | 'CLOSED' | 'CANCELLED';
    importKey?: string;
    isLegalEntity?: boolean;
    deal?: { finalPrice: number; isPaidByBankTransfer?: boolean; splitCashAmount?: number; splitCardAmount?: number; currencyPayments?: unknown; warranty?: string };
    incomes?: Income[];
    services?: { svcId: string; price: number; equipmentId?: string }[];
  }

  const make = async (s: Scenario) => {
    seq += 1;
    const client = await prisma.client.create({
      data: { name: `Клиент ${seq} (${s.label})`, phone: `+37529${String(1000000 + seq).slice(0, 7)}`, notes: seq % 3 === 0 ? 'Постоянный клиент' : null },
    });
    const car = await prisma.car.create({
      data: {
        clientId: client.id, brand: 'BMW', brandId: 'bmw', model: 'X5', modelId: 'x5',
        generationId: 'g05', generationName: 'G05', year: '2021', plateNumber: `${1000 + seq}AB-7`, mileage: `${80000 + seq * 1000}`,
      },
    });
    const servicemanName = performers[seq % performers.length];
    const record = await prisma.record.create({
      data: {
        clientId: client.id, carId: car.id, scheduledAt: s.scheduledAt, status: s.status ?? 'ACTIVE',
        importKey: s.importKey, isLegalEntity: s.isLegalEntity ?? false,
        serviceman: servicemanName, receptionist: manager.name, clientSourceId: [srcInsta, srcGoogle, srcFriends][seq % 3].id,
        notes: 'Демо-запись', defects: s.status === 'CLOSED' ? 'Запотевание фары' : null,
        legalCompanyName: s.isLegalEntity ? 'ООО «Демо-Транс»' : null, legalUnp: s.isLegalEntity ? '191234567' : null,
      },
    });
    for (const svc of s.services ?? [{ svcId: svcTint.id, price: 250 }]) {
      await prisma.recordItem.create({
        data: {
          recordId: record.id, serviceId: svc.svcId, price: svc.price, quantity: 1,
          servicemanName, equipmentId: svc.equipmentId, netProfit: s.status === 'CLOSED' ? svc.price : null,
        },
      });
    }
    if (s.deal) {
      await prisma.deal.create({
        data: {
          recordId: record.id, finalPrice: s.deal.finalPrice, isPaidByBankTransfer: s.deal.isPaidByBankTransfer ?? false,
          splitCashAmount: s.deal.splitCashAmount ?? null, splitCardAmount: s.deal.splitCardAmount ?? null,
          currencyPayments: s.deal.currencyPayments ? (s.deal.currencyPayments as Prisma.InputJsonValue) : Prisma.DbNull,
          warranty: s.deal.warranty ?? '6 месяцев',
          recommendations: 'Рекомендуем замену второй лампы',
          equipment: s.services?.some(x => x.equipmentId) ? { create: [{ equipmentId: equip.id }] } : undefined,
        },
      });
    }
    for (const inc of s.incomes ?? []) {
      await prisma.cashTransaction.create({
        data: {
          type: inc.type, date: s.scheduledAt, amount: inc.amount, recordId: record.id, isPrepayment: inc.prepayment ?? false,
          clientName: client.name, clientPhone: client.phone, carInfo: `${car.brand} ${car.model} ${car.year}`,
          description: inc.prepayment ? 'Предоплата' : 'Оплата по сделке',
          currency: inc.currency, currencyAmount: inc.currencyAmount, currencyRate: inc.currencyRate,
        },
      });
    }
    return record;
  };

  // Остаются после кнопки
  await make({ label: 'активная на завтра', scheduledAt: inDays(1), incomes: [{ type: 'INCOME', amount: 100, prepayment: true }] });
  await make({ label: 'активная на 3 дня', scheduledAt: inDays(3) });
  await make({ label: 'активная сегодня', scheduledAt: inDays(0) });
  await make({ label: 'закрыта по РС', scheduledAt: inDays(-2), status: 'CLOSED', deal: { finalPrice: 900, isPaidByBankTransfer: true, warranty: '12 месяцев' }, incomes: [{ type: 'INCOME_RS', amount: 900 }], services: [{ svcId: svcLens.id, price: 900, equipmentId: equip.id }] });
  await make({ label: 'закрыта картой', scheduledAt: inDays(-3), status: 'CLOSED', deal: { finalPrice: 250 }, incomes: [{ type: 'INCOME_RS', amount: 250 }] });
  await make({ label: 'закрыта юрлицо', scheduledAt: inDays(-5), status: 'CLOSED', isLegalEntity: true, deal: { finalPrice: 600 }, incomes: [{ type: 'INCOME_RS', amount: 600 }], services: [{ svcId: svcWrap.id, price: 600 }] });

  // Удаляются после кнопки
  await make({ label: 'активная прошедшая (незавершённая)', scheduledAt: inDays(-1) });
  await make({ label: 'закрыта наличными', scheduledAt: inDays(-2), status: 'CLOSED', deal: { finalPrice: 300 }, incomes: [{ type: 'INCOME', amount: 300 }], services: [{ svcId: svcDho.id, price: 300 }] });
  await make({ label: 'закрыта нал+РС', scheduledAt: inDays(-4), status: 'CLOSED', deal: { finalPrice: 500, splitCashAmount: 200, splitCardAmount: 300 }, incomes: [{ type: 'INCOME', amount: 200 }, { type: 'INCOME_RS', amount: 300 }] });
  await make({ label: 'закрыта валютой', scheduledAt: inDays(-6), status: 'CLOSED', deal: { finalPrice: 900, currencyPayments: [{ currency: 'USD', amount: 300, rate: 3 }] }, incomes: [{ type: 'INCOME', amount: 900, currency: 'USD', currencyAmount: 300, currencyRate: 3 }], services: [{ svcId: svcLens.id, price: 900, equipmentId: equip.id }] });
  await make({ label: 'отменённая', scheduledAt: inDays(2), status: 'CANCELLED' });
  await make({ label: 'из старой программы', scheduledAt: inDays(-30), status: 'CLOSED', importKey: 'legacy-001.json', deal: { finalPrice: 400, isPaidByBankTransfer: true } });

  // ─── Касса: отдельные приходы/расходы без записи ─────────
  await prisma.cashTransaction.createMany({
    data: [
      { type: 'MANUAL_INCOME', date: inDays(-1), amount: 150, description: 'Продажа плёнки' },
      { type: 'EXPENSE', date: inDays(-1), amount: 80, description: 'Расходники', expenseCategoryId: ecParts.id },
      { type: 'EXPENSE', date: inDays(-2), amount: 40, description: 'Обед', expenseCategoryId: ecFood.id },
      { type: 'EXPENSE', date: inDays(-3), amount: 500, description: 'Аренда помещения', expenseCategoryId: ecRent.id },
    ],
  });

  // ─── Капитал ─────────────────────────────────────────────
  await prisma.capitalTransaction.createMany({
    data: [
      { type: 'DEPOSIT', date: inDays(-20), amountByn: 10000, description: 'Стартовый капитал', person: director.name },
      { type: 'WITHDRAWAL', date: inDays(-10), amountByn: 1500, description: 'Вывод учредителю', person: creator.name },
    ],
  });

  // ─── Зарплаты: оклады, премии/штрафы, выплаты, ЗП учредителей ──
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  await prisma.salaryRate.createMany({
    data: [
      { servicemanId: master1.id, year: y, month: m, amount: 800 },
      { servicemanId: master2.id, year: y, month: m, amount: 800 },
    ],
  });
  await prisma.salaryAdjustment.createMany({
    data: [
      { servicemanName: master1.name, type: 'BONUS', amount: 100, reason: 'Переработка', year: y, month: m },
      { servicemanName: master2.name, type: 'FINE', amount: 50, reason: 'Опоздание', year: y, month: m },
    ],
  });
  await prisma.employeeSalaryPayment.create({
    data: { servicemanName: master1.name, year: y, month: m, type: 'ADVANCE', amount: 300, cardAmount: 0, date: inDays(-5) },
  });
  await prisma.founderSalary.createMany({
    data: [
      { year: y, month: m, person: director.name, amount: 2000 },
      { year: y, month: m, person: creator.name, amount: 2500 },
    ],
  });

  // ─── Долги (остаются после кнопки) ───────────────────────
  const debt = await prisma.debt.create({
    data: { description: 'Поставщик плёнки', currency: 'BYN', initialAmount: 1000, remainingAmount: 600, direction: 'WE_OWE', expenseCategoryId: ecParts.id },
  });
  await prisma.debtPayment.create({ data: { debtId: debt.id, amount: 400, paidCurrency: 'BYN', paidAmount: 400 } });
  await prisma.debt.create({
    data: { description: 'Клиент за оклейку', currency: 'BYN', initialAmount: 300, remainingAmount: 300, direction: 'OWED_TO_US' },
  });

  // ─── VDF заказы ──────────────────────────────────────────
  await prisma.vdfOrder.createMany({
    data: [
      { shopOrderId: 5001, status: 'PENDING', employeeName: master1.name, items: [{ title: 'Лампа', qty: 2, price: 30, sum: 60 }], shopTotal: 60, amount: 60, completedAt: inDays(-1) },
      { shopOrderId: 5002, status: 'PENDING', employeeName: master2.name, items: [{ title: 'Рамка', qty: 1, price: 45, sum: 45 }], shopTotal: 45, amount: 45, completedAt: inDays(-2) },
    ],
  });

  // ─── Заметки, заявки, помесячная статистика ──────────────
  await prisma.note.createMany({
    data: [
      { servicemanId: manager.id, text: 'Позвонить поставщику', project: 'CRM' },
      { servicemanId: creator.id, text: 'Обновить прайс', project: 'PRIME' },
      { servicemanId: director.id, text: 'Заказать плёнку', project: 'VDF', date: inDays(2), allDay: false, time: '10:00' },
    ],
  });
  await prisma.siteLead.createMany({
    data: [
      { name: 'Андрей', phone: '+375291112233', message: 'Хочу Bi-Led', source: 'prime-auto.by', status: 'NEW', photos: [] },
      { name: 'Марина', phone: '+375299998877', message: 'Тонировка?', status: 'DONE', photos: [] },
    ],
  });
  await prisma.monthlyRevenue.create({ data: { year: y, month: m, amount: 15000 } });
  await prisma.monthlyRecordCount.create({ data: { year: y, month: m, count: 42 } });

  // Итог
  const counts = {
    клиенты: await prisma.client.count(),
    записи: await prisma.record.count(),
    сделки: await prisma.deal.count(),
    касса: await prisma.cashTransaction.count(),
    сотрудники: await prisma.serviceman.count(),
    долги: await prisma.debt.count(),
  };
  console.log('\n✅ Демо-данные засеяны:', counts);
  console.log(`Вход: мастер admin@prime-auto.by, либо creator@test / director@test / manager@test / petr@test (пароль ${PASSWORD})\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
