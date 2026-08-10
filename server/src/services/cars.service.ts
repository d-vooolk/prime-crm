import { prisma } from '../prisma/client';

/**
 * Локальный справочник авто. Форма ответов повторяет сторонний каталог,
 * из которого данные были выкачаны, — клиенту переезд незаметен.
 * Наружу всегда отдаём externalId донора: именно он лежит в Car.brandId/modelId/generationId.
 */
export const carsService = {
  async getMarks() {
    const marks = await prisma.carMark.findMany({ orderBy: { name: 'asc' } });
    return marks.map(m => ({
      id: m.id,
      name: m.name,
      year_from: m.yearFrom,
      year_to: m.yearTo,
      logo: m.logo,
    }));
  },

  async getModels(markId: string) {
    const models = await prisma.carModel.findMany({
      where: { markId },
      orderBy: { name: 'asc' },
    });
    return models.map(m => ({
      id: m.externalId,
      name: m.name,
      year_from: m.yearFrom,
      year_to: m.yearTo,
    }));
  },

  async getGenerations(markId: string, modelExternalId: string) {
    const generations = await prisma.carGeneration.findMany({
      where: { model: { markId, externalId: modelExternalId } },
      orderBy: [{ yearFrom: 'desc' }, { name: 'asc' }],
    });
    return generations.map(g => ({
      id: g.externalId,
      name: g.name,
      year_from: g.yearFrom,
      year_to: g.yearTo,
      photo: g.photo,
    }));
  },

  /** URL фото поколения — для проксирующего эндпоинта /cars/photo. */
  async getGenerationPhoto(markId: string, modelExternalId: string, generationExternalId: string) {
    const generation = await prisma.carGeneration.findFirst({
      where: {
        externalId: generationExternalId,
        model: { markId, externalId: modelExternalId },
      },
      select: { photo: true },
    });
    return generation?.photo ?? null;
  },
};
