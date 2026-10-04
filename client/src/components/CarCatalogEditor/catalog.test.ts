import { describe, expect, it } from 'vitest';
import { photoUrl, yearsLabel } from './catalog';

describe('yearsLabel', () => {
  it('без годов — null', () => {
    expect(yearsLabel({ year_from: null, year_to: null } as never)).toBeNull();
  });

  it('открытый диапазон', () => {
    expect(yearsLabel({ year_from: 2018, year_to: null } as never)).toBe('2018–н.в.');
    expect(yearsLabel({ year_from: null, year_to: 2010 } as never)).toBe('...–2010');
  });

  it('полный диапазон', () => {
    expect(yearsLabel({ year_from: 2010, year_to: 2015 } as never)).toBe('2010–2015');
  });
});

describe('photoUrl', () => {
  it('добавляет протокол только если его нет', () => {
    expect(photoUrl('cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(photoUrl('http://x.ru/a.jpg')).toBe('http://x.ru/a.jpg');
  });
});
