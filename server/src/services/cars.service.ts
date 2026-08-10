import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';

/**
 * Локальный справочник авто. Форма ответов повторяет сторонний каталог,
 * из которого данные были выкачаны, — клиенту переезд незаметен.
 * Наружу всегда отдаём externalId донора: именно он лежит в Car.brandId/modelId/generationId.
 *
 * Записи бывают двух видов: SNAPSHOT (из снапшота донора, только чтение) и
 * MANUAL (заведённые руками — грузовые и всё, чего у донора нет).
 */

const TRANSLIT: Record<string, string> = {
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'ZH', з: 'Z', и: 'I',
  й: 'Y', к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T',
  у: 'U', ф: 'F', х: 'H', ц: 'TS', ч: 'CH', ш: 'SH', щ: 'SCH', ъ: '', ы: 'Y', ь: '',
  э: 'E', ю: 'YU', я: 'YA',
};

/** Человекочитаемый идентификатор из названия: «КамАЗ 5490» → «KAMAZ_5490». */
function slugify(name: string) {
  const base = name.trim().toLowerCase()
    .split('')
    .map(ch => TRANSLIT[ch] ?? ch)
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'ITEM';
}

/** Подбирает свободный id: BASE, BASE_2, BASE_3... */
async function uniqueId(base: string, exists: (candidate: string) => Promise<boolean>) {
  if (!await exists(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!await exists(candidate)) return candidate;
  }
  throw new AppError('Не удалось подобрать идентификатор — слишком много похожих названий', 400);
}

function requireName(name: unknown): string {
  const value = String(name ?? '').trim();
  if (!value) throw new AppError('Укажите название', 400);
  if (value.length > 120) throw new AppError('Название длиннее 120 символов', 400);
  return value;
}

function optionalYear(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new AppError(`${label}: год должен быть между 1900 и 2100`, 400);
  }
  return year;
}

/**
 * Ссылка на фото. У записей донора здесь путь без схемы
 * (avatars.mds.yandex.net/...), от руки принимаем только полный URL —
 * так понятнее, что вводить. Прокси /cars/photo умеет и то, и другое.
 */
function optionalPhoto(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const url = String(value).trim();
  if (!url) return null;
  if (url.length > 500) throw new AppError('Ссылка на фото длиннее 500 символов', 400);
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new AppError('Ссылка на фото должна начинаться с http:// или https:// и не содержать пробелов', 400);
  }
  return url;
}

function checkYearRange(from: number | null, to: number | null) {
  if (from !== null && to !== null && from > to) {
    throw new AppError('Год начала выпуска больше года окончания', 400);
  }
}

async function getManualMark(markId: string) {
  const mark = await prisma.carMark.findUnique({ where: { id: markId } });
  if (!mark) throw new AppError('Марка не найдена', 404);
  if (mark.source !== 'MANUAL') throw new AppError('Марка из основного каталога — её нельзя изменять', 400);
  return mark;
}

async function getManualModel(markId: string, externalId: string) {
  const model = await prisma.carModel.findFirst({ where: { markId, externalId } });
  if (!model) throw new AppError('Модель не найдена', 404);
  if (model.source !== 'MANUAL') throw new AppError('Модель из основного каталога — её нельзя изменять', 400);
  return model;
}

async function getManualGeneration(markId: string, modelExternalId: string, externalId: string) {
  const generation = await prisma.carGeneration.findFirst({
    where: { externalId, model: { markId, externalId: modelExternalId } },
  });
  if (!generation) throw new AppError('Поколение не найдено', 404);
  if (generation.source !== 'MANUAL') throw new AppError('Поколение из основного каталога — его нельзя изменять', 400);
  return generation;
}

