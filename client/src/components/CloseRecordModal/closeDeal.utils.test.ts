import { describe, expect, it } from 'vitest';
import type { Record, RecordItem } from '@/types';
import {
  ItemRow, buildItemRows, itemsMissingServiceman, paymentTotals, splitPayment, validateSplit,
} from './closeDeal.utils';

type ItemPatch = Omit<Partial<RecordItem>, 'service'> & { service?: Partial<RecordItem['service']> };

const item = (patch: ItemPatch = {}): RecordItem => ({
  id: 'i1',
  serviceId: 's1',
  price: 100,
  quantity: 1,
  ...patch,
  service: {
    id: 's1', name: 'Услуга', categoryId: 'c1', standardPrice: 100, estimatedTime: 30, isActive: true,
    category: { id: 'c1', name: 'Фары', services: [] },
    ...patch.service,
  } as RecordItem['service'],
});

const record = (items: RecordItem[]): Pick<Record, 'items' | 'serviceman'> => ({ items, serviceman: 'Иван' });

const row = (patch: Partial<ItemRow> = {}): ItemRow => ({
  serviceId: 's1', itemId: 'i1', serviceName: 'Услуга', categoryName: '', price: 100, quantity: 1,
  estimatedTime: 0, netProfit: 100, servicemanName: 'Иван', hasEquipment: false, isProduct: false,
  split: null, prepaidAmount: 0, prepaidByCard: false, ...patch,
});

describe('buildItemRows', () => {
  it('по умолчанию ставит исполнителя записи и считает прибыль как сумму позиции', () => {
    const [r] = buildItemRows(record([item({ price: 50, quantity: 3 })]));
    expect(r.servicemanName).toBe('Иван');
    expect(r.netProfit).toBe(150);
    expect(r.categoryName).toBe('Фары');
  });

  it('вычитает розничную цену оборудования из прибыли', () => {
    const [r] = buildItemRows(record([item({
      price: 500,
      service: { hasEquipment: true },
      equipment: { id: 'e1', name: 'Модуль', retailPrice: 200 },
      equipmentId: 'e1',
    })]));
    expect(r.netProfit).toBe(300);
    expect(r.equipmentId).toBe('e1');
  });

  it('у товара нет прибыли и сотрудника', () => {
    const [r] = buildItemRows(record([item({ service: { isProduct: true }, servicemanName: 'Пётр' })]));
    expect(r.netProfit).toBe(0);
    expect(r.servicemanName).toBe('');
    expect(r.split).toBeNull();
  });

  it('сохраняет разделение и тогда оставляет сотрудника пустым', () => {
    const split = [{ name: 'А', amount: 50 }, { name: 'Б', amount: 50 }];
    const [r] = buildItemRows(record([item({ servicemanSplit: split, servicemanName: 'А' })]));
    expect(r.split).toEqual(split);
    expect(r.servicemanName).toBe('');
  });

  it('берёт сохранённого сотрудника позиции вместо исполнителя записи', () => {
    const [r] = buildItemRows(record([item({ servicemanName: 'Пётр' })]));
    expect(r.servicemanName).toBe('Пётр');
  });
});

describe('itemsMissingServiceman', () => {
  it('находит только услуги без сотрудника и без разделения', () => {
    const rows = [
      row({ itemId: 'a', servicemanName: '' }),
      row({ itemId: 'b', servicemanName: '', isProduct: true }),
      row({ itemId: 'c', servicemanName: '', split: [{ name: 'А', amount: 1 }, { name: 'Б', amount: 1 }] }),
      row({ itemId: 'd' }),
    ];
    expect(itemsMissingServiceman(rows).map(r => r.itemId)).toEqual(['a']);
  });
});

describe('paymentTotals', () => {
  it('раскладывает предоплату по способу и считает остаток', () => {
    const t = paymentTotals([
      row({ price: 100, quantity: 2, prepaidAmount: 50 }),
      row({ price: 300, prepaidAmount: 100, prepaidByCard: true }),
    ]);
    expect(t).toEqual({
      total: 500, prepaidCash: 50, prepaidCard: 100, totalPrepaid: 150, remaining: 350, rubleRemaining: 350,
    });
  });

  it('остаток не уходит в минус, а валюта может дать сдачу', () => {
    expect(paymentTotals([row({ price: 100, prepaidAmount: 150 })]).remaining).toBe(0);
    expect(paymentTotals([row({ price: 100 })], 120.555).rubleRemaining).toBe(-20.56);
  });
});

describe('splitPayment', () => {
  it('без разбивки или без рублёвого остатка ничего не отправляет', () => {
    expect(splitPayment(100, null)).toEqual({});
    expect(splitPayment(0, 50)).toEqual({});
  });

  it('наличные — остаток после безнала', () => {
    expect(splitPayment(100.5, 40.2)).toEqual({ splitCashAmount: 60.3, splitCardAmount: 40.2 });
  });
});

describe('validateSplit', () => {
  it('требует минимум двух сотрудников с именем', () => {
    expect(validateSplit([{ name: 'А', amount: 10 }, { name: '', amount: 5 }], 100)).toEqual({ ok: false, reason: 'tooFew' });
  });

  it('не даёт разделить больше чистой прибыли (с допуском в копейку)', () => {
    expect(validateSplit([{ name: 'А', amount: 60 }, { name: 'Б', amount: 41 }], 100))
      .toEqual({ ok: false, reason: 'exceeds', total: 101 });
    expect(validateSplit([{ name: 'А', amount: 60 }, { name: 'Б', amount: 40.005 }], 100).ok).toBe(true);
  });

  it('отбрасывает строки без имени', () => {
    const res = validateSplit([{ name: 'А', amount: 50 }, { name: '', amount: 0 }, { name: 'Б', amount: 50 }], 100);
    expect(res).toEqual({ ok: true, entries: [{ name: 'А', amount: 50 }, { name: 'Б', amount: 50 }] });
  });
});
