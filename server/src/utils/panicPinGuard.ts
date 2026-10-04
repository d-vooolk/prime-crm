/**
 * Ограничение попыток PIN тревожной кнопки. Счёт общий на весь сервер, а не на пользователя:
 * злоумышленник с несколькими украденными учётками не получит больше попыток.
 * Во время блокировки даже верный PIN не принимается.
 */
export const PANIC_MAX_ATTEMPTS = 3;
export const PANIC_LOCK_MS = 60 * 60 * 1000;

export class PanicPinGuard {
  private failures = 0;
  private lockedUntil = 0;

  constructor(private readonly now: () => number = Date.now) {}

  isLocked(): boolean {
    return this.now() < this.lockedUntil;
  }

  fail(): void {
    this.failures += 1;
    if (this.failures >= PANIC_MAX_ATTEMPTS) {
      this.lockedUntil = this.now() + PANIC_LOCK_MS;
      this.failures = 0;
    }
  }

  success(): void {
    this.failures = 0;
  }
}
