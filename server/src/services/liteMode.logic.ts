/**
 * Чистая логика облегчённого режима (utils/liteMode.ts): что остаётся в расписании после
 * тревожной кнопки и как оплата превращается в безнал. Покрыта тестами.
 */

import { ROLES } from '../utils/roles';

/** Роли, которые входят в CRM в облегчённом режиме (и мастер-доступ); остальные сотрудники удаляются */
export const LITE_MODE_ROLES: string[] = [ROLES.CREATOR, ROLES.DIRECTOR, ROLES.MANAGER];

export interface RecordForRetention {
  scheduledAt: Date;
  status: 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  importKey: string | null;
  isLegalEntity: boolean;
  deal: {
    isPaidByBankTransfer: boolean;
    splitCashAmount: number | null;
    currencyPayments: unknown;
  } | null;
  /** Типы приходов кассы по записи (INCOME — наличные и валюта, INCOME_RS — карта и РС) */
  incomeTypes: string[];
}

/**
 * Остаётся ли запись после тревожной кнопки:
 *  - активная с сегодняшнего дня и дальше — да (наличная предоплата станет РС);
 *  - закрытая — только если в расчёте не было ни наличных, ни валюты: юрлицо, РС или карта;
 *  - прошедшая незакрытая, отменённая, перенесённая из старой программы — нет.
 */
export function isRecordRetained(r: RecordForRetention, todayStart: Date): boolean {
  if (r.importKey) return false;
  if (r.status === 'ACTIVE') return r.scheduledAt >= todayStart;
  if (r.status !== 'CLOSED' || !r.deal) return false;

  const hasCurrency = Array.isArray(r.deal.currencyPayments) && r.deal.currencyPayments.length > 0;
  const hasCash = r.incomeTypes.includes('INCOME') || hasCurrency || (r.deal.splitCashAmount ?? 0) > 0;
  if (hasCash) return false;
  return r.deal.isPaidByBankTransfer || r.isLegalEntity || r.incomeTypes.includes('INCOME_RS');
}

/** Закрытие сделки: всё по РС — без наличных, раздельной оплаты и валюты */
export function cashlessClose<T extends object>(dto: T): T & {
  isPaidByBankTransfer: true;
  splitCashAmount: undefined;
  splitCardAmount: undefined;
  currencyPayments: null;
} {
  return { ...dto, isPaidByBankTransfer: true, splitCashAmount: undefined, splitCardAmount: undefined, currencyPayments: null };
}

interface PrepaidFields {
  prepaidByCard?: boolean;
  prepaidCurrency?: string | null;
  prepaidCurrencyAmount?: number | null;
  prepaidRate?: number | null;
}

/** Предоплата позиций — по РС, без валюты */
export function cashlessItems<T extends PrepaidFields>(items: T[]): T[] {
  return items.map(i => ({ ...i, prepaidByCard: true, prepaidCurrency: null, prepaidCurrencyAmount: null, prepaidRate: null }));
}

/**
 * Отмена записи с предоплатой: оставленная сумма — по РС. Не заданы суммы — сервис оставит
 * предоплату как есть (она и так уже по РС)
 */
export function cashlessCancel(data: { retainedCashAmount?: number; retainedCardAmount?: number }) {
  if (data.retainedCashAmount == null && data.retainedCardAmount == null) return data;
  return { retainedCashAmount: 0, retainedCardAmount: (data.retainedCashAmount ?? 0) + (data.retainedCardAmount ?? 0) };
}
