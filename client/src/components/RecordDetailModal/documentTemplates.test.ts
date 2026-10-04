import { describe, expect, it } from 'vitest';
import type { DocumentTemplate, Record, RecordItem } from '@/types';
import {
  actTemplatesOf, defaultActTemplate, pickActTemplate, pickWorkOrderTemplate, prepaidByMethod, recordCategoryIds,
} from './documentTemplates';

const tpl = (id: string, patch: Partial<DocumentTemplate> = {}): DocumentTemplate =>
  ({ id, name: id, type: 'completion_act', content: id, isDefault: false, categoryId: null, ...patch } as DocumentTemplate);

const rec = (...items: Array<Partial<RecordItem> & { categoryId?: string }>): Pick<Record, 'items'> => ({
  items: items.map(({ categoryId, ...i }, idx) => ({
    id: `i${idx}`, serviceId: `s${idx}`, price: 0, quantity: 1, ...i,
    service: { categoryId } as RecordItem['service'],
  })) as RecordItem[],
});

describe('recordCategoryIds', () => {
  it('без повторов и пустых', () => {
    expect(recordCategoryIds(rec({ categoryId: 'a' }, { categoryId: 'b' }, { categoryId: 'a' }, {}))).toEqual(['a', 'b']);
  });
});

describe('pickWorkOrderTemplate', () => {
  const templates = [
    tpl('act', { type: 'completion_act', categoryId: 'a' }),
    tpl('any', { type: 'work_order' }),
    tpl('def', { type: 'work_order', isDefault: true }),
    tpl('catA', { type: 'work_order', categoryId: 'a' }),
  ];

  it('сначала шаблон категории первой услуги', () => {
    expect(pickWorkOrderTemplate(rec({ categoryId: 'a' }), templates)?.id).toBe('catA');
  });

  it('иначе общий по умолчанию, иначе любой заявки', () => {
    expect(pickWorkOrderTemplate(rec({ categoryId: 'z' }), templates)?.id).toBe('def');
    expect(pickWorkOrderTemplate(rec({ categoryId: 'z' }), templates.filter(t => t.id !== 'def'))?.id).toBe('any');
  });
});

describe('акты', () => {
  const acts = [
    tpl('first'),
    tpl('catDefault', { categoryId: 'b', isDefault: true }),
    tpl('general', { isDefault: true }),
    tpl('catA', { categoryId: 'a' }),
  ];

  it('actTemplatesOf оставляет только акты', () => {
    expect(actTemplatesOf([...acts, tpl('wo', { type: 'work_order' })])).toHaveLength(4);
  });

  it('по умолчанию — общий, затем любой по умолчанию, затем первый', () => {
    expect(defaultActTemplate(acts)?.id).toBe('general');
    expect(defaultActTemplate(acts.filter(t => t.id !== 'general'))?.id).toBe('catDefault');
    expect(defaultActTemplate([tpl('x'), tpl('y')])?.id).toBe('x');
    expect(defaultActTemplate([])).toBeUndefined();
  });

  it('для записи — шаблон категории, иначе по умолчанию', () => {
    expect(pickActTemplate(rec({ categoryId: 'a' }), acts)?.id).toBe('catA');
    expect(pickActTemplate(rec({ categoryId: 'z' }), acts)?.id).toBe('general');
    expect(pickActTemplate(rec({}), acts)?.id).toBe('general');
  });
});

describe('prepaidByMethod', () => {
  it('раздельно наличные и РС', () => {
    expect(prepaidByMethod(rec(
      { prepaidAmount: 30 },
      { prepaidAmount: 20, prepaidByCard: true },
      { prepaidAmount: 5, prepaidByCard: false },
      {},
    ))).toEqual({ cash: 35, card: 20 });
  });
});
