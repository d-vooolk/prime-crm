import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { startOfDay, endOfDay } from '../utils/date';

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
  items: Array<{
    serviceId: string;
    price: number;
    quantity: number;
  }>;
}

export interface CloseDealDto {
  finalPrice: number;
  priceIncreaseReason?: string;
  warranty?: string;
  equipmentIds?: string[];
}

export const recordsService = {
  async findByDate(date: string) {
    const d = new Date(date);
    return prisma.record.findMany({
      where: {
        scheduledAt: {
          gte: startOfDay(d),
          lte: endOfDay(d),
        },
      },
      include: {
        client: true,
        car: true,
        items: { include: { service: { include: { category: true } } } },
        deal: { include: { equipment: { include: { equipment: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  },

  async findIncomplete() {
    const today = startOfDay(new Date());
    return prisma.record.findMany({
      where: {
        scheduledAt: { lt: today },
        status: 'ACTIVE',
      },
      include: {
        client: true,
        car: true,
        items: { include: { service: { include: { category: true } } } },
        deal: { include: { equipment: { include: { equipment: true } } } },
      },
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
    } = data;

    // Найти или создать авто для клиента
    let carRecord = await prisma.car.findFirst({
      where: {
        clientId,
        brandId: car.brandId,
        modelId: car.modelId,
        year: car.year,
      },
    });

    if (!carRecord) {
      carRecord = await prisma.car.create({
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
        },
      });
    }

    return prisma.record.create({
      data: {
        clientId,
        carId: carRecord.id,
        scheduledAt: new Date(scheduledAt),
        serviceman,
        receptionist,
        notes,
        isLegalEntity: isLegalEntity ?? false,
        legalCompanyName, legalAddress, legalActualAddress, legalPostalAddress,
        legalBankDetails, legalBic, legalUnp, legalOkpo, legalPhone, legalEmail,
        items: {
          create: items.map((item) => ({
            serviceId: item.serviceId,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        client: true,
        car: true,
        items: { include: { service: { include: { category: true } } } },
        deal: true,
      },
    });
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

    return prisma.record.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        car: true,
        items: { include: { service: { include: { category: true } } } },
        deal: { include: { equipment: { include: { equipment: true } } } },
      },
    });
  },

  async close(id: string, data: CloseDealDto) {
    const record = await recordsService.findById(id);
    if (record.status === 'CLOSED') throw new AppError('Сделка уже закрыта', 400);

    const { finalPrice, priceIncreaseReason, warranty, equipmentIds } = data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.deal.create({
        data: {
          recordId: id,
          finalPrice,
          priceIncreaseReason,
          warranty,
          equipment: equipmentIds?.length
            ? {
                create: equipmentIds.map((equipmentId) => ({ equipmentId })),
              }
            : undefined,
        },
      });
      await tx.record.update({ where: { id }, data: { status: 'CLOSED' } });
    });

    return recordsService.findById(id);
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
    return prisma.record.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: {
        client: true,
        car: true,
        items: { include: { service: { include: { category: true } } } },
        deal: { include: { equipment: { include: { equipment: true } } } },
      },
    });
  },
};
