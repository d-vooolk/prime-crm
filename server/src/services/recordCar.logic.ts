import { Prisma } from '@prisma/client';

/**
 * Что обновить у уже существующей машины клиента. Пустые номер и пробег не затирают
 * сохранённые (кроме правки той же машины — там пустое поле очищает значение).
 * Выбранное поколение записывается всегда: иначе машина, заведённая без поколения
 * (импорт, старые записи), так и останется без него и без фото.
 */
export function existingCarUpdate(
  car: { generation?: string; generationId?: string; generationName?: string; plateNumber?: string; mileage?: string },
  opts: { clearEmpty?: boolean } = {},
): Prisma.CarUpdateInput {
  const data: Prisma.CarUpdateInput = {};
  if (opts.clearEmpty) {
    if (car.plateNumber !== undefined) data.plateNumber = car.plateNumber || null;
    if (car.mileage !== undefined) data.mileage = car.mileage || null;
  } else {
    if (car.plateNumber) data.plateNumber = car.plateNumber;
    if (car.mileage) data.mileage = car.mileage;
  }
  if (car.generationId != null && car.generationId !== '') {
    data.generationId = String(car.generationId);
    data.generation = car.generation ?? null;
    data.generationName = car.generationName ?? null;
  }
  return data;
}
