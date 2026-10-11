import { describe, expect, it } from 'vitest';
import { ClosedDealCar, missedWiki, WikiEntryState } from './missedWiki.logic';

const d = (day: number) => new Date(2026, 9, day, 12);

const deal = (over: Partial<ClosedDealCar> = {}): ClosedDealCar => ({
  recordId: 'r1',
  closedAt: d(5),
  serviceman: 'Иван',
  brandId: 'BMW',
  modelId: '5',
  generationId: 'G30',
  car: 'BMW 5 G30',
  ...over,
});

const entry = (over: Partial<WikiEntryState> = {}): WikiEntryState => ({
  createdAt: d(1),
  filled: true,
  updatedByName: null,
  updatedAt: d(1),
  ...over,
});

describe('missedWiki', () => {
  it('нет карточки и сотрудник ничего не внёс — упущенная премия', () => {
    const [ivan] = missedWiki([deal()], new Map(), [], 10, ['Иван']);
    expect(ivan.amount).toBe(10);
    expect(ivan.items).toHaveLength(1);
  });

  it('карточка была заполнена до закрытия — не упущено', () => {
    const [ivan] = missedWiki([deal()], new Map([['BMW/5/G30', entry()]]), [], 10, ['Иван']);
    expect(ivan.amount).toBe(0);
  });

  it('карточка появилась после закрытия от другого — упущено', () => {
    const entries = new Map([['BMW/5/G30', entry({ createdAt: d(7), updatedByName: 'Пётр', updatedAt: d(7) })]]);
    expect(missedWiki([deal()], entries, [], 10, ['Иван'])[0].amount).toBe(10);
  });

  it('сотрудник внёс правку после закрытия — не упущено', () => {
    const contributions = [{ key: 'BMW/5/G30', authorName: 'Иван', createdAt: d(6), updatedAt: d(6) }];
    expect(missedWiki([deal()], new Map(), contributions, 10, ['Иван'])[0].amount).toBe(0);
  });

  it('правка до закрытия сделки не считается', () => {
    const contributions = [{ key: 'BMW/5/G30', authorName: 'Иван', createdAt: d(2), updatedAt: d(2) }];
    const entries = new Map([['BMW/5/G30', entry({ filled: false })]]);
    expect(missedWiki([deal()], entries, contributions, 10, ['Иван'])[0].amount).toBe(10);
  });

  it('без поколения вики нет — не считаем; одно поколение — одна премия', () => {
    const deals = [deal({ generationId: null }), deal({ recordId: 'r2' }), deal({ recordId: 'r3', closedAt: d(9) })];
    const [ivan] = missedWiki(deals, new Map(), [], 10, ['Иван']);
    expect(ivan.items.map(i => i.recordId)).toEqual(['r2']);
  });

  it('чужие записи и сотрудники вне списка не попадают', () => {
    const result = missedWiki([deal({ serviceman: 'Скрытый' })], new Map(), [], 10, ['Иван']);
    expect(result).toEqual([{ servicemanName: 'Иван', amount: 0, items: [] }]);
  });
});
