import { useAuthStore } from '@/store/authStore';

export interface PanicProgress {
  done: number;
  total: number;
  label: string;
}

/**
 * Тревожная кнопка «Протокол AID». Ответ — поток NDJSON: строки прогресса для прогрессбара,
 * последней строкой — { finished }. Возвращает true, если протокол сработал (сессия уже отозвана).
 * Любая ошибка/неверный PIN → false, снаружи неотличимо.
 */
async function hiddenRecords(pin: string, onProgress?: (p: PanicProgress) => void): Promise<boolean> {
  const { token } = useAuthStore.getState();
  const res = await fetch('/api/security/hidden-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok || !res.body) return false;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed) as Partial<PanicProgress> & { finished?: boolean };
      if (typeof msg.finished === 'boolean') finished = msg.finished;
      else if (typeof msg.done === 'number' && typeof msg.total === 'number') onProgress?.(msg as PanicProgress);
    } catch {
      // Неполная/битая строка — пропускаем
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  }
  if (buffer) handleLine(buffer);

  return finished;
}

export const securityApi = { hiddenRecords };
