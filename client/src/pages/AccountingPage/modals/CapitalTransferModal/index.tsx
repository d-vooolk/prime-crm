import React, { useEffect, useState } from 'react';
import { Alert, DatePicker, Input, InputNumber, Modal, Segmented, Select } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { Currency } from '@/types';
import { formatMoney, roundMoney } from '@/utils/formatters';
import { RateField, useCurrencyRates } from '@/components/CurrencyConverter';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import styles from './CapitalTransferModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  persons: string[];
  defaultPerson?: string;
}

/**
 * Отчисление в капитал из кассы: в кассе — расход в BYN, в капитале — та же сумма в BYN
 * либо валюта, купленная на эти деньги. Сумму в валюте можно поправить руками (фактически купили),
 * тогда курс пересчитается из двух сумм.
 */
export const CapitalTransferModal: React.FC<Props> = ({ open, onClose, onDone, persons, defaultPerson }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const ratesState = useCurrencyRates();
  const { rates, rateFor } = ratesState;
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [amountByn, setAmountByn] = useState(0);
  const [currency, setCurrency] = useState<Currency>('BYN');
  const [rate, setRate] = useState<number | null>(null);
  const [currencyAmount, setCurrencyAmount] = useState(0);
  const [person, setPerson] = useState<string | undefined>(defaultPerson || undefined);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(dayjs());
    setAmountByn(0);
    setCurrency('BYN');
    setRate(null);
    setCurrencyAmount(0);
    setPerson(defaultPerson || undefined);
    setNote('');
  }, [open, defaultPerson]);

  useEffect(() => {
    if (currency !== 'BYN' && rate == null && rates) setRate(rateFor(currency));
  }, [currency, rate, rates, rateFor]);

  // Сумма в валюте по курсу — пересчитываем при смене рублей или курса
  const recalc = (byn: number, r: number | null) => {
    setCurrencyAmount(r ? roundMoney(byn / r) : 0);
  };

  const changeByn = (v: number) => {
    setAmountByn(v);
    recalc(v, rate);
  };

  const changeRate = (r: number | null) => {
    setRate(r);
    recalc(amountByn, r);
  };

  const changeCurrency = (c: Currency) => {
    setCurrency(c);
    setRate(null);
    setCurrencyAmount(0);
  };

  // Курс по фактическим суммам: так записан в капитал
  const effectiveRate = currency !== 'BYN' && currencyAmount > 0 ? Math.round((amountByn / currencyAmount) * 10000) / 10000 : null;

  const submit = async () => {
    if (amountByn <= 0) { notify.toast.error('Укажите сумму'); return; }
    if (!person) { notify.toast.error('Выберите, кто отчисляет'); return; }
    if (currency !== 'BYN' && currencyAmount <= 0) { notify.toast.error('Укажите сумму в валюте'); return; }
    setSaving(true);
    try {
      await accountingApi.createCapitalTransfer({
        date: date.toISOString(),
        amountByn,
        currency,
        ...(currency !== 'BYN' && { currencyAmount }),
        person,
        description: note.trim() || undefined,
      });
      notify.toast.success('Отчисление в капитал проведено');
      invalidate('cash', 'capital');
      onDone();
    } catch (e: unknown) {
      notify.error(e, 'Не удалось провести отчисление');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Отчисление в капитал"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Отчислить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
      width={480}
    >
      <div className={styles.capitalTransfer}>
        <div>
          <div className={styles.label}>Дата</div>
          <DatePicker value={date} onChange={d => d && setDate(d)} format="DD.MM.YYYY" allowClear={false} className={styles.fullWidth} />
        </div>
        <div>
          <div className={styles.label}>Сумма из кассы</div>
          <InputNumber value={amountByn || null} onChange={v => changeByn(v ?? 0)} min={0} precision={2} suffix="р." className={styles.fullWidth} />
        </div>
        <div>
          <div className={styles.label}>В капитал записать как</div>
          <Segmented
            value={currency}
            onChange={v => changeCurrency(v as Currency)}
            options={[{ value: 'BYN', label: 'BYN (без обмена)' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]}
          />
        </div>
        {currency !== 'BYN' && (
          <>
            <div>
              <div className={styles.label}>Курс</div>
              <RateField currency={currency} value={rate} onChange={changeRate} ratesState={ratesState} />
            </div>
            <div>
              <div className={styles.label}>Получено валюты</div>
              <InputNumber
                value={currencyAmount || null}
                onChange={v => setCurrencyAmount(v ?? 0)}
                min={0}
                precision={2}
                suffix={currency}
                className={styles.fullWidth}
              />
            </div>
            {amountByn > 0 && currencyAmount > 0 && (
              <Alert
                type="info"
                showIcon
                message={`${formatMoney(amountByn)} → ${formatMoney(currencyAmount, currency)}`}
                description={effectiveRate && effectiveRate !== rate ? `Фактический курс: ${effectiveRate}` : undefined}
              />
            )}
          </>
        )}
        <div>
          <div className={styles.label}>Кто отчисляет</div>
          <Select
            showSearch
            value={person}
            onChange={setPerson}
            placeholder="Выберите сотрудника"
            options={persons.map(p => ({ value: p, label: p }))}
            className={styles.fullWidth}
          />
        </div>
        <div>
          <div className={styles.label}>Комментарий</div>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Необязательно" />
        </div>
      </div>
    </Modal>
  );
};
