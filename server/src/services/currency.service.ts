import { AppError } from '../middleware/errorHandler';

export const FOREIGN_CURRENCIES = ['USD', 'EUR'] as const;
export type ForeignCurrency = typeof FOREIGN_CURRENCIES[number];
export type Currency = 'BYN' | ForeignCurrency;

/** Курсы BYN за 1 единицу валюты */
export interface CurrencyRate {
  /** Лучший курс, по которому банки покупают валюту («сдать») */
  buy: number | null;
  /** Лучший курс, по которому банки продают валюту («купить») */
  sell: number | null;
  /** Официальный курс Нацбанка */
  nbrb: number | null;
}

export interface CurrencyRates {
  rates: Record<ForeignCurrency, CurrencyRate>;
  source: 'myfin' | 'nbrb';
  fetchedAt: string;
}

const MYFIN_URL = 'https://myfin.by/currency/minsk';
const NBRB_URL = 'https://api.nbrb.by/exrates/rates';
const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

let cache: { data: CurrencyRates; at: number } | null = null;
let inflight: Promise<CurrencyRates> | null = null;

// Курсы в BYN до 4 знаков — как их публикуют банки
const round4 = (v: number) => Math.round(v * 10000) / 10000;

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: {
      // Без браузерного User-Agent myfin отдаёт заглушку
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      'Accept-Language': 'ru-RU,ru;q=0.9',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/**
 * На странице myfin есть конвертер «100 BYN = X валюты» по трём курсам:
 * conv_best_buy_* — лучший курс покупки банками, conv_best_sell_* — лучший курс продажи,
 * conv_* — курс Нацбанка. Отдельного API у myfin нет, поэтому берём значения из разметки.
 */
function parseMyfinConverter(html: string, id: string): number | null {
  const input = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0];
  const value = input?.match(/data-curse-val="([\d.]+)"/)?.[1];
  const perHundred = value ? Number(value) : NaN;
  if (!Number.isFinite(perHundred) || perHundred <= 0) return null;
  return round4(100 / perHundred);
}

async function fetchMyfin(): Promise<CurrencyRates> {
  const html = await fetchText(MYFIN_URL);
  const rates = {} as Record<ForeignCurrency, CurrencyRate>;
  for (const cur of FOREIGN_CURRENCIES) {
    const code = cur.toLowerCase();
    rates[cur] = {
      buy: parseMyfinConverter(html, `conv_best_buy_${code}`),
      sell: parseMyfinConverter(html, `conv_best_sell_${code}`),
      nbrb: parseMyfinConverter(html, `conv_${code}`),
    };
  }
  const empty = FOREIGN_CURRENCIES.every(c => rates[c].buy == null && rates[c].nbrb == null);
  if (empty) throw new Error('myfin: не удалось разобрать курсы');
  return { rates, source: 'myfin', fetchedAt: new Date().toISOString() };
}

/** Запасной вариант, если myfin недоступен или сменил вёрстку: только официальный курс */
async function fetchNbrb(): Promise<CurrencyRates> {
  const rates = {} as Record<ForeignCurrency, CurrencyRate>;
  for (const cur of FOREIGN_CURRENCIES) {
    const json = JSON.parse(await fetchText(`${NBRB_URL}/${cur}?parammode=2`)) as {
      Cur_OfficialRate?: number;
      Cur_Scale?: number;
    };
    const rate = json.Cur_OfficialRate && json.Cur_Scale ? round4(json.Cur_OfficialRate / json.Cur_Scale) : null;
    rates[cur] = { buy: null, sell: null, nbrb: rate };
  }
  return { rates, source: 'nbrb', fetchedAt: new Date().toISOString() };
}

async function load(): Promise<CurrencyRates> {
  try {
    return await fetchMyfin();
  } catch (e) {
    console.warn('[currency] myfin недоступен, берём курс НБРБ:', e instanceof Error ? e.message : e); // eslint-disable-line no-console
    return fetchNbrb();
  }
}

export const currencyService = {
  async getRates(force = false): Promise<CurrencyRates> {
    if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
    // Несколько одновременных запросов ждут одну загрузку
    inflight ??= load()
      .then(data => {
        cache = { data, at: Date.now() };
        return data;
      })
      .finally(() => { inflight = null; });
    try {
      return await inflight;
    } catch {
      // Сеть недоступна — лучше устаревший курс, чем никакого (его всё равно можно поправить руками)
      if (cache) return cache.data;
      throw new AppError('Не удалось получить курсы валют. Введите курс вручную', 502);
    }
  },
};

export const isForeignCurrency = (c: unknown): c is ForeignCurrency =>
  typeof c === 'string' && (FOREIGN_CURRENCIES as readonly string[]).includes(c);

// Деньги — до копеек, курс — до 4 знаков
export const roundMoney = (v: number) => Math.round(v * 100) / 100;

/** Сумма в BYN по курсу, округлённая до копеек */
export const toByn = (amount: number, rate: number) => roundMoney(amount * rate);

export function assertRate(rate: unknown): asserts rate is number {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new AppError('Укажите курс валюты', 400);
  }
}
