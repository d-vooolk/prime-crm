import { prisma } from '../../prisma/client';
import { salaryPeriod } from './salaryCalc';
import { salaryService } from './salary.service';
import { missedWiki, wikiKey, WikiEntryState } from './missedWiki.logic';

/** Сотрудники дашборда: не уволены, выполняют работы и не скрыты в настройках */
async function dashboardEmployees() {
  return prisma.serviceman.findMany({
    where: { isDismissed: false, isPerformer: true, showInDashboard: true },
    select: { id: true, name: true, position: true, photoUrl: true },
    orderBy: { name: 'asc' },
  });
}

export interface Leader {
  name: string;
  position: string | null;
  place: number;
  recordCount: number;
  /** Заработок за период; null — запрашивающему чужие деньги не показываем */
  earnings: number | null;
}

/** Пьедестал и упущенная прибыль за вики — для вкладки «Сотрудники» дашборда */
export const employeesBoardService = {
  /** Тройка лидеров расчётного периода по заработку */
  async leaders(year: number, month: number, withEarnings: boolean): Promise<Leader[]> {
    const employees = await dashboardEmployees();
    const rows = await Promise.all(employees.map(async e => {
      const salary = await salaryService.getSalaryData(e.name, year, month);
      return { e, earnings: salary.adjustedTotal, recordCount: salary.records.length };
    }));
    return rows
      .filter(r => r.earnings > 0 || r.recordCount > 0)
      .sort((a, b) => b.earnings - a.earnings || b.recordCount - a.recordCount)
      .slice(0, 3)
      .map((r, i) => ({
        name: r.e.name,
        position: r.e.position,
        place: i + 1,
        recordCount: r.recordCount,
        earnings: withEarnings ? r.earnings : null,
      }));
  },

  /**
   * Упущенная премия за вики в расчётном периоде (с 25-го по 24-е). onlyName — только этот
   * сотрудник (сотрудник видит своё).
   */
  async missedWiki(year: number, month: number, onlyName?: string) {
    const period = salaryPeriod(year, month);
    const employees = (await dashboardEmployees()).filter(e => !onlyName || e.name === onlyName);
    const names = employees.map(e => e.name);
    if (names.length === 0) return { bonus: 0, employees: [] };

    const settings = await prisma.wikiSettings.findFirst();
    const bonus = settings?.bonusAmount ?? 0;

    // Период по дате закрытия — как в зарплате: перенесённая дата зарплаты важнее
    const records = await prisma.record.findMany({
      where: {
        status: 'CLOSED',
        serviceman: { in: names },
        deal: {
          OR: [
            { salaryDate: { gte: period.from, lt: period.to } },
            { salaryDate: null, closedAt: { gte: period.from, lt: period.to } },
          ],
        },
      },
      select: {
        id: true,
        serviceman: true,
        deal: { select: { closedAt: true } },
        car: { select: { brand: true, brandId: true, model: true, modelId: true, generationId: true, generationName: true } },
      },
    });

    const deals = records.filter(r => r.deal && r.serviceman).map(r => ({
      recordId: r.id,
      closedAt: r.deal!.closedAt,
      serviceman: r.serviceman!,
      brandId: r.car.brandId,
      modelId: r.car.modelId,
      generationId: r.car.generationId,
      car: [r.car.brand, r.car.model, r.car.generationName].filter(Boolean).join(' '),
    }));
    const keys = deals.filter(d => d.generationId).map(d => ({ markId: d.brandId, modelId: d.modelId, generationId: d.generationId! }));

    const entries = keys.length
      ? await prisma.wikiEntry.findMany({
        where: { OR: keys },
        select: {
          id: true, markId: true, modelId: true, generationId: true, content: true,
          createdAt: true, updatedAt: true, updatedByName: true,
          _count: { select: { media: true } },
          revisions: { where: { authorName: { in: names } }, select: { authorName: true, createdAt: true, updatedAt: true } },
        },
      })
      : [];

    const entryMap = new Map<string, WikiEntryState>();
    const contributions = [];
    for (const e of entries) {
      const key = wikiKey({ brandId: e.markId, modelId: e.modelId, generationId: e.generationId });
      entryMap.set(key, {
        createdAt: e.createdAt,
        filled: !!e.content.trim() || e._count.media > 0,
        updatedByName: e.updatedByName,
        updatedAt: e.updatedAt,
      });
      for (const r of e.revisions) contributions.push({ key, ...r });
    }

    return { bonus, employees: missedWiki(deals, entryMap, contributions, bonus, names) };
  },
};
