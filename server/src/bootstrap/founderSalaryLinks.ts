import { prisma } from '../prisma/client';
import { FOUNDER_SALARY_PREFIX } from '../services/accounting.service';

/**
 * Привязка старых записей ЗП учредителей к расходам в кассе.
 *
 * Раньше клиент создавал расход и ЗП учредителя двумя независимыми запросами,
 * и связи между ними не было: правка или удаление расхода не доходили до таблицы
 * учредителей. Теперь связь хранится в FounderSalary.cashTransactionId, а старые
 * записи сопоставляются здесь: ЗП создавалась сразу после расхода, поэтому ищем
 * расход «ЗП учредителя <ФИО>», созданный за несколько секунд до неё.
 *
 * Идемпотентно: трогает только записи без привязки, повторный запуск ничего не меняет.
 */

const MAX_GAP_MS = 30_000;

function log(msg: string) {
  console.log(`[founder-salary] ${msg}`); // eslint-disable-line no-console
}

export async function linkFounderSalariesToCash() {
  try {
    const unlinked = await prisma.founderSalary.findMany({
      where: { cashTransactionId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (unlinked.length === 0) return;

    const candidates = await prisma.cashTransaction.findMany({
      where: { type: 'EXPENSE', founderSalary: null, description: { startsWith: `${FOUNDER_SALARY_PREFIX} ` } },
      select: { id: true, description: true, createdAt: true },
    });
    const used = new Set<string>();
    let linked = 0;

    for (const fs of unlinked) {
      const created = fs.createdAt.getTime();
      const match = candidates
        .filter(c => !used.has(c.id) && c.description === `${FOUNDER_SALARY_PREFIX} ${fs.person}`)
        .map(c => ({ id: c.id, gap: created - c.createdAt.getTime() }))
        .filter(c => c.gap >= 0 && c.gap <= MAX_GAP_MS)
        .sort((a, b) => a.gap - b.gap)[0];
      if (!match) continue;

      used.add(match.id);
      await prisma.founderSalary.update({ where: { id: fs.id }, data: { cashTransactionId: match.id } });
      linked++;
    }

    log(`привязано к расходам: ${linked}, без пары осталось: ${unlinked.length - linked}`);
  } catch (e) {
    log(`ошибка привязки: ${(e as Error).message}`);
  }
}
