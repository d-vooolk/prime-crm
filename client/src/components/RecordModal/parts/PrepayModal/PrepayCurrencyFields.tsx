import React, { useEffect } from 'react';
import { Alert, Form, InputNumber } from 'antd';
import { ForeignCurrency } from '@/types';
import { formatMoney, formatPrice, toByn } from '@/utils/formatters';
import { RateField, useCurrencyRates } from '@/components/CurrencyConverter';
import styles from './PrepayModal.module.scss';

interface Props {
  currency: ForeignCurrency;
  amount: number;
  rate: number | null;
  onAmountChange: (amount: number) => void;
  onRateChange: (rate: number | null) => void;
  maxByn: number;
}

/** Предоплата в валюте: сумма в валюте и курс. Отдельный компонент — курсы грузятся, только когда он открыт */
export const PrepayCurrencyFields: React.FC<Props> = ({ currency, amount, rate, onAmountChange, onRateChange, maxByn }) => {
  const ratesState = useCurrencyRates();
  const { rates, rateFor } = ratesState;

  // Курс подставляем, как только курсы загрузились или сменили валюту
  useEffect(() => {
    if (rate == null && rates) onRateChange(rateFor(currency));
  }, [rates, currency, rate, rateFor, onRateChange]);

  const byn = rate ? toByn(amount, rate) : 0;
  return (
    <>
      <Form.Item label={`Сумма в ${currency}`}>
        <InputNumber
          min={0}
          precision={2}
          value={amount || null}
          onChange={v => onAmountChange(v || 0)}
          className={styles.fullWidth}
          suffix={currency}
        />
      </Form.Item>
      <Form.Item label="Курс">
        <RateField currency={currency} value={rate} onChange={onRateChange} ratesState={ratesState} />
      </Form.Item>
      {byn > 0 && (
        <Alert
          type={byn > maxByn ? 'warning' : 'info'}
          showIcon
          message={`В рублях: ${formatMoney(byn)}${byn > maxByn ? ` — больше стоимости услуги (${formatPrice(maxByn)})` : ''}`}
          description="Валюта сразу уйдёт в капитал: в кассе будет приход по курсу и расход «Отчисление в капитал»"
        />
      )}
    </>
  );
};
