import { describe, it, expect } from 'vitest';
import {
  isAppUrl, takePending, PENDING_NAV_TTL_MS, addShown, splitVanished, pickTapped, parseShown, isFreshSync, latestArrived, parseResumeAnswer, appendLog, NAV_LOG_MAX,
  SHOWN_TTL_MS, SYNC_MAX_DELAY_MS,
} from './notificationNavigation';

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

describe('показанные уведомления (iPhone, приложение в фоне)', () => {
  const now = 10_000_000;
  const a = { id: 'a', url: '/schedule?record=1', tag: 'record-1', at: now - 5000, listed: true };
  const b = { id: 'b', url: '/leads', tag: 'site-lead-2', at: now - 1000, listed: true };

  it('то же tag заменяет прежнее уведомление', () => {
    const next = addShown([a], { ...a, id: 'a2', at: now }, now);
    expect(next.map(n => n.id)).toEqual(['a2']);
  });

  it('исчезло одно — его и нажали', () => {
    const { kept, vanished } = splitVanished([a, b], new Set(['b']), now);
    expect(kept).toEqual([b]);
    expect(pickTapped(vanished)).toEqual(a);
  });

  it('исчезло несколько («Очистить всё») или ничего — перехода нет', () => {
    expect(pickTapped(splitVanished([a, b], new Set(), now).vanished)).toBeNull();
    expect(pickTapped(splitVanished([a, b], new Set(['a', 'b']), now).vanished)).toBeNull();
  });

  it('без списка на экране (unlisted) исчезновение не считается нажатием', () => {
    const c = { ...a, listed: false };
    expect(splitVanished([c], new Set(), now)).toEqual({ kept: [c], vanished: [] });
  });

  it('плашка — последнее пришедшее, пока приложение было в фоне', () => {
    expect(latestArrived([a, b], now - 2000)).toEqual(b);
    expect(latestArrived([a, b], now)).toBeNull();
  });

  it('ответ service worker разбирается безопасно', () => {
    expect(parseResumeAnswer({ tapped: { id: 'a', url: '/x' }, arrived: null })).toEqual({ tapped: { id: 'a', url: '/x' }, arrived: null });
    expect(parseResumeAnswer({ tapped: { id: 'a', url: 'https://evil.com' } })).toEqual({ tapped: null, arrived: null });
    expect(parseResumeAnswer('мусор')).toEqual({ tapped: null, arrived: null });
  });

  it('журнал ограничен по длине', () => {
    const log = Array.from({ length: NAV_LOG_MAX }, (_, i) => String(i));
    expect(appendLog(log, 'new')).toHaveLength(NAV_LOG_MAX);
    expect(appendLog('мусор', 'x')).toEqual(['x']);
  });

  it('старое и битое отбрасывается', () => {
    expect(parseShown([{ ...a, at: now - SHOWN_TTL_MS - 1 }, { id: 'x', url: 'https://evil.com', at: now }, null], now)).toEqual([]);
    expect(parseShown('мусор', now)).toEqual([]);
  });

  it('запоздавшая синхронизация не выполняется', () => {
    expect(isFreshSync(now - 100, now)).toBe(true);
    expect(isFreshSync(now - SYNC_MAX_DELAY_MS - 1, now)).toBe(false);
    expect(isFreshSync(undefined, now)).toBe(false);
  });
});
