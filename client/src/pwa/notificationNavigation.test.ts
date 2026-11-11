import { describe, it, expect } from 'vitest';
import {
  isAppUrl, takePending, PENDING_NAV_TTL_MS, resumeAction, AUTO_OPEN_MAX_AGE_MS, appendLog, NAV_LOG_MAX,
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

describe('resumeAction', () => {
  const push = { id: 'p', url: '/schedule?record=1', title: 't', body: 'b', ageMs: 10_000 };

  it('пришло только что — переходим сразу, давно — плашка', () => {
    expect(resumeAction(push, new Set())).toBe('go');
    expect(resumeAction({ ...push, ageMs: AUTO_OPEN_MAX_AGE_MS + 1 }, new Set())).toBe('offer');
  });

  it('ничего не пришло, уже открыто или чужая ссылка — ничего', () => {
    expect(resumeAction(null, new Set())).toBeNull();
    expect(resumeAction(push, new Set(['p']))).toBeNull();
    expect(resumeAction({ ...push, url: 'https://evil.com' }, new Set())).toBeNull();
  });
});

describe('журнал', () => {
  it('ограничен по длине', () => {
    const log = Array.from({ length: NAV_LOG_MAX }, (_, i) => String(i));
    expect(appendLog(log, 'new')).toHaveLength(NAV_LOG_MAX);
    expect(appendLog('мусор', 'x')).toEqual(['x']);
  });
});
