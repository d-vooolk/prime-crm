import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { findOpportunities, PastVisit, VisitItem } from './opportunities.logic';

/** Сколько последних закрытых визитов той же модели смотрим */
const HISTORY_LIMIT = 300;
/** Меньше визитов того же поколения — добавляем визиты всей модели */
const MIN_GENERATION_VISITS = 5;

const itemsOf = (items: { serviceId: string; price: number; quantity: number; service: { name: string } }[]): VisitItem[] =>
  items.map(i => ({ serviceId: i.serviceId, name: i.service.name, amount: i.price * i.quantity }));

/** «Открытые возможности» (BETA): допродажи по прошлым визитам таких же автомобилей */
export const opportunitiesService = {
  async forRecord(recordId: string) {
    const record = await prisma.record.findUnique({
      where: { id: recordId },
      select: {
        carId: true,
        car: { select: { brandId: true, modelId: true, generationId: true } },
        items: { select: { serviceId: true, price: true, quantity: true, service: { select: { name: true } } } },
      },
    });
    if (!record) throw new AppError('Запись не найдена', 404);
    const { car } = record;

    const past = await prisma.record.findMany({
      where: {
        id: { not: recordId },
        status: 'CLOSED',
        car: { brandId: car.brandId, modelId: car.modelId },
      },
      orderBy: { scheduledAt: 'desc' },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        carId: true,
        car: { select: { generationId: true } },
        items: { select: { serviceId: true, price: true, quantity: true, service: { select: { name: true } } } },
      },
    });

    const visits: PastVisit[] = past.map(r => ({
      recordId: r.id,
      carId: r.carId,
      sameGeneration: !!car.generationId && r.car.generationId === car.generationId,
      items: itemsOf(r.items),
    }));
    const sameGeneration = visits.filter(v => v.sameGeneration);
    const scope = car.generationId && sameGeneration.length >= MIN_GENERATION_VISITS ? 'generation' : 'model';
    const considered = scope === 'generation' ? sameGeneration : visits;

    return {
      scope,
      basedOn: considered.length,
      items: findOpportunities({ carId: record.carId, items: itemsOf(record.items) }, considered),
    };
  },
};
