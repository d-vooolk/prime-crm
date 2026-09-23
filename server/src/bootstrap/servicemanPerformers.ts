import { prisma } from '../prisma/client';

/**
 * Заполнение свитча «Выполняет работы» у существующих сотрудников.
 *
 * Раньше в список исполнителей работ попадала только роль «Сотрудник», теперь
 * это отдельный флаг Serviceman.isPerformer. У старых записей он пустой (null):
 * включаем его «Сотрудникам», остальным выключаем — как было до флага.
 *
 * Идемпотентно: трогает только записи с пустым флагом, ручные изменения не перетирает.
 */
export async function backfillServicemanPerformers() {
  try {
    const on = await prisma.serviceman.updateMany({
      where: { isPerformer: null, role: 'Сотрудник' },
      data: { isPerformer: true },
    });
    const off = await prisma.serviceman.updateMany({
      where: { isPerformer: null },
      data: { isPerformer: false },
    });
    if (on.count + off.count > 0) {
      console.log(`[performers] исполнителей работ: ${on.count}, остальных: ${off.count}`); // eslint-disable-line no-console
    }
  } catch (e) {
    console.log(`[performers] ошибка: ${(e as Error).message}`); // eslint-disable-line no-console
  }
}
