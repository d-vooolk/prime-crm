import { prisma } from '../../prisma/client';
import { salaryMonthFor, salaryPeriod } from './salaryCalc';
import { salaryService } from './salary.service';
import { missedWiki, wikiSectionKey, WikiContribution, WikiSectionState } from './missedWiki.logic';

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

    // Период по дате закрытия — как в зарплате: перенос доли главного сотрудника важнее
    const found = await prisma.record.findMany({
      where: {
        status: 'CLOSED',
        serviceman: { in: names },
        // Только записи с работами, после которых есть что заполнить в вики
        items: { some: { service: { wikiSectionId: { not: null } } } },
        // Кандидаты: закрыты в периоде или перенесены в него кому-то; точно — по переносу главного ниже
        deal: {
          OR: [
            { closedAt: { gte: period.from, lt: period.to } },
            { salaryTransfers: { some: { year, month } } },
          ],
        },
      },
      select: {
        id: true,
        serviceman: true,
        deal: { select: { closedAt: true, salaryTransfers: { select: { servicemanName: true, year: true, month: true } } } },
        car: { select: { brand: true, brandId: true, model: true, modelId: true, generationId: true, generationName: true } },
        items: { select: { service: { select: { wikiSection: { select: { id: true, name: true, sortOrder: true } } } } } },
      },
    });

    const records = found.flatMap(({ deal, serviceman, ...r }) => {
      if (!deal || !serviceman) return [];
      const m = salaryMonthFor(deal, serviceman);
      return m.year === year && m.month === month ? [{ ...r, deal, serviceman }] : [];
    });

    const deals = records.map(r => {
      // Разделы вики по услугам записи, без повторов, в порядке настроек
      const sections = new Map<string, { id: string; name: string; sortOrder: number }>();
      for (const item of r.items) {
        const section = item.service.wikiSection;
        if (section) sections.set(section.id, section);
      }
      return {
        recordId: r.id,
        closedAt: r.deal.closedAt,
        serviceman: r.serviceman,
        brandId: r.car.brandId,
        modelId: r.car.modelId,
        generationId: r.car.generationId,
        car: [r.car.brand, r.car.model, r.car.generationName].filter(Boolean).join(' '),
        sections: [...sections.values()]
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .map(({ id, name }) => ({ id, name })),
      };
    });
    const keys = deals
      .filter(d => d.generationId && d.sections.length > 0)
      .map(d => ({ markId: d.brandId, modelId: d.modelId, generationId: d.generationId! }));

    const entries = keys.length
      ? await prisma.wikiEntry.findMany({
        where: { OR: keys },
        select: {
          markId: true, modelId: true, generationId: true,
          sections: { select: { sectionId: true, content: true, createdAt: true, updatedAt: true, updatedByName: true } },
          media: { where: { sectionId: { not: null } }, select: { sectionId: true, createdAt: true, uploadedByName: true } },
          revisions: {
            where: { authorName: { in: names }, sectionId: { not: null } },
            select: { sectionId: true, authorName: true, updatedAt: true },
          },
        },
      })
      : [];

    const sectionMap = new Map<string, WikiSectionState>();
    const contributions: WikiContribution[] = [];
    for (const e of entries) {
      const car = { brandId: e.markId, modelId: e.modelId, generationId: e.generationId };
      for (const s of e.sections) {
        const media = e.media.filter(m => m.sectionId === s.sectionId);
        const filledAt = [
          ...(s.content.trim() ? [s.createdAt] : []),
          ...media.map(m => m.createdAt),
        ];
        sectionMap.set(wikiSectionKey(car, s.sectionId), {
          createdAt: filledAt.length ? new Date(Math.min(...filledAt.map(t => t.getTime()))) : s.createdAt,
          filled: filledAt.length > 0,
          updatedByName: s.updatedByName,
          updatedAt: s.updatedAt,
        });
      }
      // Файлы без строки текста раздела — раздел заполнен только фото и видео
      for (const m of e.media) {
        const key = wikiSectionKey(car, m.sectionId!);
        const existing = sectionMap.get(key);
        if (!existing) {
          sectionMap.set(key, { createdAt: m.createdAt, filled: true, updatedByName: null, updatedAt: m.createdAt });
        }
        if (m.uploadedByName) contributions.push({ key, authorName: m.uploadedByName, updatedAt: m.createdAt });
      }
      for (const r of e.revisions) {
        contributions.push({ key: wikiSectionKey(car, r.sectionId!), authorName: r.authorName, updatedAt: r.updatedAt });
      }
    }

    return { bonus, employees: missedWiki(deals, sectionMap, contributions, bonus, names) };
  },
};
