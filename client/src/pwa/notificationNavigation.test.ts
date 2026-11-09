import { describe, it, expect } from 'vitest';
import { isAppUrl, takePending, PENDING_NAV_TTL_MS } from './notificationNavigation';

describe('isAppUrl', () => {
  it('принимает только ссылки приложения', () => {
    expect(isAppUrl('/schedule?record=1')).toBe(true);
    expect(isAppUrl('//evil.com')).toBe(false);
    expect(isAppUrl('https://evil.com')).toBe(false);
    expect(isAppUrl(42)).toBe(false);
  });
});

describe('takePending', () => {
  const now = 1_000_000;
  const pending = { id: 'a', url: '/schedule?record=1', at: now - 1000 };

  it('свежая ссылка', () => {
    expect(takePending(pending, now, new Set())).toEqual(pending);
  });

  it('уже выполненная — не повторяется', () => {
    expect(takePending(pending, now, new Set(['a']))).toBeNull();
  });

  it('устаревшая — пропускается', () => {
    expect(takePending({ ...pending, at: now - PENDING_NAV_TTL_MS - 1 }, now, new Set())).toBeNull();
  });

  it('битые данные — null', () => {
    expect(takePending(null, now, new Set())).toBeNull();
    expect(takePending({ id: 'a', url: 'https://x', at: now }, now, new Set())).toBeNull();
    expect(takePending({ url: '/x', at: now }, now, new Set())).toBeNull();
  });
});
