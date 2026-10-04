/**
 * Защита входа от подбора пароля: после MAX_ATTEMPTS неудачных попыток подряд вход для этого
 * email блокируется на LOCK_MINUTES. Дополнительно ограничен один IP — чтобы нельзя было
 * перебирать пароли, меняя email. Счётчики в памяти: сервер один, после перезапуска они
 * обнуляются — для защиты от перебора этого достаточно.
 */
export const MAX_ATTEMPTS = 3;
export const LOCK_MINUTES = 15;
export const MAX_IP_ATTEMPTS = 20;

interface Entry { failures: number; lockedUntil: number; lastFailure: number }

export class LoginLimiter {
  private byEmail = new Map<string, Entry>();
  private byIp = new Map<string, Entry>();

  constructor(private now: () => number = Date.now) {}

  private lockMs() { return LOCK_MINUTES * 60 * 1000; }

  /** Сколько минут ещё ждать; 0 — можно пробовать */
  minutesLeft(email: string, ip: string): number {
    const t = this.now();
    const until = Math.max(
      this.byEmail.get(email.toLowerCase())?.lockedUntil ?? 0,
      this.byIp.get(ip)?.lockedUntil ?? 0,
    );
    return until > t ? Math.ceil((until - t) / 60000) : 0;
  }

  /** Неудачная попытка; возвращает, сколько попыток осталось до блокировки */
  fail(email: string, ip: string): number {
    const emailEntry = this.bump(this.byEmail, email.toLowerCase(), MAX_ATTEMPTS);
    this.bump(this.byIp, ip, MAX_IP_ATTEMPTS);
    return Math.max(0, MAX_ATTEMPTS - emailEntry.failures);
  }

  success(email: string) {
    this.byEmail.delete(email.toLowerCase());
  }

  private bump(map: Map<string, Entry>, key: string, max: number): Entry {
    const t = this.now();
    let entry = map.get(key);
    // Старые неудачи забываются: считаются только попытки за последние LOCK_MINUTES,
    // после окончания блокировки счёт начинается заново
    const expired = entry && (t - entry.lastFailure > this.lockMs() || (entry.lockedUntil && entry.lockedUntil <= t));
    if (!entry || expired) entry = { failures: 0, lockedUntil: 0, lastFailure: t };
    entry.failures += 1;
    entry.lastFailure = t;
    if (entry.failures >= max) entry.lockedUntil = t + this.lockMs();
    map.set(key, entry);
    if (map.size > 10000) this.cleanup(map);
    return entry;
  }

  private cleanup(map: Map<string, Entry>) {
    const t = this.now();
    for (const [k, e] of map) if (e.lockedUntil < t && t - e.lastFailure > this.lockMs()) map.delete(k);
  }
}

export const loginLimiter = new LoginLimiter();
