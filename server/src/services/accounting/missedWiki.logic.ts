/**
 * Упущенная прибыль за вики — чистый расчёт без базы.
 *
 * За заполнение вики сотрудник получает премию (настройки вики). Карточка вики автомобиля
 * (марка/модель/поколение) делится на разделы по видам работ, к разделу привязаны услуги
 * (Настройки → Упущенная прибыль). Сделка закрыта, в ней была услуга раздела, а главный
 * сотрудник записи (Record.serviceman) после закрытия ничего не внёс в этот раздел — это
 * упущенная премия. Услуги без раздела (полировка, оклейка) вики не требуют.
 * Если раздел к моменту закрытия уже был заполнен, заполнять нечего — не упущено.
 * Один раздел одного поколения в периоде считается один раз: премия за него одна.
 */

export interface WikiSectionRef {
  id: string;
  name: string;
}

export interface ClosedDealCar {
  recordId: string;
  closedAt: Date;
  serviceman: string;
  brandId: string;
  modelId: string;
  generationId: string | null;
  car: string;
  /** Разделы вики по услугам записи */
  sections: WikiSectionRef[];
}

export interface WikiSectionState {
  /** Когда в разделе появились текст или файлы */
  createdAt: Date;
  /** В разделе сейчас есть текст или файлы */
  filled: boolean;
  updatedByName: string | null;
  updatedAt: Date;
}

/** Правка или загруженный файл сотрудника в разделе карточки */
export interface WikiContribution {
  key: string;
  authorName: string;
  updatedAt: Date;
}

export interface MissedWikiItem {
  recordId: string;
  closedAt: Date;
  car: string;
  brandId: string;
  modelId: string;
  generationId: string;
  sectionId: string;
  sectionName: string;
}

export interface MissedWikiSummary {
  servicemanName: string;
  amount: number;
  items: MissedWikiItem[];
}

export const wikiKey = (c: { brandId: string; modelId: string; generationId: string }) =>
  `${c.brandId}/${c.modelId}/${c.generationId}`;

/** Ключ раздела карточки */
export const wikiSectionKey = (c: { brandId: string; modelId: string; generationId: string }, sectionId: string) =>
  `${wikiKey(c)}#${sectionId}`;

export function missedWiki(
  deals: ClosedDealCar[],
  sections: Map<string, WikiSectionState>,
  contributions: WikiContribution[],
  bonus: number,
  names: string[],
): MissedWikiSummary[] {
  const byName = new Map<string, MissedWikiItem[]>(names.map(n => [n, []]));
  const sorted = [...deals].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());

  for (const deal of sorted) {
    const items = byName.get(deal.serviceman);
    if (!items || !deal.generationId) continue;
    const car = { brandId: deal.brandId, modelId: deal.modelId, generationId: deal.generationId };

    for (const section of deal.sections) {
      const key = wikiSectionKey(car, section.id);
      if (items.some(i => wikiSectionKey(i, i.sectionId) === key)) continue;

      const state = sections.get(key);
      // Раздел уже был заполнен до закрытия сделки — заполнять было нечего
      if (state && state.filled && state.createdAt < deal.closedAt) continue;

      const contributed = contributions.some(c =>
        c.key === key && c.authorName === deal.serviceman && c.updatedAt >= deal.closedAt,
      ) || (!!state && state.updatedByName === deal.serviceman && state.updatedAt >= deal.closedAt);
      if (contributed) continue;

      items.push({
        recordId: deal.recordId,
        closedAt: deal.closedAt,
        car: deal.car,
        ...car,
        sectionId: section.id,
        sectionName: section.name,
      });
    }
  }

  return names.map(name => {
    const items = byName.get(name) ?? [];
    return { servicemanName: name, amount: bonus > 0 ? items.length * bonus : 0, items };
  });
}
