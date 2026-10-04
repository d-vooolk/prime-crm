import { describe, it, expect } from 'vitest';
import { PanicPinGuard, PANIC_LOCK_MS, PANIC_MAX_ATTEMPTS } from '../utils/panicPinGuard';

function guardAt(start = 1_000_000) {
  let now = start;
  const guard = new PanicPinGuard(() => now);
  return { guard, advance: (ms: number) => { now += ms; } };
}

describe('PanicPinGuard', () => {
  it('блокирует на час после трёх неверных PIN', () => {
    const { guard, advance } = guardAt();
    expect(PANIC_MAX_ATTEMPTS).toBe(3);
    guard.fail();
    guard.fail();
    expect(guard.isLocked()).toBe(false);
    guard.fail();
    expect(guard.isLocked()).toBe(true);
    advance(PANIC_LOCK_MS - 1);
    expect(guard.isLocked()).toBe(true);
    advance(1);
    expect(guard.isLocked()).toBe(false);
  });

  it('верный PIN сбрасывает счёт ошибок', () => {
    const { guard } = guardAt();
    guard.fail();
    guard.fail();
    guard.success();
    guard.fail();
    guard.fail();
    expect(guard.isLocked()).toBe(false);
  });
});