export const carsService = {
  async getMarks(manualOnly = false) {
    const marks = await prisma.carMark.findMany({
      where: manualOnly ? { source: 'MANUAL' } : undefined,
      orderBy: { name: 'asc' },
    });
    return marks.map(m => ({
      id: m.id,
      name: m.name,
      year_from: m.yearFrom,
      year_to: m.yearTo,
      logo: m.logo,
      source: m.source,
    }));
  },

  async getModels(markId: string) {
    const models = await prisma.carModel.findMany({ where: { markId }, orderBy: { name: 'asc' } });
    return models.map(m => ({
      id: m.externalId,
      name: m.name,
      year_from: m.yearFrom,
      year_to: m.yearTo,
      source: m.source,
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
      source: g.source,
    }));
  },

  /** URL фото поколения — для проксирующего эндпоинта /cars/photo. */
  async getGenerationPhoto(markId: string, modelExternalId: string, generationExternalId: string) {
    const generation = await prisma.carGeneration.findFirst({
      where: { externalId: generationExternalId, model: { markId, externalId: modelExternalId } },
      select: { photo: true },
    });
    return generation?.photo ?? null;
  },

  // --- Марки ---

  async createMark(data: { name: unknown; yearFrom?: unknown; yearTo?: unknown }) {
    const name = requireName(data.name);
    const yearFrom = optionalYear(data.yearFrom, 'Марка');
    const yearTo = optionalYear(data.yearTo, 'Марка');
    checkYearRange(yearFrom, yearTo);

    const duplicate = await prisma.carMark.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (duplicate) throw new AppError(`Марка «${duplicate.name}» уже есть в справочнике`, 400);

    const id = await uniqueId(slugify(name), async c => !!await prisma.carMark.findUnique({ where: { id: c } }));
    return prisma.carMark.create({ data: { id, name, yearFrom, yearTo, source: 'MANUAL' } });
  },

  async updateMark(markId: string, data: { name?: unknown; yearFrom?: unknown; yearTo?: unknown }) {
    const mark = await getManualMark(markId);
    const name = data.name !== undefined ? requireName(data.name) : mark.name;
    const yearFrom = data.yearFrom !== undefined ? optionalYear(data.yearFrom, 'Марка') : mark.yearFrom;
    const yearTo = data.yearTo !== undefined ? optionalYear(data.yearTo, 'Марка') : mark.yearTo;
    checkYearRange(yearFrom, yearTo);

    if (name !== mark.name) {
      const duplicate = await prisma.carMark.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, id: { not: markId } },
      });
      if (duplicate) throw new AppError(`Марка «${duplicate.name}» уже есть в справочнике`, 400);
    }
    // id не меняем: он уже мог уехать в Car.brandId
    return prisma.carMark.update({ where: { id: markId }, data: { name, yearFrom, yearTo } });
  },

  async deleteMark(markId: string) {
    await getManualMark(markId);
    const inUse = await prisma.car.count({ where: { brandId: markId } });
    if (inUse) throw new AppError(`Марка используется в ${inUse} авто клиентов — удалить нельзя`, 400);
    await prisma.carMark.delete({ where: { id: markId } });
  },

  // --- Модели ---

  async createModel(markId: string, data: { name: unknown; yearFrom?: unknown; yearTo?: unknown }) {
    const mark = await prisma.carMark.findUnique({ where: { id: markId } });
    if (!mark) throw new AppError('Марка не найдена', 404);

    const name = requireName(data.name);
    const yearFrom = optionalYear(data.yearFrom, 'Модель');
    const yearTo = optionalYear(data.yearTo, 'Модель');
    checkYearRange(yearFrom, yearTo);

    const duplicate = await prisma.carModel.findFirst({
      where: { markId, name: { equals: name, mode: 'insensitive' } },
    });
    if (duplicate) throw new AppError(`Модель «${duplicate.name}» уже есть у этой марки`, 400);

    const externalId = await uniqueId(
      slugify(name),
      async c => !!await prisma.carModel.findFirst({ where: { markId, externalId: c } }),
    );
    return prisma.carModel.create({
      data: { id: `${markId}/${externalId}`, externalId, markId, name, yearFrom, yearTo, source: 'MANUAL' },
    });
  },

  async updateModel(markId: string, modelExternalId: string, data: { name?: unknown; yearFrom?: unknown; yearTo?: unknown }) {
    const model = await getManualModel(markId, modelExternalId);
    const name = data.name !== undefined ? requireName(data.name) : model.name;
    const yearFrom = data.yearFrom !== undefined ? optionalYear(data.yearFrom, 'Модель') : model.yearFrom;
    const yearTo = data.yearTo !== undefined ? optionalYear(data.yearTo, 'Модель') : model.yearTo;
    checkYearRange(yearFrom, yearTo);

    if (name !== model.name) {
      const duplicate = await prisma.carModel.findFirst({
        where: { markId, name: { equals: name, mode: 'insensitive' }, id: { not: model.id } },
      });
      if (duplicate) throw new AppError(`Модель «${duplicate.name}» уже есть у этой марки`, 400);
    }
    return prisma.carModel.update({ where: { id: model.id }, data: { name, yearFrom, yearTo } });
  },

  async deleteModel(markId: string, modelExternalId: string) {
    const model = await getManualModel(markId, modelExternalId);
    const inUse = await prisma.car.count({ where: { brandId: markId, modelId: modelExternalId } });
    if (inUse) throw new AppError(`Модель используется в ${inUse} авто клиентов — удалить нельзя`, 400);
    await prisma.carModel.delete({ where: { id: model.id } });
  },

  // --- Поколения ---

  async createGeneration(
    markId: string,
    modelExternalId: string,
    data: { name: unknown; yearFrom?: unknown; yearTo?: unknown; photo?: unknown },
  ) {
    const model = await prisma.carModel.findFirst({ where: { markId, externalId: modelExternalId } });
    if (!model) throw new AppError('Модель не найдена', 404);

    const name = requireName(data.name);
    const yearFrom = optionalYear(data.yearFrom, 'Поколение');
    const yearTo = optionalYear(data.yearTo, 'Поколение');
    const photo = optionalPhoto(data.photo);
    checkYearRange(yearFrom, yearTo);

    const duplicate = await prisma.carGeneration.findFirst({
      where: { modelId: model.id, name: { equals: name, mode: 'insensitive' } },
    });
    if (duplicate) throw new AppError(`Поколение «${duplicate.name}» уже есть у этой модели`, 400);

    const externalId = await uniqueId(
      slugify(name),
      async c => !!await prisma.carGeneration.findFirst({ where: { modelId: model.id, externalId: c } }),
    );
    return prisma.carGeneration.create({
      data: { id: `${model.id}/${externalId}`, externalId, modelId: model.id, name, yearFrom, yearTo, photo, source: 'MANUAL' },
    });
  },

  async updateGeneration(
    markId: string,
    modelExternalId: string,
    generationExternalId: string,
    data: { name?: unknown; yearFrom?: unknown; yearTo?: unknown; photo?: unknown },
  ) {
    const generation = await getManualGeneration(markId, modelExternalId, generationExternalId);
    const name = data.name !== undefined ? requireName(data.name) : generation.name;
    const yearFrom = data.yearFrom !== undefined ? optionalYear(data.yearFrom, 'Поколение') : generation.yearFrom;
    const yearTo = data.yearTo !== undefined ? optionalYear(data.yearTo, 'Поколение') : generation.yearTo;
    // photo: undefined — не трогаем, null или пустая строка — очищаем
    const photo = data.photo !== undefined ? optionalPhoto(data.photo) : generation.photo;
    checkYearRange(yearFrom, yearTo);

    if (name !== generation.name) {
      const duplicate = await prisma.carGeneration.findFirst({
        where: { modelId: generation.modelId, name: { equals: name, mode: 'insensitive' }, id: { not: generation.id } },
      });
      if (duplicate) throw new AppError(`Поколение «${duplicate.name}» уже есть у этой модели`, 400);
    }
    return prisma.carGeneration.update({ where: { id: generation.id }, data: { name, yearFrom, yearTo, photo } });
  },

  async deleteGeneration(markId: string, modelExternalId: string, generationExternalId: string) {
    const generation = await getManualGeneration(markId, modelExternalId, generationExternalId);
    const inUse = await prisma.car.count({
      where: { brandId: markId, modelId: modelExternalId, generationId: generationExternalId },
    });
    if (inUse) throw new AppError(`Поколение используется в ${inUse} авто клиентов — удалить нельзя`, 400);
    await prisma.carGeneration.delete({ where: { id: generation.id } });
  },
};
