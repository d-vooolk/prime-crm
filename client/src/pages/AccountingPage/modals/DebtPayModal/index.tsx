import React, { useEffect, useState } from 'react';
import { Alert, Button, InputNumber, Modal, Segmented } from 'antd';
import { accountingApi, Debt } from '@/api/accounting.api';
import { Currency, ForeignCurrency } from '@/types';
import { formatMoney, roundMoney, toByn } from '@/utils/formatters';
import { RateField, useCurrencyRates } from '@/components/CurrencyConverter';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import styles from './DebtPayModal.module.scss';

interface Props {
  debt: Debt | null;
  onClose: () => void;
  onPaid: () => void;
}

/**
 * Погашение долга в валюте долга, в рублях или в валюте по курсу.
 * Курс — BYN за единицу той валюты, что участвует в платеже (валюта долга или валюта оплаты).
 */
export const DebtPayModal: React.FC<Props> = ({ debt, onClose, onPaid }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const ratesState = useCurrencyRates();
  const { rates, rateFor } = ratesState;
  const [payCurrency, setPayCurrency] = useState<Currency>('BYN');
  const [amount, setAmount] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const debtCurrency = debt?.currency ?? 'BYN';
  // Какая иностранная валюта участвует: курс нужен для неё
  const foreign: ForeignCurrency | null = payCurrency !== 'BYN' ? payCurrency : debtCurrency !== 'BYN' ? debtCurrency : null;
  const converts = payCurrency !== debtCurrency;
  // Валюта, которую нам вернули, идёт через приход в кассе — там нужна сумма в BYN
  const needsRate = converts || (payCurrency !== 'BYN' && debt?.direction === 'OWED_TO_US');

  useEffect(() => {
    if (!debt) return;
    setPayCurrency(debt.currency);
    setAmount(debt.remainingAmount);
    setRate(null);
  }, [debt]);

  useEffect(() => {
    if (foreign && rate == null && rates) setRate(rateFor(foreign));
  }, [foreign, rate, rates, rateFor]);

  if (!debt) return null;

  const remaining = debt.remainingAmount;
  // На сколько уменьшится долг (в валюте долга)
  const reduce = !converts
    ? amount
    : rate
      ? (payCurrency === 'BYN' ? roundMoney(amount / rate) : toByn(amount, rate))
      : 0;
  const tooMuch = reduce > remaining + 0.01;

  // Сколько платить в выбранной валюте, чтобы закрыть весь остаток
  const fullAmount = () => {
    if (!converts) return remaining;
    if (!rate) return 0;
    return payCurrency === 'BYN' ? toByn(remaining, rate) : Math.ceil((remaining / rate) * 100) / 100;
  };

  const changeCurrency = (c: Currency) => {
    setPayCurrency(c);
    setRate(null);
    setAmount(0);
  };

  const currencyOptions: Currency[] = debtCurrency === 'BYN' ? ['BYN', 'USD', 'EUR'] : [debtCurrency, 'BYN'];

  const cashNote = (() => {
    if (payCurrency === 'BYN') {
      return debt.direction === 'WE_OWE' ? 'В кассе будет расход на эту сумму.' : 'В кассе будет приход на эту сумму.';
    }
    return debt.direction === 'WE_OWE'
      ? `${formatMoney(amount, payCurrency)} спишется из капитала.`
      : 'Валюта уйдёт в капитал: в кассе будет приход по курсу и расход «Отчисление в капитал».';
  })();

  const submit = async () => {
    if (needsRate && !rate) {
      notify.toast.error('Укажите курс');
      return;
    }
    setSaving(true);
    try {
      await accountingApi.payDebt(debt.id, { amount, currency: payCurrency, ...(needsRate && rate ? { rate } : {}) });
      notify.toast.success('Платёж зарегистрирован');
      invalidate('debts', 'cash', 'capital');
      onPaid();
    } catch (e: unknown) {
      notify.error(e, 'Не удалось провести платёж');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Исполнить долг"
      open
      onCancel={onClose}
      onOk={submit}
      okText="Провести"
      okButtonProps={{ loading: saving, disabled: amount <= 0 || tooMuch }}
      cancelText="Отмена"
      width={460}
    >
      <div className={styles.debtPay}>
        <div className={styles.debtPayInfo}>
          {debt.description}
          <div>Остаток: <strong>{formatMoney(remaining, debtCurrency)}</strong></div>
        </div>

        <div>
          <div className={styles.label}>Чем платят</div>
          <Segmented value={payCurrency} onChange={v => changeCurrency(v as Currency)} options={currencyOptions} />
        </div>

        {foreign && needsRate && (
          <div>
            <div className={styles.label}>Курс</div>
            <RateField currency={foreign} value={rate} onChange={setRate} ratesState={ratesState} />
          </div>
        )}

        <div>
          <div className={styles.label}>Сумма погашения ({payCurrency})</div>
          <div className={styles.debtPayAmount}>
            <InputNumber
              value={amount || null}
              onChange={v => setAmount(v ?? 0)}
              min={0}
              precision={2}
              className={styles.debtPayInput}
            />
            <Button onClick={() => setAmount(fullAmount())} disabled={converts && !rate}>Весь остаток</Button>
          </div>
          {converts && reduce > 0 && (
            <div className={styles.debtPayNote}>
              Долг уменьшится на <strong>{formatMoney(Math.min(reduce, remaining), debtCurrency)}</strong>
            </div>
          )}
          <div className={styles.debtPayNote}>{cashNote}</div>
        </div>

        {tooMuch && <Alert type="error" showIcon message="Сумма больше остатка долга" />}
      </div>
    </Modal>
  );
};
