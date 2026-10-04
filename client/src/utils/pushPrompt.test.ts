import { describe, it, expect } from 'vitest';
import { shouldAutoEnablePush, shouldShowPushPrompt } from './pushPrompt';

const base = { supported: true, permission: 'default' as NotificationPermission, optedOut: false };
const prompt = { ...base, standalone: true, snoozedUntil: null, now: 1000 };

describe('shouldAutoEnablePush', () => {
  it('подписывает, если разрешение уже выдано', () => {
    expect(shouldAutoEnablePush({ ...base, permission: 'granted' })).toBe(true);
  });

  it('не подписывает без разрешения', () => {
    expect(shouldAutoEnablePush(base)).toBe(false);
    expect(shouldAutoEnablePush({ ...base, permission: 'denied' })).toBe(false);
  });

  it('не подписывает, если пользователь выключил уведомления сам', () => {
    expect(shouldAutoEnablePush({ ...base, permission: 'granted', optedOut: true })).toBe(false);
  });

  it('не подписывает, если браузер не умеет пуши', () => {
    expect(shouldAutoEnablePush({ ...base, permission: 'granted', supported: false })).toBe(false);
  });
});

describe('shouldShowPushPrompt', () => {
  it('показывает в установленном приложении, если разрешение ещё не спрашивали', () => {
    expect(shouldShowPushPrompt(prompt)).toBe(true);
  });

  it('не показывает во вкладке браузера', () => {
    expect(shouldShowPushPrompt({ ...prompt, standalone: false })).toBe(false);
  });

  it('не показывает после разрешения или запрета', () => {
    expect(shouldShowPushPrompt({ ...prompt, permission: 'granted' })).toBe(false);
    expect(shouldShowPushPrompt({ ...prompt, permission: 'denied' })).toBe(false);
  });

  it('не показывает, если уведомления выключены вручную', () => {
    expect(shouldShowPushPrompt({ ...prompt, optedOut: true })).toBe(false);
  });

  it('после «Не сейчас» молчит до конца отсрочки', () => {
    expect(shouldShowPushPrompt({ ...prompt, snoozedUntil: 2000, now: 1999 })).toBe(false);
    expect(shouldShowPushPrompt({ ...prompt, snoozedUntil: 2000, now: 2000 })).toBe(true);
  });
});
