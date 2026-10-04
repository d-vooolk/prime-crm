import React, { useEffect } from 'react';
import type { CurrencyPart } from '@/types';
import { CurrencyPartsEditor, useCurrencyRates } from '@/components/CurrencyConverter';
import styles from './CurrencySection.module.scss';

interface Props {
  value: CurrencyPart[];
  onChange: (parts: CurrencyPart[]) => void;
  remainingByn: number;
}

/** Часть оплаты валютой. Монтируется только по кнопке — курсы грузятся, когда они нужны */
export const CurrencySection: React.FC<Props> = ({ value, onChange, remainingByn }) => {
  const ratesState = useCurrencyRates();
  const { rates, rateFor } = ratesState;

  // Сразу первая строка — чтобы не нажимать «добавить» второй раз
  useEffect(() => {
    if (value.length === 0 && rates) onChange([{ currency: 'USD', amount: 0, rate: rateFor('USD') ?? 0 }]);
  }, [value.length, rates, rateFor, onChange]);

  return (
    <div className={styles.section}>
      <div className={styles.hint}>
        Валюта сразу уходит в капитал: в кассе будет приход по курсу и расход «Отчисление в капитал».
      </div>
      <CurrencyPartsEditor value={value} onChange={onChange} ratesState={ratesState} remainingByn={remainingByn} />
    </div>
  );
};
