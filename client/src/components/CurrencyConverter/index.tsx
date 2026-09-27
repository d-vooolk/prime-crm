import React, { useCallback, useEffect, useState } from 'react';
import { Button, InputNumber, Select, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { CurrencyPart, CurrencyRate, CurrencyRates, ForeignCurrency } from '@/types';
import { formatMoney, toByn } from '@/utils/formatters';
import styles from './CurrencyConverter.module.scss';

export const FOREIGN_CURRENCIES: ForeignCurrency[] = ['USD', 'EUR'];

export const CURRENCY_OPTIONS = FOREIGN_CURRENCIES.map(c => ({ value: c, label: c }));

/**
 * Курс по умолчанию — середина между лучшими курсами банков Минска «сдать» и «купить» (myfin.by).
 * Если myfin недоступен и есть только один из них или официальный — берём что есть.
 */
function midRate(r: CurrencyRate): number | null {
  if (r.buy != null && r.sell != null) return Math.round(((r.buy + r.sell) / 2) * 10000) / 10000;
  return r.buy ?? r.sell ?? r.nbrb;
}

// Курсы общие для всех модалок: грузим один раз, сервер сам кеширует myfin на 10 минут
let ratesPromise: Promise<CurrencyRates> | null = null;

const loadRates = (refresh = false) => {
  if (refresh || !ratesPromise) {
    ratesPromise = accountingApi.getRates(refresh).catch(e => {
      ratesPromise = null;
      throw e;
    });
  }
  return ratesPromise;
};

export function useCurrencyRates() {
  const [rates, setRates] = useState<CurrencyRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback((refresh = false) => {
    setLoading(true);
    setError(false);
    return loadRates(refresh)
      .then(r => { setRates(r); return r; })
      .catch(() => { setError(true); return null; })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const rateFor = useCallback((currency: ForeignCurrency): number | null => {
    const r = rates?.rates[currency];
    return r ? midRate(r) : null;
  }, [rates]);

  return { rates, loading, error, refresh: () => load(true), rateFor };
}

export type CurrencyRatesState = ReturnType<typeof useCurrencyRates>;

interface RateFieldProps {
  currency: ForeignCurrency;
  value: number | null;
  onChange: (rate: number | null) => void;
  ratesState: CurrencyRatesState;
}

/** Курс: подставляется средний с myfin.by, при необходимости правится руками */
export const RateField: React.FC<RateFieldProps> = ({ currency, value, onChange, ratesState }) => {
  const { rates, loading, error, refresh, rateFor } = ratesState;
  const current = rateFor(currency);
  const source = rates?.source === 'myfin' ? 'средний курс банков, myfin.by' : 'курс НБРБ';

  // После «обновить» подставляем свежий курс
  const reload = async () => {
    const fresh = await refresh();
    const r = fresh?.rates[currency];
    if (r) onChange(midRate(r));
  };

  return (
    <div className={styles.rateField}>
      <InputNumber
        className={styles.rateInput}
        value={value}
        onChange={v => onChange(v ?? null)}
        min={0}
        step={0.0001}
        precision={4}
        placeholder="Курс"
        addonBefore={`1 ${currency} =`}
        addonAfter="BYN"
      />
      <div className={styles.rateSources}>
        {rates && current != null && (
          <span className={styles.rateHint}>
            {value != null && value !== current
              ? <>Изменён вручную · {source}: <button type="button" className={styles.rateReset} onClick={() => onChange(current)}>{current}</button></>
              : <>{source}, {dayjs(rates.fetchedAt).format('HH:mm')}</>}
          </span>
        )}
        <Tooltip title="Обновить курс">
          <Button size="small" type="text" icon={<ReloadOutlined spin={loading} />} onClick={reload} />
        </Tooltip>
        {error && <span className={styles.rateError}>Курсы не загрузились — введите вручную</span>}
      </div>
    </div>
  );
};

interface PartsEditorProps {
  value: CurrencyPart[];
  onChange: (parts: CurrencyPart[]) => void;
  ratesState: CurrencyRatesState;
  /** Сколько осталось оплатить в BYN — для подсказки «вся сумма» */
  remainingByn?: number;
}

export const currencyPartsByn = (parts: CurrencyPart[]) =>
  Math.round(parts.reduce((s, p) => s + toByn(p.amount, p.rate), 0) * 100) / 100;

/** Части оплаты в валюте: валюта, сумма, курс и эквивалент в BYN */
export const CurrencyPartsEditor: React.FC<PartsEditorProps> = ({ value, onChange, ratesState, remainingByn }) => {
  const update = (idx: number, patch: Partial<CurrencyPart>) =>
    onChange(value.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const add = () => {
    const used = new Set(value.map(p => p.currency));
    const currency = FOREIGN_CURRENCIES.find(c => !used.has(c)) ?? 'USD';
    onChange([...value, { currency, amount: 0, rate: ratesState.rateFor(currency) ?? 0 }]);
  };

  // Сколько валюты покрывает весь остаток в BYN (с учётом остальных частей)
  const coverRest = (idx: number) => {
    if (remainingByn == null) return;
    const part = value[idx];
    if (!part.rate) return;
    const others = currencyPartsByn(value.filter((_, i) => i !== idx));
    const amount = Math.ceil(((remainingByn - others) / part.rate) * 100) / 100;
    if (amount > 0) update(idx, { amount });
  };

  return (
    <div className={styles.parts}>
      {value.map((part, idx) => (
        <div key={idx} className={styles.part}>
          <div className={styles.partRow}>
            <Select
              className={styles.currencySelect}
              value={part.currency}
              options={CURRENCY_OPTIONS}
              onChange={(currency: ForeignCurrency) =>
                update(idx, { currency, rate: ratesState.rateFor(currency) ?? part.rate })}
            />
            <InputNumber
              className={styles.amountInput}
              value={part.amount || null}
              min={0}
              precision={2}
              placeholder="Сумма"
              onChange={v => update(idx, { amount: v ?? 0 })}
            />
            {remainingByn != null && (
              <Tooltip title="Сколько валюты нужно на весь остаток">
                <Button size="small" onClick={() => coverRest(idx)}>На остаток</Button>
              </Tooltip>
            )}
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
            />
          </div>
          <RateField
            currency={part.currency}
            value={part.rate || null}
            onChange={rate => update(idx, { rate: rate ?? 0 })}
            ratesState={ratesState}
          />
          {part.amount > 0 && part.rate > 0 && (
            <div className={styles.partTotal}>
              {formatMoney(part.amount, part.currency)} × {part.rate} = <strong>{formatMoney(toByn(part.amount, part.rate))}</strong>
            </div>
          )}
        </div>
      ))}
      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={add}>
        {value.length ? 'Ещё валюта' : 'Оплата в валюте'}
      </Button>
    </div>
  );
};

/** Заполнены ли все части: без суммы или курса отправлять нельзя */
export const currencyPartsValid = (parts: CurrencyPart[]) => parts.every(p => p.amount > 0 && p.rate > 0);
