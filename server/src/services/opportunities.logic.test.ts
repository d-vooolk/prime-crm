import { describe, expect, it } from 'vitest';
import { findOpportunities, PastVisit, VisitItem } from './opportunities.logic';

const BILED: VisitItem = { serviceId: 'biled', name: 'Установка Bi-Led модулей', amount: 1100 };
const DRL: VisitItem = { serviceId: 'drl', name: 'Ремонт ДХО', amount: 300 };
const POLISH: VisitItem = { serviceId: 'polish', name: 'Полировка фар', amount: 150 };
const WASH: VisitItem = { serviceId: 'wash', name: 'Мойка фар', amount: 20 };

const visit = (items: VisitItem[], over: Partial<PastVisit> = {}): PastVisit => ({
  recordId: 'r', carId: 'other', sameGeneration: true, items, ...over,
});

describe('findOpportunities', () => {
  it('пример из задачи: к ремонту ДХО — полировка фар, а не Bi-Led модули', () => {
    const result = findOpportunities({ carId: 'car', items: [DRL] }, [visit([BILED, DRL, POLISH])]);
    expect(result.map(o => o.serviceId)).toEqual(['polish']);
    expect(result[0]).toMatchObject({ price: 150, count: 1, togetherWith: ['Установка Bi-Led модулей'] });
  });

  it('не предлагает уже записанное и сделанное этому же авто', () => {
    const result = findOpportunities(
      { carId: 'car', items: [DRL] },
      [visit([BILED, DRL, POLISH, WASH]), visit([DRL, WASH], { carId: 'car' })],
    );
    expect(result.map(o => o.serviceId)).toEqual(['polish']);
  });

  it('не предлагает работу дороже всей записи', () => {
    const cheap: VisitItem = { serviceId: 'drl', name: 'Ремонт ДХО', amount: 100 };
    const result = findOpportunities({ carId: 'car', items: [cheap] }, [visit([BILED, DRL, POLISH])]);
    expect(result).toEqual([]);
  });

  it('визиты с той же работой и того же поколения важнее', () => {
    const glass: VisitItem = { serviceId: 'glass', name: 'Замена стекла фары', amount: 120 };
    const result = findOpportunities({ carId: 'car', items: [DRL] }, [
      visit([BILED, glass]),
      visit([BILED, DRL, POLISH], { sameGeneration: false }),
    ]);
    expect(result.map(o => o.serviceId)).toEqual(['polish', 'glass']);
  });

  it('исключённые в настройках услуги не предлагаются', () => {
    const result = findOpportunities({ carId: 'car', items: [DRL] }, [visit([BILED, DRL, POLISH, WASH])], new Set(['polish']));
    expect(result.map(o => o.serviceId)).toEqual(['wash']);
  });

  it('визиты из одной работы ничего не дают', () => {
    expect(findOpportunities({ carId: 'car', items: [DRL] }, [visit([POLISH])])).toEqual([]);
  });
});
