import { describe, it, expect } from 'vitest';
import { createRecentPushes, RECENT_PUSH_TTL_MS } from '../utils/recentPushes';

describe('recentPushes', () => {
  const push = (id: string, at: number) => ({ id, url: `/schedule?record=${id}`, title: 't', body: 'b', at });

  it('последний пуш с момента ухода в фон', () => {
    const store = createRecentPushes();
    store.remember(['u1', 'u2'], push('a', 1000));
    store.remember(['u1'], push('b', 2000));
    expect(store.latestSince('u1', 500, 3000)?.id).toBe('b');
    expect(store.latestSince('u2', 500, 3000)?.id).toBe('a');
    expect(store.latestSince('u2', 1500, 3000)).toBeNull();
    expect(store.latestSince('u3', 0, 3000)).toBeNull();
  });

  it('старше часа — забывается', () => {
    const store = createRecentPushes();
    store.remember(['u1'], push('a', 1000));
    expect(store.latestSince('u1', 0, 1000 + RECENT_PUSH_TTL_MS + 1)).toBeNull();
  });
});
