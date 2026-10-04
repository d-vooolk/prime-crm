import React from 'react';
import { Button, Divider, Form, Switch } from 'antd';
import type { CurrencyPart } from '@/types';
import { formatMoney, formatPrice, roundMoney } from '@/utils/formatters';
import { CurrencySection } from '../CurrencySection';
import type { PaymentTotals } from '../closeDeal.utils';
import styles from './PaymentSection.module.scss';

interface Props {
  totals: PaymentTotals;
  currencyByn: number;
  currencyParts: CurrencyPart[];
  currencyOpen: boolean;
  onOpenCurrency: () => void;
  onChangeCurrency: (parts: CurrencyPart[]) => void;
  /** Безнал при раздельной оплате; null — разбивка не задана */
  paymentSplitCard: number | null;
  onOpenPaymentSplit: () => void;
  onCancelPaymentSplit: () => void;
}

/** Оплата остатка: валюта, расчётный счёт, раздельная оплата нал/безнал. Рендерится внутри Form. */
export const PaymentSection: React.FC<Props> = ({
  totals, currencyByn, currencyParts, currencyOpen, onOpenCurrency, onChangeCurrency,
  paymentSplitCard, onOpenPaymentSplit, onCancelPaymentSplit,
}) => {
  const { remaining, rubleRemaining } = totals;

  return (
    <>
      {remaining > 0 && (
        <>
          <Divider orientation="left" className={styles.divider}>Оплата</Divider>
          {currencyOpen ? (
            <CurrencySection value={currencyParts} onChange={onChangeCurrency} remainingByn={remaining} />
          ) : (
            <Button type="dashed" size="small" className={styles.currencyButton} onClick={onOpenCurrency}>
              Оплата в валюте (USD, EUR)
            </Button>
          )}
          {currencyByn > 0 && (
            <div className={styles.currencySummary}>
              <span>Валютой: <strong>{formatMoney(currencyByn)}</strong></span>
              {rubleRemaining >= 0 ? (
                <span>Рублями: <strong>{formatMoney(rubleRemaining)}</strong></span>
              ) : (
                <span className={styles.currencyChange}>Сдача клиенту: <strong>{formatMoney(-rubleRemaining)}</strong></span>
              )}
            </div>
          )}
        </>
      )}

      {rubleRemaining > 0 && (
        <>
          <div className={styles.bankTransfer}>
            <Form.Item name="isPaidByBankTransfer" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
            <span className={styles.bankTransferLabel}>Оплата по расчётному счёту (РС)</span>
          </div>

          {paymentSplitCard == null ? (
            <Button type="dashed" size="small" onClick={onOpenPaymentSplit} className={styles.splitButton}>
              Раздельная оплата
            </Button>
          ) : (
            <div className={styles.splitSummary}>
              <span>💵 Наличные: <strong>{formatPrice(roundMoney(rubleRemaining - paymentSplitCard))}</strong></span>
              <span>💳 Безнал: <strong>{formatPrice(paymentSplitCard)}</strong></span>
              <Button type="text" size="small" className={styles.splitCancel} onClick={onCancelPaymentSplit}>
                Отменить
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
};
