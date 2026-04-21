import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { startOfDay, endOfDay } from '../utils/date';
import { smsService } from './sms.service';
import { accountingService } from './accounting.service';

const RECORD_INCLUDE = {
  client: true,
  car: true,
  items: { include: { service: { include: { category: true } } } },
  deal: { include: { equipment: { include: { equipment: true } } } },
  smsLogs: { orderBy: { sentAt: 'asc' as const } },
} as const;

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
  serviceman: string;
  receptionist?: string;
  notes?: string;
  isLegalEntity?: boolean;
  legalCompanyName?: string;
  legalAddress?: string;
  legalActualAddress?: string;
  legalPostalAddress?: string;
  legalBankDetails?: string;
  legalBic?: string;
  legalUnp?: string;
  legalOkpo?: string;
  legalPhone?: string;
  legalEmail?: string;
  legalRepresentativePosition?: string;
  legalRepresentativePositionGenitive?: string;
  legalRepresentative?: string;
  legalRepresentativeGenitive?: string;
  legalBasis?: string;
  legalVin?: string;
  legalEndDate?: string;
  items: Array<{
    serviceId: string;
    price: number;
    quantity: number;
  }>;
}

export interface CloseDealDto {
  finalPrice: number;
  defects?: string;
  warranty?: string;
  equipmentIds?: string[];
  isPaidByBankTransfer?: boolean;
}

export const recordsService = {
  async findByDate(date: string) {
    const d = new Date(date);
    return prisma.record.findMany({
      where: { scheduledAt: { gte: startOfDay(d), lte: endOfDay(d) } },
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

  async findById(id: string) {
    const record = await prisma.record.findUnique({
      where: { id },
      include: {
        client: true,
        car: true,
        items: { include: { service: { include: { category: true } } } },
        deal: { include: { equipment: { include: { equipment: true } } } },
        smsLogs: { orderBy: { sentAt: 'asc' } },
      },
    });
    if (!record) throw new AppError('Запись не найдена', 404);
    return record;
  },

  async create(data: CreateRecordDto) {
    const {
      clientId, car, scheduledAt, serviceman, receptionist, notes, items,
      isLegalEntity, legalCompanyName, legalAddress, legalActualAddress, legalPostalAddress,
      legalBankDetails, legalBic, legalUnp, legalOkpo, legalPhone, legalEmail,
      legalRepresentativePosition, legalRepresentativePositionGenitive,
      legalRepresentative, legalRepresentativeGenitive,
      legalBasis, legalVin, legalEndDate,
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

      return tx.record.create({
        data: {
          clientId,
          carId: carRecord.id,
          scheduledAt: new Date(scheduledAt),
          serviceman,
          receptionist,
          notes,
          documentNumber,
          isLegalEntity: isLegalEntity ?? false,
          legalCompanyName, legalAddress, legalActualAddress, legalPostalAddress,
          legalBankDetails, legalBic, legalUnp, legalOkpo, legalPhone, legalEmail,
          legalRepresentativePosition, legalRepresentativePositionGenitive,
          legalRepresentative, legalRepresentativeGenitive,
          legalBasis, legalVin, legalEndDate,
          items: {
            create: items.map((item) => ({
              serviceId: item.serviceId,
              price: item.price,
              quantity: item.quantity,
            })),
          },
        },
        include: RECORD_INCLUDE,
      });
    });

    // fire-and-forget: не блокируем ответ
    smsService.sendForRecord(newRecord.id, 'ON_CREATE');
    return newRecord;
  },

  async update(id: string, data: Partial<CreateRecordDto>) {
    const record = await recordsService.findById(id);
    if (record.status === 'CLOSED') throw new AppError('Закрытую сделку нельзя редактировать', 400);

    const updateData: Record<string, unknown> = {};
    if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.serviceman !== undefined) updateData.serviceman = data.serviceman;
    if (data.receptionist !== undefined) updateData.receptionist = data.receptionist;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.items) {
      await prisma.recordItem.deleteMany({ where: { recordId: id } });
      updateData.items = {
        create: data.items.map((item) => ({
          serviceId: item.serviceId,
          price: item.price,
          quantity: item.quantity,
        })),
      };
    }

    return prisma.record.update({ where: { id }, data: updateData, include: RECORD_INCLUDE });
  },

  async close(id: string, data: CloseDealDto) {
    const record = await recordsService.findById(id);
    if (record.status === 'CLOSED') throw new AppError('Сделка уже закрыта', 400);

    const { finalPrice, defects, warranty, equipmentIds, isPaidByBankTransfer = false } = data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.deal.create({
        data: {
          recordId: id,
          finalPrice,
          defects,
          warranty,
          isPaidByBankTransfer,
          equipment: equipmentIds?.length
            ? {
                create: equipmentIds.map((equipmentId) => ({ equipmentId })),
              }
            : undefined,
        },
      });
      await tx.record.update({ where: { id }, data: { status: 'CLOSED' } });
    });

    const closed = await recordsService.findById(id);

    await accountingService.createIncomeFromDeal({
      recordId: id,
      clientName: record.client.name,
      clientPhone: record.client.phone,
      carInfo: `${record.car.brand} ${record.car.model} ${record.car.year}${record.car.plateNumber ? ' ' + record.car.plateNumber : ''}`,
      amount: finalPrice,
      isPaidByBankTransfer,
      closedAt: new Date(),
    });

    return closed;
  },

  async cancel(id: string) {
    await recordsService.findById(id);
    return prisma.record.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  },

  async restore(id: string) {
    const record = await recordsService.findById(id);
    if (record.status !== 'CANCELLED') throw new AppError('Запись не была отменена', 400);
    return prisma.record.update({ where: { id }, data: { status: 'ACTIVE' }, include: RECORD_INCLUDE });
  },

  async delete(id: string) {
    await recordsService.findById(id);
    await prisma.deal.deleteMany({ where: { recordId: id } });
    await prisma.record.delete({ where: { id } });
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
};
