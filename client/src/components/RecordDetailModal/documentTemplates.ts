import type { DocumentTemplate, Record } from '@/types';

/** Категории услуг записи без повторов */
export function recordCategoryIds(record: Pick<Record, 'items'>): string[] {
  return [...new Set(record.items.map(i => i.service?.categoryId).filter((id): id is string => !!id))];
}

/** Шаблон заявки: по категории первой услуги, иначе общий по умолчанию, иначе любой */
export function pickWorkOrderTemplate(record: Pick<Record, 'items'>, templates: DocumentTemplate[]) {
  const categoryId = record.items[0]?.service?.categoryId;
  return templates.find(t => t.categoryId === categoryId && t.type === 'work_order')
    || templates.find(t => !t.categoryId && t.type === 'work_order' && t.isDefault)
    || templates.find(t => t.type === 'work_order');
}

export const actTemplatesOf = (templates: DocumentTemplate[]) => templates.filter(t => t.type === 'completion_act');

/** Акт по умолчанию: общий по умолчанию, иначе любой по умолчанию, иначе первый */
export function defaultActTemplate(actTemplates: DocumentTemplate[]) {
  return actTemplates.find(t => !t.categoryId && t.isDefault)
    ?? actTemplates.find(t => t.isDefault)
    ?? actTemplates[0];
}

/** Акт для записи: по категории первой услуги, иначе по умолчанию */
export function pickActTemplate(record: Pick<Record, 'items'>, actTemplates: DocumentTemplate[]) {
  const categoryId = recordCategoryIds(record)[0] ?? null;
  return (categoryId ? actTemplates.find(t => t.categoryId === categoryId) : null)
    ?? defaultActTemplate(actTemplates);
}

/** Предоплата по записи отдельно наличными и по РС */
export function prepaidByMethod(record: Pick<Record, 'items'>) {
  return {
    cash: record.items.reduce((s, i) => s + (!i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0),
    card: record.items.reduce((s, i) => s + (i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0),
  };
}
