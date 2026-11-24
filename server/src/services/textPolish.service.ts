import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/** Тот же предел, что в магазине (vdf-by/src/lib/text-polish.ts) */
export const MAX_POLISH_TEXT = 10_000;

/**
 * Правка текста нейросетью — через магазин vdf.by (/api/integrations/text-polish/ с общим ключом):
 * там уже подключена текстовая модель, прокси до неё и журнал запросов.
 * Исправляет орфографию и пунктуацию, тяжёлые фразы упрощает, без литературного рерайта.
 */
export async function polishText(text: string): Promise<string> {
  if (!env.vdfUrl || !env.vdfIntegrationKey) {
    throw new AppError('Нейросеть не подключена: нужны VDF_URL и VDF_INTEGRATION_KEY', 503);
  }
  let res: Response;
  try {
    res = await fetch(`${env.vdfUrl}/api/integrations/text-polish/`, {
      method: 'POST',
      headers: { 'x-integration-key': env.vdfIntegrationKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      // Модель отвечает за секунды; предел — чуть меньше proxy_read_timeout nginx (60 с),
      // чтобы пользователь увидел понятную ошибку, а не 504
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    logger.error('text polish: магазин не ответил', { err });
    throw new AppError('Нейросеть не ответила, попробуйте ещё раз', 502);
  }
  const data = await res.json().catch(() => ({})) as { text?: string; error?: string };
  if (!res.ok || !data.text) {
    logger.error(`text polish: магазин ответил ${res.status}`, { error: data.error });
    throw new AppError(data.error && res.status !== 401 ? data.error : `Нейросеть недоступна (${res.status})`, 502);
  }
  return data.text;
}
