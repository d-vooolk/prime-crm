import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { birthdayInfo, buildServicemanPayload, formatThousands, servicemanToFormValues } from './servicesPage.utils';
import type { Serviceman } from '@/types';

describe('birthdayInfo', () => {
  it('нет даты — null', () => {
    expect(birthdayInfo(null)).toBeNull();
    expect(birthdayInfo(undefined)).toBeNull();
  });

  it('сегодня — по дню и месяцу, год не важен', () => {
    const today = dayjs('2026-10-04T12:00:00');
    expect(birthdayInfo('1990-10-04T00:00:00', today)).toEqual({ text: '04.10.1990', isToday: true });
    expect(birthdayInfo('1990-10-05T00:00:00', today)?.isToday).toBe(false);
  });
});

describe('formatThousands', () => {
  it('разбивает на тысячи пробелами', () => {
    expect(formatThousands(1234567)).toBe('1 234 567');
    expect(formatThousands(999)).toBe('999');
    expect(formatThousands(undefined)).toBe('');
  });
});

describe('buildServicemanPayload', () => {
  it('пустой пароль не отправляется', () => {
    expect(buildServicemanPayload({ name: 'Иван', password: '' }).password).toBeUndefined();
  });

  it('заполненный пароль отправляется', () => {
    expect(buildServicemanPayload({ name: 'Иван', password: 'secret' }).password).toBe('secret');
  });

  it('значения по умолчанию', () => {
    const p = buildServicemanPayload({ name: 'Иван', role: '' });
    expect(p).toMatchObject({
      role: undefined, isReceptionist: false, isPerformer: false, birthday: null, profitPercent: 0, baseSalary: 0,
    });
  });
});

describe('servicemanToFormValues', () => {
  it('пароль при редактировании всегда пустой', () => {
    const row = { id: '1', name: 'Иван', isDismissed: false, isReceptionist: true, isDefault: false, profitPercent: 10 } as Serviceman;
    const v = servicemanToFormValues(row);
    expect(v.password).toBe('');
    expect(v.isPerformer).toBe(false);
    expect(v.birthday).toBeNull();
  });
});
