import { describe, expect, it } from 'vitest';
import { ClosedDealCar, missedWiki, WikiSectionState } from './missedWiki.logic';

const d = (day: number) => new Date(2026, 9, day, 12);

const BILED = { id: 'biled', name: 'Bi-Led модули' };
const DRL = { id: 'drl', name: 'Ремонт ДХО' };

const deal = (over: Partial<ClosedDealCar> = {}): ClosedDealCar => ({
  recordId: 'r1',
  closedAt: d(5),
  serviceman: 'Иван',
  brandId: 'BMW',
  modelId: '5',
  generationId: 'G30',
  car: 'BMW 5 G30',
  sections: [BILED],
  ...over,
});

const state = (over: Partial<WikiSectionState> = {}): WikiSectionState => ({
  createdAt: d(1),
  filled: true,
  updatedByName: null,
  updatedAt: d(1),
  ...over,
});

describe('missedWiki', () => {
  it('раздел пуст и сотрудник ничего не внёс — упущенная премия', () => {
    const [ivan] = missedWiki([deal()], new Map(), [], 10, ['Иван']);
    expect(ivan.amount).toBe(10);
    expect(ivan.items).toMatchObject([{ sectionId: 'biled', sectionName: 'Bi-Led модули' }]);
  });

  it('услуги без раздела (полировка, оклейка) — заполнять нечего', () => {
    const [ivan] = missedWiki([deal({ sections: [] })], new Map(), [], 10, ['Иван']);
    expect(ivan.amount).toBe(0);
  });

  it('раздел был заполнен до закрытия — не упущено', () => {
    const [ivan] = missedWiki([deal()], new Map([['BMW/5/G30#biled', state()]]), [], 10, ['Иван']);
    expect(ivan.amount).toBe(0);
  });

  it('заполнен один раздел, а работы были по двум — упущен только пустой', () => {
    const sections = new Map([['BMW/5/G30#biled', state()]]);
    const [ivan] = missedWiki([deal({ sections: [BILED, DRL] })], sections, [], 10, ['Иван']);
    expect(ivan.items.map(i => i.sectionId)).toEqual(['drl']);
    expect(ivan.amount).toBe(10);
  });

  it('раздел появился после закрытия от другого — упущено', () => {
    const sections = new Map([['BMW/5/G30#biled', state({ createdAt: d(7), updatedByName: 'Пётр', updatedAt: d(7) })]]);
    expect(missedWiki([deal()], sections, [], 10, ['Иван'])[0].amount).toBe(10);
  });

  it('сотрудник внёс правку в раздел после закрытия — не упущено', () => {
    const contributions = [{ key: 'BMW/5/G30#biled', authorName: 'Иван', updatedAt: d(6) }];
    expect(missedWiki([deal()], new Map(), contributions, 10, ['Иван'])[0].amount).toBe(0);
  });

  it('правка в другом разделе не считается', () => {
    const contributions = [{ key: 'BMW/5/G30#drl', authorName: 'Иван', updatedAt: d(6) }];
    expect(missedWiki([deal()], new Map(), contributions, 10, ['Иван'])[0].amount).toBe(10);
  });

  it('правка до закрытия сделки не считается', () => {
    const contributions = [{ key: 'BMW/5/G30#biled', authorName: 'Иван', updatedAt: d(2) }];
    const sections = new Map([['BMW/5/G30#biled', state({ filled: false })]]);
    expect(missedWiki([deal()], sections, contributions, 10, ['Иван'])[0].amount).toBe(10);
  });

  it('без поколения вики нет — не считаем; один раздел поколения — одна премия', () => {
    const deals = [deal({ generationId: null }), deal({ recordId: 'r2' }), deal({ recordId: 'r3', closedAt: d(9) })];
    const [ivan] = missedWiki(deals, new Map(), [], 10, ['Иван']);
    expect(ivan.items.map(i => i.recordId)).toEqual(['r2']);
  });

  it('чужие записи и сотрудники вне списка не попадают', () => {
    const result = missedWiki([deal({ serviceman: 'Скрытый' })], new Map(), [], 10, ['Иван']);
    expect(result).toEqual([{ servicemanName: 'Иван', amount: 0, items: [] }]);
  });
});
