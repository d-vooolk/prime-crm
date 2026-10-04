import { describe, it, expect } from 'vitest';
import { LoginLimiter, MAX_ATTEMPTS, LOCK_MINUTES, MAX_IP_ATTEMPTS } from '../utils/loginLimiter';

const MIN = 60 * 1000;

function limiterAt(start = 1_000_000) {
  let now = start;
  const limiter = new LoginLimiter(() => now);
  return { limiter, advance: (ms: number) => { now += ms; } };
}

describe('LoginLimiter', () => {
  it('блокирует email после трёх неудачных попыток', () => {
    const { limiter } = limiterAt();
    expect(MAX_ATTEMPTS).toBe(3);
    expect(limiter.fail('a@b.by', '1.1.1.1')).toBe(2);
    expect(limiter.fail('a@b.by', '1.1.1.1')).toBe(1);
    expect(limiter.minutesLeft('a@b.by', '1.1.1.1')).toBe(0);
    expect(limiter.fail('a@b.by', '1.1.1.1')).toBe(0);
    expect(limiter.minutesLeft('a@b.by', '1.1.1.1')).toBe(LOCK_MINUTES);
  });

  it('email сравнивается без учёта регистра', () => {
    const { limiter } = limiterAt();
    for (let i = 0; i < MAX_ATTEMPTS; i++) limiter.fail('Admin@B.by', '1.1.1.1');
    expect(limiter.minutesLeft('admin@b.by', '2.2.2.2')).toBeGreaterThan(0);
  });

  it('блокировка снимается через LOCK_MINUTES', () => {
    const { limiter, advance } = limiterAt();
    for (let i = 0; i < MAX_ATTEMPTS; i++) limiter.fail('a@b.by', '1.1.1.1');
    advance(LOCK_MINUTES * MIN + 1);
    expect(limiter.minutesLeft('a@b.by', '1.1.1.1')).toBe(0);
    // После разблокировки — снова три попытки
    expect(limiter.fail('a@b.by', '1.1.1.1')).toBe(2);
  });

  it('удачный вход сбрасывает счётчик', () => {
    const { limiter } = limiterAt();
    limiter.fail('a@b.by', '1.1.1.1');
    limiter.fail('a@b.by', '1.1.1.1');
    limiter.success('a@b.by');
    expect(limiter.fail('a@b.by', '1.1.1.1')).toBe(2);
  });

  it('старые неудачи забываются', () => {
    const { limiter, advance } = limiterAt();
    limiter.fail('a@b.by', '1.1.1.1');
    limiter.fail('a@b.by', '1.1.1.1');
    advance(LOCK_MINUTES * MIN + 1);
    expect(limiter.fail('a@b.by', '1.1.1.1')).toBe(2);
  });

  it('ограничивает перебор с одного IP по разным email', () => {
    const { limiter } = limiterAt();
    for (let i = 0; i < MAX_IP_ATTEMPTS; i++) limiter.fail(`u${i}@b.by`, '9.9.9.9');
    expect(limiter.minutesLeft('new@b.by', '9.9.9.9')).toBeGreaterThan(0);
    expect(limiter.minutesLeft('new@b.by', '8.8.8.8')).toBe(0);
  });
});
