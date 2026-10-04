import { describe, expect, it } from 'vitest';
import type { ActMemoBlock, Category, CompanySettings, Record } from '@/types';
import { actMemoForRecord, guessMemoTargets, memoBlocksFromText } from './actMemo';

// Запись с нужными услугами: остальные поля для расчёта памятки не нужны
const recordWith = (services: Array<{ id: string; name: string; categoryId?: string }>): Record => ({
  items: services.map(s => ({ serviceId: s.id, service: { name: s.name, categoryId: s.categoryId ?? 'c1' } })),
} as unknown as Record);

const settings = (blocks: ActMemoBlock[] | null, actMemo?: string | null) =>
  ({ actMemoBlocks: blocks, actMemo } as CompanySettings);

describe('memoBlocksFromText', () => {
  it('делит текст на блоки по строкам-заголовкам с двоеточием', () => {
    const blocks = memoBlocksFromText('Фары:\n- пункт 1\n- пункт 2\n\nПлёнка:\n- не мыть 3 дня');
    expect(blocks.map(b => b.title)).toEqual(['Фары', 'Плёнка']);
    expect(blocks[0].text).toBe('- пункт 1\n- пункт 2');
    expect(blocks[1].text).toBe('- не мыть 3 дня');
  });

  it('текст до первого заголовка — блок без заголовка', () => {
    const blocks = memoBlocksFromText('Общее правило\nФары:\n- пункт');
    expect(blocks[0]).toMatchObject({ title: '', text: 'Общее правило' });
    expect(blocks[1].title).toBe('Фары');
  });

  it('пункт списка с двоеточием на конце — не заголовок', () => {
    const blocks = memoBlocksFromText('Фары:\n- важно:');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('- важно:');
  });
});

describe('guessMemoTargets', () => {
  const categories = [{
    id: 'c1', name: 'Оптика',
    services: [{ id: 's1', name: 'Разборка фары' }, { id: 's2', name: 'Полировка' }],
  }] as unknown as Category[];

  it('подбирает услуги по заголовку блока', () => {
    expect(guessMemoTargets('Фары', categories)).toEqual(['svc:s1']);
  });

  it('незнакомый заголовок — без услуг', () => {
    expect(guessMemoTargets('Прочее', categories)).toEqual([]);
  });
});

describe('actMemoForRecord', () => {
  const block = (patch: Partial<ActMemoBlock>): ActMemoBlock => ({ id: 'b', title: 'T', text: 'текст', targets: [], ...patch });

  it('блок без условий печатается всегда', () => {
    const memo = actMemoForRecord(recordWith([{ id: 's1', name: 'Мойка' }]), settings([block({ title: 'Общее' })]));
    expect(memo).toBe('Общее:\nтекст');
  });

  it('блок по услуге — только если услуга есть в записи', () => {
    const s = settings([block({ title: 'Фары', targets: ['svc:s1'] })]);
    expect(actMemoForRecord(recordWith([{ id: 's1', name: 'Разборка' }]), s)).toBe('Фары:\nтекст');
    expect(actMemoForRecord(recordWith([{ id: 's2', name: 'Мойка' }]), s)).toBe('');
  });

  it('блок по категории срабатывает на любую услугу категории', () => {
    const s = settings([block({ targets: ['cat:c9'] })]);
    expect(actMemoForRecord(recordWith([{ id: 's5', name: 'X', categoryId: 'c9' }]), s)).toBe('T:\nтекст');
  });

  it('одинаковый текст у разных блоков печатается один раз', () => {
    const s = settings([block({ id: '1' }), block({ id: '2', title: 'Другой' })]);
    expect(actMemoForRecord(recordWith([]), s)).toBe('T:\nтекст');
  });

  it('без заголовка подставляет названия услуг записи', () => {
    const s = settings([block({ title: '', targets: ['svc:s1'] })]);
    expect(actMemoForRecord(recordWith([{ id: 's1', name: 'Оклейка' }]), s)).toBe('Оклейка:\nтекст');
  });

  it('без настроенных блоков текст по умолчанию фильтруется автоподбором', () => {
    const headlights = actMemoForRecord(recordWith([{ id: 's1', name: 'Разборка фары' }]), settings(null));
    expect(headlights).toContain('Фары');
    expect(headlights).not.toContain('Оклейка плёнкой');

    expect(actMemoForRecord(recordWith([{ id: 's2', name: 'Мойка' }]), settings(null))).toBe('');
  });
});
