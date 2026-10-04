import { Prisma, CashTransactionType, ClientSource } from '@prisma/client';
import { prisma, DbClient } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { startOfDay, endOfDay } from '../utils/date';
import { logger } from '../utils/logger';
import { currentContext } from '../utils/requestContext';
import { smsService } from './sms.service';
import { cashService } from './accounting/cash.service';
import { recordMediaService } from './recordMedia.service';
import { pushService, pushInBackground } from './push.service';
import { toByn, roundMoney } from './currency.service';
import {
  CurrencyPart, currencyAccountingService, currencyPartsByn, parseCurrencyParts,
} from './currencyAccounting.service';

const RECORD_INCLUDE = {
  client: true,
  car: true,
  items: { include: { service: { include: { category: true } }, equipment: true } },
  deal: { include: { equipment: { include: { equipment: true } } } },
  smsLogs: { orderBy: { sentAt: 'asc' as const } },
  _count: { select: { media: true } },
} as const;

/** SMS отправляется в фоне: ответ не ждёт sms.by, а ошибка не роняет процесс */
function sendSmsInBackground(recordId: string, type: 'ON_CREATE' | 'REVIEW_REQUEST') {
  smsService.sendForRecord(recordId, type).catch(err => logger.error('Не удалось отправить SMS', { recordId, type, err }));
}

/** «05.10 в 10:30» — для уведомлений; сервер работает во времени Минска (TZ в compose) */
const formatWhen = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} в ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const carInfoOf = (car: { brand: string; model: string; year: string; plateNumber?: string | null }) =>
  `${car.brand} ${car.model} ${car.year}${car.plateNumber ? ' ' + car.plateNumber : ''}`;

export interface CreateRecordDto {
  clientId: string;
  car: {
    brand: string;
    brandId: string;
    model: string;
    modelId: string;
    generation?: string;
    generationId?: string;
    generationName?: string;
    year: string;
    plateNumber?: string;
    mileage?: string;
  };
  scheduledAt: string;
  serviceman?: string | null;
  receptionist?: string | null;
  notes?: string | null;
  clientSource?: ClientSource | null;
  isLegalEntity?: boolean;
  legalCompanyName?: string | null;
  legalAddress?: string | null;
  legalActualAddress?: string | null;
  legalPostalAddress?: string | null;
  legalBankDetails?: string | null;
  legalBic?: string | null;
  legalUnp?: string | null;
  legalOkpo?: string | null;
  legalPhone?: string | null;
  legalEmail?: string | null;
  legalRepresentativePosition?: string | null;
  legalRepresentativePositionGenitive?: string | null;
  legalRepresentative?: string | null;
  legalRepresentativeGenitive?: string | null;
  legalBasis?: string | null;
  legalVin?: string | null;
  legalEndDate?: string | null;
  executorSignatoryName?: string | null;
  executorSignatoryNameGenitive?: string | null;
  executorSignatoryPosition?: string | null;
  executorSignatoryPositionGenitive?: string | null;
  executorSignatoryBasis?: string | null;
  items: Array<{
    serviceId: string;
    price: number;
    quantity: number;
    netProfit?: number;
    servicemanName?: string | null;
    equipmentId?: string;
    servicemanSplit?: Array<{ name: string; amount: number }> | null;
    prepaidAmount?: number;
    prepaidByCard?: boolean;
    prepaidCurrency?: string | null;
    prepaidCurrencyAmount?: number | null;
    prepaidRate?: number | null;
  }>;
}

type PrepaidInput = {
  prepaidAmount?: number;
  prepaidByCard?: boolean;
  prepaidCurrency?: string | null;
  prepaidCurrencyAmount?: number | null;
  prepaidRate?: number | null;
};

/**
 * Поля предоплаты позиции. Предоплата в валюте хранится исходной суммой и курсом,
 * а prepaidAmount — её эквивалент в BYN, пересчитанный здесь, чтобы не зависеть от округления на клиенте
 */
function prepaidFields(item: PrepaidInput) {
  if (item.prepaidCurrency && item.prepaidCurrencyAmount) {
    const [part] = parseCurrencyParts([
      { currency: item.prepaidCurrency, amount: item.prepaidCurrencyAmount, rate: item.prepaidRate },
    ]);
    return {
      prepaidAmount: toByn(part.amount, part.rate),
      prepaidByCard: false,
      prepaidCurrency: part.currency,
      prepaidCurrencyAmount: part.amount,
      prepaidRate: part.rate,
    };
  }
  return {
    prepaidAmount: item.prepaidAmount || 0,
    prepaidByCard: item.prepaidByCard || false,
    prepaidCurrency: null,
    prepaidCurrencyAmount: null,
    prepaidRate: null,
  };
}

