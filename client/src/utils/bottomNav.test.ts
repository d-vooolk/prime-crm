import { describe, expect, it } from 'vitest';
import { bottomNavPaths } from './bottomNav';

const all = ['/schedule', '/leads', '/dashboard', '/wiki', '/accounting', '/notes', '/mail', '/camera', '/settings'];

describe('bottomNavPaths', () => {
  it('без выбора — всё, кроме разделов «Ещё» по умолчанию', () => {
    expect(bottomNavPaths(all)).toEqual(['/schedule', '/dashboard', '/wiki', '/accounting', '/notes']);
  });

  it('свой выбор — в порядке меню, а не в порядке отметки', () => {
    expect(bottomNavPaths(all, ['/settings', '/schedule', '/leads'])).toEqual(['/schedule', '/leads', '/settings']);
  });

  it('недоступные разделы из выбора пропускаются', () => {
    const employee = ['/schedule', '/dashboard', '/wiki', '/accounting', '/settings'];
    expect(bottomNavPaths(employee, ['/mail', '/wiki', '/camera'])).toEqual(['/wiki']);
  });

  it('если из выбора ничего не доступно — набор по умолчанию', () => {
    expect(bottomNavPaths(['/schedule', '/settings'], ['/mail'])).toEqual(['/schedule']);
  });

  it('не больше пяти пунктов', () => {
    expect(bottomNavPaths(all, all)).toHaveLength(5);
  });
});
