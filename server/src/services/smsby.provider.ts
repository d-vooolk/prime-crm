/**
 * Клиент API sms.by (https://app.sms.by/api/docs).
 * Все параметры, включая token, передаются в query-строке — так же, как в
 * официальном PHP-клиенте, даже для POST-запросов.
 */

const API_URL = 'https://app.sms.by/api/v1';

export interface SmsByAlphaname {
  id: string;
  name: string;
}

export class SmsByError extends Error {}

async function request<T>(
  command: string,
  token: string,
  params: Record<string, string | number> = {},
  method: 'GET' | 'POST' = 'GET',
): Promise<T> {
  const query = new URLSearchParams({ token });
  for (const [key, value] of Object.entries(params)) query.set(key, String(value));

  const res = await fetch(`${API_URL}/${command}?${query.toString()}`, { method });
  const text = await res.text();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new SmsByError(`sms.by вернул некорректный ответ (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    throw new SmsByError(typeof err === 'string' ? err : JSON.stringify(err));
  }
  if (!res.ok) throw new SmsByError(`sms.by вернул HTTP ${res.status}`);

  return body as T;
}

/** Приводит номер к формату sms.by: 375XXXXXXXXX */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('375')) return digits;
  if (digits.startsWith('80')) return `375${digits.slice(2)}`;
  if (digits.length === 9) return `375${digits}`;
  return digits;
}

export const smsBy = {
  /** Отправка одиночного SMS. Возвращает sms_id. */
  async sendQuickSMS(token: string, phone: string, message: string, alphanameId?: string): Promise<string> {
    const params: Record<string, string> = { message, phone: normalizePhone(phone) };
    if (alphanameId) params.alphaname_id = alphanameId;
    const data = await request<{ sms_id?: string | number }>('sendQuickSMS', token, params, 'POST');
    return data.sms_id != null ? String(data.sms_id) : '';
  },

  /** Баланс аккаунта. */
  async getBalance(token: string): Promise<{ balance: number; currency: string }> {
    const data = await request<{ currency?: string; result?: { balance?: number }[] }>('getBalance', token);
    return { balance: Number(data.result?.[0]?.balance ?? 0), currency: data.currency || 'BYN' };
  },

  /** Список одобренных альфа-имён. API отдаёт объект вида { "123": "PRIME" }. */
  async getAlphanames(token: string): Promise<SmsByAlphaname[]> {
    const data = await request<Record<string, string>>('getAlphanames', token);
    return Object.entries(data || {}).map(([id, name]) => ({ id, name }));
  },

  /** Статус доставки отправленного сообщения. */
  async checkSMS(token: string, smsId: string): Promise<{ sent: unknown; delivered: unknown; status: string }> {
    return request('checkSMS', token, { sms_id: smsId });
  },
};