// Приходы по записи — без расходов «Отчисление в капитал», которые создаются вместе с валютными приходами
const INCOME_TYPES: CashTransactionType[] = ['INCOME', 'INCOME_RS'];

export interface CloseDealDto {
  finalPrice: number;
  defects?: string;
  recommendations?: string;
  warranty?: string;
  isPaidByBankTransfer?: boolean;
  splitCashAmount?: number;
  splitCardAmount?: number;
  /** Часть остатка, оплаченная валютой: [{ currency, amount, rate }] */
  currencyPayments?: unknown;
}

export const recordsService = {
  async findByDate(date: string) {
    const d = new Date(date);
    const dayStart = startOfDay(d);
    const dayEnd = endOfDay(d);

    // Сравниваем строки дат чтобы избежать проблем с часовыми поясами
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isFuture = date > todayStr;

    if (!isFuture) {
      // Прошедшие дни и сегодня: закрытые в этот день + незакрытые записанные на этот день
      return prisma.record.findMany({
        where: {
          OR: [
            { status: 'CLOSED', deal: { closedAt: { gte: dayStart, lte: dayEnd } } },
            { scheduledAt: { gte: dayStart, lte: dayEnd }, status: { not: 'CLOSED' } },
          ],
        },
        include: RECORD_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
      });
    }

    // Будущие даты: по дате записи
    return prisma.record.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd } },
      include: RECORD_INCLUDE,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  async findIncomplete(clientDate?: string) {
    const today = clientDate ? new Date(clientDate) : startOfDay(new Date());
    return prisma.record.findMany({
      where: { scheduledAt: { lt: today }, status: 'ACTIVE' },
      include: RECORD_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
    });
  },

  async findClosedOnDate(date: string) {
    const d = new Date(date);
    const dayStart = startOfDay(d);
    const dayEnd = endOfDay(d);
    return prisma.record.findMany({
      where: {
        status: 'CLOSED',
        deal: { closedAt: { gte: dayStart, lte: dayEnd } },
        NOT: { scheduledAt: { gte: dayStart, lte: dayEnd } },
      },
      include: RECORD_INCLUDE,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  async findById(id: string) {
    const record = await prisma.record.findUnique({ where: { id }, include: RECORD_INCLUDE });
    if (!record) throw new AppError('Запись не найдена', 404);
    return record;
  },

  async create(data: CreateRecordDto) {
    const {
      clientId, car, scheduledAt, serviceman, receptionist, notes, items, clientSource,
      isLegalEntity, legalCompanyName, legalAddress, legalActualAddress, legalPostalAddress,
      legalBankDetails, legalBic, legalUnp, legalOkpo, legalPhone, legalEmail,
      legalRepresentativePosition, legalRepresentativePositionGenitive,
      legalRepresentative, legalRepresentativeGenitive,
      legalBasis, legalVin, legalEndDate,
      executorSignatoryName, executorSignatoryNameGenitive,
      executorSignatoryPosition, executorSignatoryPositionGenitive, executorSignatoryBasis,
    } = data;

    const newRecord = await prisma.$transaction(async (tx) => {
      // Генерация номера документа
      let settings = await tx.companySettings.findFirst();
      if (!settings) {
        settings = await tx.companySettings.create({ data: { name: 'Компания' } });
      }
      const prefix = settings.documentPrefix || 'ПА';
      const n = settings.nextDocumentNumber;
      const documentNumber = `${prefix}-${String(n).padStart(6, '0')}`;
      await tx.companySettings.update({
        where: { id: settings.id },
        data: { nextDocumentNumber: n + 1 },
      });

      // Найти или создать авто для клиента
      let carRecord = await tx.car.findFirst({
        where: { clientId, brandId: car.brandId, modelId: car.modelId, year: car.year },
      });

      if (!carRecord) {
        carRecord = await tx.car.create({
          data: {
            clientId,
            brand: car.brand,
            brandId: car.brandId,
            model: car.model,
            modelId: car.modelId,
            generation: car.generation,
            generationId: car.generationId != null ? String(car.generationId) : undefined,
            generationName: car.generationName,
            year: car.year,
            plateNumber: car.plateNumber,
            mileage: car.mileage,
          },
        });
      } else {
        const updateData: { plateNumber?: string; mileage?: string } = {};
        if (car.plateNumber) updateData.plateNumber = car.plateNumber;
        if (car.mileage) updateData.mileage = car.mileage;
        if (Object.keys(updateData).length > 0) {
          carRecord = await tx.car.update({ where: { id: carRecord.id }, data: updateData });
        }
      }

      const created = await tx.record.create({
        data: {
          clientId,
          carId: carRecord.id,
          scheduledAt: new Date(scheduledAt),
          serviceman: serviceman || null,
          receptionist: receptionist || null,
          notes,
          clientSource: clientSource ?? null,
          documentNumber,
          isLegalEntity: isLegalEntity ?? false,
          legalCompanyName, legalAddress, legalActualAddress, legalPostalAddress,
          legalBankDetails, legalBic, legalUnp, legalOkpo, legalPhone, legalEmail,
          legalRepresentativePosition, legalRepresentativePositionGenitive,
          legalRepresentative, legalRepresentativeGenitive,
          legalBasis, legalVin, legalEndDate,
          executorSignatoryName, executorSignatoryNameGenitive,
          executorSignatoryPosition, executorSignatoryPositionGenitive, executorSignatoryBasis,
          items: {
            create: items.map((item) => ({
              serviceId: item.serviceId,
              price: item.price,
              quantity: item.quantity,
              netProfit: item.netProfit,
              servicemanName: item.servicemanSplit?.length ? null : item.servicemanName,
              servicemanSplit: item.servicemanSplit?.length
                ? (item.servicemanSplit as Prisma.InputJsonValue)
                : undefined,
              equipmentId: item.equipmentId,
              ...prepaidFields(item),
            })),
          },
        },
        include: RECORD_INCLUDE,
      });
      // Предоплата — в той же транзакции: запись без прихода в кассе (или наоборот) не останется
      await recordsService.syncPrepaymentTransactions(
        tx, created.id, created.client.name, created.client.phone, carInfoOf(created.car), items,
      );
      return created;
    });

    sendSmsInBackground(newRecord.id, 'ON_CREATE');
    // Пуш менеджерам, директорам, создателю и мастеру записи (кроме автора): когда, какая машина и кто мастер
    const authorId = currentContext()?.userId;
    pushInBackground(() => pushService.sendNewRecord(newRecord.serviceman, authorId, {
      title: 'Новая запись',
      body: `${formatWhen(newRecord.scheduledAt)} · ${carInfoOf(newRecord.car)}${newRecord.serviceman ? ` · ${newRecord.serviceman}` : ''}`,
      url: '/schedule',
      tag: `record-${newRecord.id}`,
    }));
    return newRecord;
  },

  async update(id: string, data: Partial<CreateRecordDto>) {
    const record = await recordsService.findById(id);

    const updateData: Record<string, unknown> = {};
    if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.serviceman !== undefined) updateData.serviceman = data.serviceman || null;
    if (data.receptionist !== undefined) updateData.receptionist = data.receptionist || null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.clientSource !== undefined) updateData.clientSource = data.clientSource;

    // Legal entity fields
    if (data.isLegalEntity !== undefined) updateData.isLegalEntity = data.isLegalEntity;
    const legalFields = [
      'legalCompanyName', 'legalAddress', 'legalActualAddress', 'legalPostalAddress',
      'legalBankDetails', 'legalBic', 'legalUnp', 'legalOkpo', 'legalPhone', 'legalEmail',
      'legalRepresentativePosition', 'legalRepresentativePositionGenitive',
      'legalRepresentative', 'legalRepresentativeGenitive', 'legalBasis', 'legalVin', 'legalEndDate',
      'executorSignatoryName', 'executorSignatoryNameGenitive',
      'executorSignatoryPosition', 'executorSignatoryPositionGenitive', 'executorSignatoryBasis',
    ] as const;
    for (const field of legalFields) {
      if (field in data) updateData[field] = (data as Record<string, unknown>)[field] ?? null;
    }

    // Машина, позиции, предоплата и пересчёт закрытой сделки — одной транзакцией
    await prisma.$transaction(async (tx) => {
      if (data.car) {
        const car = data.car;
        const existingCar = record.car;
        if (car.brandId !== existingCar.brandId || car.modelId !== existingCar.modelId || car.year !== existingCar.year) {
          let carRecord = await tx.car.findFirst({
            where: { clientId: record.clientId, brandId: car.brandId, modelId: car.modelId, year: car.year },
          });
          if (!carRecord) {
            carRecord = await tx.car.create({
              data: {
                clientId: record.clientId,
                brand: car.brand,
                brandId: car.brandId,
                model: car.model,
                modelId: car.modelId,
                generation: car.generation,
                generationId: car.generationId != null ? String(car.generationId) : undefined,
                generationName: car.generationName,
                year: car.year,
                plateNumber: car.plateNumber,
                mileage: car.mileage,
              },
            });
          } else {
            const carUp: { plateNumber?: string; mileage?: string } = {};
            if (car.plateNumber) carUp.plateNumber = car.plateNumber;
            if (car.mileage) carUp.mileage = car.mileage;
            if (Object.keys(carUp).length > 0) {
              await tx.car.update({ where: { id: carRecord.id }, data: carUp });
            }
          }
          updateData.carId = carRecord.id;
        } else {
          const carUp: { plateNumber?: string | null; mileage?: string | null } = {};
          if (car.plateNumber !== undefined) carUp.plateNumber = car.plateNumber || null;
          if (car.mileage !== undefined) carUp.mileage = car.mileage || null;
          if (Object.keys(carUp).length > 0) {
            await tx.car.update({ where: { id: existingCar.id }, data: carUp });
          }
        }
      }

      if (data.items) {
        // Позиции пересоздаются целиком, а модалка редактирования записи не передаёт
        // назначения сотрудников (они задаются только при закрытии сделки). Если их не
        // перенести со старых позиций, закрытая работа исчезнет из зарплаты сотрудника.
        const unmatchedOld = [...record.items];
        const takeOldItem = (serviceId: string) => {
          const idx = unmatchedOld.findIndex(i => i.serviceId === serviceId);
          return idx === -1 ? undefined : unmatchedOld.splice(idx, 1)[0];
        };

        const itemsCreate = data.items.map((item) => {
          // Назначение считается заданным, если пришло хотя бы одно из двух полей
          const hasAssignment = item.servicemanName !== undefined || item.servicemanSplit !== undefined;
          const old = hasAssignment ? undefined : takeOldItem(item.serviceId);
          const servicemanName = hasAssignment ? item.servicemanName : (old?.servicemanName ?? undefined);
          const servicemanSplit = hasAssignment
            ? item.servicemanSplit
            : ((old?.servicemanSplit as Array<{ name: string; amount: number }> | null) ?? undefined);

          return {
            serviceId: item.serviceId,
            price: item.price,
            quantity: item.quantity,
            netProfit: item.netProfit,
            servicemanName: servicemanSplit?.length ? null : (servicemanName || null),
            servicemanSplit: servicemanSplit?.length
              ? (servicemanSplit as Prisma.InputJsonValue)
              : undefined,
            equipmentId: item.equipmentId,
            ...prepaidFields(item),
          };
        });

        await tx.recordItem.deleteMany({ where: { recordId: id } });
        await tx.record.update({ where: { id }, data: { ...updateData, items: { create: itemsCreate } } });
      } else if (Object.keys(updateData).length > 0) {
        await tx.record.update({ where: { id }, data: updateData });
      }

      if (record.status === 'ACTIVE' && data.items) {
        await recordsService.syncPrepaymentTransactions(
          tx, id, record.client.name, record.client.phone, carInfoOf(record.car), data.items,
        );
      }

      if (record.status === 'CLOSED' && data.items) {
        const items = await tx.recordItem.findMany({ where: { recordId: id }, include: { service: true, equipment: true } });
        for (const item of items) {
          if (item.service.isProduct) {
            await tx.recordItem.update({ where: { id: item.id }, data: { netProfit: 0, servicemanName: null } });
          } else {
            const retailPrice = item.service.hasEquipment && item.equipment ? (item.equipment.retailPrice ?? 0) : 0;
            await tx.recordItem.update({ where: { id: item.id }, data: { netProfit: item.price * item.quantity - retailPrice } });
          }
        }

        const newFinalPrice = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        await tx.deal.update({ where: { recordId: id }, data: { finalPrice: newFinalPrice } });

        // Пересчитываем только закрывающие транзакции (не предоплату). Валюта остаётся как была
        // принята, остаток после неё — одним приходом (разбивка нал/карта при правке цены не сохраняется)
        await recordsService.syncClosingTransactions(tx, record, {
          finalPrice: newFinalPrice,
          isPaidByBankTransfer: record.deal?.isPaidByBankTransfer ?? false,
          currencyParts: parseCurrencyParts(record.deal?.currencyPayments),
          date: record.deal?.closedAt ?? new Date(),
        });
      }
    });

    return recordsService.findById(id);
  },

  async close(id: string, data: CloseDealDto) {
    const record = await recordsService.findById(id);

    const { finalPrice, defects, recommendations, warranty, isPaidByBankTransfer = false, splitCashAmount, splitCardAmount } = data;
    const isSplit = splitCashAmount != null && splitCardAmount != null;
    const currencyParts = parseCurrencyParts(data.currencyPayments);
    const currencyPayments = currencyParts.length ? (currencyParts as unknown as Prisma.InputJsonValue) : Prisma.DbNull;

    if (record.status === 'CLOSED') {
      await prisma.$transaction(async (tx) => {
        await tx.deal.update({
          where: { recordId: id },
          // Форма закрытия присылает всё состояние: пустые поля очищаем, а не оставляем прежними
          data: { finalPrice, defects: defects || null, recommendations: recommendations || null, warranty, isPaidByBankTransfer, splitCashAmount: isSplit ? splitCashAmount : null, splitCardAmount: isSplit ? splitCardAmount : null, currencyPayments },
        });
        // Пересоздаём только закрывающие транзакции, предоплату не трогаем
        await recordsService.syncClosingTransactions(tx, record, {
          finalPrice,
          isPaidByBankTransfer,
          splitCashAmount: isSplit ? splitCashAmount : undefined,
          splitCardAmount: isSplit ? splitCardAmount : undefined,
          currencyParts,
          date: new Date(),
        });
      });
      return recordsService.findById(id);
    }

    // Для услуг с оборудованием оборудование должно быть выбрано
    const missingEquipment = record.items.filter(item => item.service.hasEquipment && !item.equipmentId);
    if (missingEquipment.length > 0) {
      const names = missingEquipment.map(i => i.service.name).join(', ');
      throw new AppError(`Укажите оборудование для услуг: ${names}`, 400);
    }

    const equipmentIds = record.items
      .filter(i => i.equipmentId != null)
      .map(i => i.equipmentId as string);

    // Прибыль позиций, сделка, статус и приходы в кассе — одной транзакцией:
    // сбой посередине не оставит закрытую запись без денег в кассе
    await prisma.$transaction(async (tx) => {
      // Прибыль позиции считается автоматически; товары в зарплату не идут
      for (const item of record.items) {
        if (item.service.isProduct) {
          await tx.recordItem.update({ where: { id: item.id }, data: { netProfit: 0, servicemanName: null } });
        } else {
          const retailPrice = item.service.hasEquipment && item.equipment ? (item.equipment.retailPrice ?? 0) : 0;
          await tx.recordItem.update({ where: { id: item.id }, data: { netProfit: item.price * item.quantity - retailPrice } });
        }
      }
      await tx.deal.create({
        data: {
          recordId: id,
          finalPrice,
          defects,
          recommendations,
          warranty,
          isPaidByBankTransfer,
          splitCashAmount: isSplit ? splitCashAmount : null,
          splitCardAmount: isSplit ? splitCardAmount : null,
          currencyPayments,
          equipment: equipmentIds.length
            ? { create: equipmentIds.map((equipmentId) => ({ equipmentId })) }
            : undefined,
        },
      });
      await tx.record.update({ where: { id }, data: { status: 'CLOSED' } });
      await recordsService.syncClosingTransactions(tx, record, {
        finalPrice,
        isPaidByBankTransfer,
        splitCashAmount: isSplit ? splitCashAmount : undefined,
        splitCardAmount: isSplit ? splitCardAmount : undefined,
        currencyParts,
        date: new Date(),
      });
    });

    // Повторные закрытия отсекаются и веткой выше, и правилом «отзыв один раз на запись» в sms.service
    sendSmsInBackground(id, 'REVIEW_REQUEST');
    return recordsService.findById(id);
  },

  async setSalaryDate(id: string, salaryDate: string | null) {
    const record = await recordsService.findById(id);
    if (!record.deal) throw new AppError('Запись не закрыта', 400);
    await prisma.deal.update({
      where: { recordId: id },
      data: { salaryDate: salaryDate ? new Date(salaryDate) : null },
    });
    return recordsService.findById(id);
  },

  async cancel(id: string, data?: { retainedCashAmount?: number; retainedCardAmount?: number }) {
    const record = await recordsService.findById(id);

    // Получаем текущие рублёвые prepayment-транзакции. Валютная предоплата уже в капитале —
    // при отмене она остаётся как есть (вернуть её можно выдачей из капитала)
    const rublePrepayment = { recordId: id, isPrepayment: true, type: { in: INCOME_TYPES }, currency: null };
    const prepayTxs = await prisma.cashTransaction.findMany({ where: rublePrepayment });
    const totalPrepaidCash = prepayTxs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const totalPrepaidCard = prepayTxs.filter(t => t.type === 'INCOME_RS').reduce((s, t) => s + t.amount, 0);

    const retainedCash = data?.retainedCashAmount ?? totalPrepaidCash;
    const retainedCard = data?.retainedCardAmount ?? totalPrepaidCard;

    const cashChanged = retainedCash !== totalPrepaidCash || retainedCard !== totalPrepaidCard;

    // Пересоздание предоплаты и смена статуса — одной транзакцией
    return prisma.$transaction(async (tx) => {
      if (cashChanged) {
        await tx.cashTransaction.deleteMany({ where: rublePrepayment });
        const baseData = {
          clientName: record.client.name,
          clientPhone: record.client.phone,
          carInfo: `${record.car.brand} ${record.car.model} ${record.car.year}`,
          recordId: id,
          date: new Date(),
          isPrepayment: true,
          description: 'Предоплата сохранена при отмене',
        };
        if (retainedCash > 0) {
          await tx.cashTransaction.create({ data: { ...baseData, type: 'INCOME', amount: retainedCash } });
        }
        if (retainedCard > 0) {
          await tx.cashTransaction.create({ data: { ...baseData, type: 'INCOME_RS', amount: retainedCard } });
        }
      }
      return tx.record.update({ where: { id }, data: { status: 'CANCELLED' }, include: RECORD_INCLUDE });
    });
  },

  async restore(id: string) {
    const record = await recordsService.findById(id);
    if (record.status !== 'CANCELLED') throw new AppError('Запись не была отменена', 400);
    return prisma.record.update({ where: { id }, data: { status: 'ACTIVE' }, include: RECORD_INCLUDE });
  },

  async delete(id: string) {
    await recordsService.findById(id);
    // Файлы фото/видео удаляем с диска до удаления строк (строки удалятся каскадом)
    await recordMediaService.removeFilesOfRecord(id);
    await prisma.$transaction([
      prisma.cashTransaction.deleteMany({ where: { recordId: id } }),
      prisma.deal.deleteMany({ where: { recordId: id } }),
      prisma.record.delete({ where: { id } }),
    ]);
  },

  async searchCompanies(search: string) {
    const records = await prisma.record.findMany({
      where: {
        isLegalEntity: true,
        legalCompanyName: search
          ? { contains: search, mode: 'insensitive' }
          : { not: null },
      },
      select: {
        legalCompanyName: true,
        legalAddress: true,
        legalActualAddress: true,
        legalPostalAddress: true,
        legalBankDetails: true,
        legalBic: true,
        legalUnp: true,
        legalOkpo: true,
        legalPhone: true,
        legalEmail: true,
        legalRepresentativePosition: true,
        legalRepresentativePositionGenitive: true,
        legalRepresentative: true,
        legalRepresentativeGenitive: true,
        legalBasis: true,
        executorSignatoryName: true,
        executorSignatoryNameGenitive: true,
        executorSignatoryPosition: true,
        executorSignatoryPositionGenitive: true,
        executorSignatoryBasis: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const seen = new Set<string>();
    return records.filter(r => {
      if (!r.legalCompanyName) return false;
      const key = r.legalCompanyName.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  },

  /**
   * Закрывающие транзакции сделки: всё, что осталось после предоплаты. Сначала валюта
   * (приход по курсу + отчисление в капитал), остаток — рублями нал/карта/РС. Если валюты дали
   * больше остатка, разница — расход «Сдача клиенту». Прежние закрывающие транзакции удаляются
   * (отчисления в капитал — каскадом вместе с валютными приходами).
   */
  async syncClosingTransactions(
    db: DbClient,
    record: { id: string; client: { name: string; phone: string }; car: { brand: string; model: string; year: string; plateNumber?: string | null } },
    data: {
      finalPrice: number;
      isPaidByBankTransfer: boolean;
      splitCashAmount?: number;
      splitCardAmount?: number;
      currencyParts: CurrencyPart[];
      date: Date;
    },
  ) {
    const { id } = record;
    await db.cashTransaction.deleteMany({ where: { recordId: id, isPrepayment: false } });

    const prepaidAgg = await db.cashTransaction.aggregate({
      where: { recordId: id, isPrepayment: true, type: { in: INCOME_TYPES } },
      _sum: { amount: true },
    });
    const remaining = Math.max(0, roundMoney(data.finalPrice - Number(prepaidAgg._sum.amount ?? 0)));
    const base = {
      recordId: id,
      clientName: record.client.name,
      clientPhone: record.client.phone,
      carInfo: carInfoOf(record.car),
    };

    for (const part of data.currencyParts) {
      await currencyAccountingService.createCurrencyIncome(db, {
        ...base,
        part,
        date: data.date,
        description: 'Оплата в валюте',
      });
    }

    const rest = roundMoney(remaining - currencyPartsByn(data.currencyParts));
    if (rest > 0) {
      // Разбивка нал/карта считается на клиенте от остатка после валюты — если не сходится, не используем
      const hasSplit = data.splitCashAmount != null && data.splitCardAmount != null
        && Math.abs(data.splitCashAmount + data.splitCardAmount - rest) < 0.01;
      await cashService.createIncomeFromDeal({
        ...base,
        amount: rest,
        isPaidByBankTransfer: data.isPaidByBankTransfer,
        splitCashAmount: hasSplit ? data.splitCashAmount : undefined,
        splitCardAmount: hasSplit ? data.splitCardAmount : undefined,
        closedAt: data.date,
      }, db);
    } else if (rest < 0) {
      await db.cashTransaction.create({
        data: { ...base, type: 'EXPENSE', date: data.date, amount: -rest, description: 'Сдача клиенту в BYN после оплаты валютой' },
      });
    }
  },

  async syncPrepaymentTransactions(
    db: DbClient,
    recordId: string,
    clientName: string,
    clientPhone: string,
    carInfo: string,
    items: Array<{ serviceId: string } & PrepaidInput>,
  ) {
    // Отчисления в капитал за валютную предоплату удаляются каскадом вместе с приходами
    await db.cashTransaction.deleteMany({ where: { recordId, isPrepayment: true } });

    const prepaidItems = items
      .map(i => ({ serviceId: i.serviceId, ...prepaidFields(i) }))
      .filter(i => i.prepaidAmount > 0);
    if (prepaidItems.length === 0) return;

    const serviceIds = prepaidItems.map(i => i.serviceId);
    const services = await db.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } });
    const serviceNames = prepaidItems
      .map(i => services.find(s => s.id === i.serviceId)?.name || '')
      .filter(Boolean)
      .join(', ');
    const description = `Предоплата: ${serviceNames}`;

    const rubleItems = prepaidItems.filter(i => !i.prepaidCurrency);
    const cashTotal = rubleItems.filter(i => !i.prepaidByCard).reduce((s, i) => s + i.prepaidAmount, 0);
    const cardTotal = rubleItems.filter(i => i.prepaidByCard).reduce((s, i) => s + i.prepaidAmount, 0);

    const base = { recordId, clientName, clientPhone, carInfo, date: new Date(), isPrepayment: true, description };
    if (cashTotal > 0) await db.cashTransaction.create({ data: { ...base, type: 'INCOME', amount: cashTotal } });
    if (cardTotal > 0) await db.cashTransaction.create({ data: { ...base, type: 'INCOME_RS', amount: cardTotal } });

    // Каждая валютная предоплата — свой приход по своему курсу
    for (const i of prepaidItems) {
      if (!i.prepaidCurrency || !i.prepaidCurrencyAmount || !i.prepaidRate) continue;
      await currencyAccountingService.createCurrencyIncome(db, {
        ...base,
        part: { currency: i.prepaidCurrency, amount: i.prepaidCurrencyAmount, rate: i.prepaidRate },
      });
    }
  },
};
