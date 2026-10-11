/**
 * Упущенная прибыль за вики — чистый расчёт без базы.
 *
 * За заполнение вики сотрудник получает премию (настройки вики). Сделка закрыта, главный
 * сотрудник записи (Record.serviceman) после закрытия ничего не внёс в карточку вики этого
 * автомобиля (марка/модель/поколение) — это упущенная премия. Если карточка в вики к моменту
 * закрытия уже была заполнена, заполнять нечего — не упущено.
 * Одно поколение в периоде считается один раз: премия за одну карточку одна.
 */

export interface ClosedDealCar {
  recordId: string;
  closedAt: Date;
  serviceman: string;
  brandId: string;
  modelId: string;
  generationId: string | null;
  car: string;
}

export interface WikiEntryState {
  createdAt: Date;
  /** В карточке сейчас есть текст или файлы */
  filled: boolean;
  updatedByName: string | null;
  updatedAt: Date;
}

export interface WikiContribution {
  key: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MissedWikiItem {
  recordId: string;
  closedAt: Date;
  car: string;
  brandId: string;
  modelId: string;
  generationId: string;
}

export interface MissedWikiSummary {
  servicemanName: string;
  amount: number;
  items: MissedWikiItem[];
}

export const wikiKey = (c: { brandId: string; modelId: string; generationId: string }) =>
  `${c.brandId}/${c.modelId}/${c.generationId}`;

export function missedWiki(
  deals: ClosedDealCar[],
  entries: Map<string, WikiEntryState>,
  contributions: WikiContribution[],
  bonus: number,
  names: string[],
): MissedWikiSummary[] {
  const byName = new Map<string, MissedWikiItem[]>(names.map(n => [n, []]));
  const sorted = [...deals].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());

  for (const deal of sorted) {
    const items = byName.get(deal.serviceman);
    if (!items || !deal.generationId) continue;
    const key = wikiKey({ brandId: deal.brandId, modelId: deal.modelId, generationId: deal.generationId });
    if (items.some(i => wikiKey(i) === key)) continue;

    const entry = entries.get(key);
    // Карточка уже была заполнена до закрытия сделки — заполнять было нечего
    if (entry && entry.filled && entry.createdAt < deal.closedAt) continue;

    const contributed = contributions.some(c =>
      c.key === key && c.authorName === deal.serviceman && c.updatedAt >= deal.closedAt,
    ) || (!!entry && entry.updatedByName === deal.serviceman && entry.updatedAt >= deal.closedAt);
    if (contributed) continue;

    items.push({
      recordId: deal.recordId,
      closedAt: deal.closedAt,
      car: deal.car,
      brandId: deal.brandId,
      modelId: deal.modelId,
      generationId: deal.generationId,
    });
  }

  return names.map(name => {
    const items = byName.get(name) ?? [];
    return { servicemanName: name, amount: bonus > 0 ? items.length * bonus : 0, items };
  });
}
