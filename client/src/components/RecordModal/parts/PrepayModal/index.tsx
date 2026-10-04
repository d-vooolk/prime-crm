import React, { useCallback, useState } from 'react';
import { InputNumber, Modal, Form, Input, Switch, Segmented } from 'antd';
import { Currency } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useNotify } from '@/hooks/useNotify';
import { SelectedService } from '../../types';
import { PrepaidFields, PrepayDraft, groupThousands, prepaidFromDraft, prepayDraftFromItem } from '../../calc';
import { PrepayCurrencyFields } from './PrepayCurrencyFields';
import styles from './PrepayModal.module.scss';

interface Props {
  /** Позиция, по которой вносят предоплату; null — окно закрыто */
  item: SelectedService | null;
  onSave: (serviceId: string, prepaid: PrepaidFields) => void;
  onCancel: () => void;
}

const EMPTY_DRAFT: PrepayDraft = { currency: 'BYN', amount: 0, byCard: false, currencyAmount: 0, rate: null };

/** Предоплата по позиции: наличные/безнал в BYN или наличная валюта по курсу */
export const PrepayModal: React.FC<Props> = ({ item, onSave, onCancel }) => {
  const notify = useNotify();
  const [draft, setDraft] = useState<PrepayDraft>(EMPTY_DRAFT);
  const [draftFor, setDraftFor] = useState<SelectedService | null>(null);

  // Черновик — из сохранённой предоплаты позиции при каждом открытии
  // (сразу при рендере, а не в эффекте — без кадра со старыми значениями)
  if (item !== draftFor) {
    setDraftFor(item);
    if (item) setDraft(prepayDraftFromItem(item));
  }

  const patch = (p: Partial<PrepayDraft>) => setDraft(d => ({ ...d, ...p }));
  const setCurrencyAmount = useCallback((currencyAmount: number) => setDraft(d => ({ ...d, currencyAmount })), []);
  const setRate = useCallback((rate: number | null) => setDraft(d => ({ ...d, rate })), []);

  const maxByn = item ? item.price * item.quantity : 0;

  const handleOk = () => {
    if (!item) return;
    const prepaid = prepaidFromDraft(draft);
    if (!prepaid) {
      notify.warning('Укажите курс валюты');
      return;
    }
    onSave(item.serviceId, prepaid);
  };

  return (
    <Modal
      title="Предоплата"
      open={!!item}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Сохранить"
      cancelText="Отмена"
      width={400}
    >
      <Form layout="vertical" className={styles.form}>
        <Form.Item label="Услуга">
          <Input value={item?.serviceName} disabled />
        </Form.Item>
        <Form.Item label="Полная сумма">
          <Input value={item ? formatPrice(maxByn) : ''} disabled />
        </Form.Item>
        <Form.Item label="Валюта">
          <Segmented
            value={draft.currency}
            // Курс другой валюты подставит PrepayCurrencyFields
            onChange={v => patch({ currency: v as Currency, rate: null })}
            options={['BYN', 'USD', 'EUR']}
          />
        </Form.Item>
        {draft.currency === 'BYN' ? (
          <>
            <Form.Item label="Сумма предоплаты">
              <InputNumber
                min={0}
                max={maxByn}
                value={draft.amount}
                onChange={v => patch({ amount: v || 0 })}
                className={styles.fullWidth}
                formatter={groupThousands}
                suffix="р."
              />
            </Form.Item>
            <Form.Item label="Способ оплаты">
              <Switch
                checked={draft.byCard}
                onChange={byCard => patch({ byCard })}
                checkedChildren="Безнал (РС)"
                unCheckedChildren="Наличные"
              />
            </Form.Item>
          </>
        ) : (
          <PrepayCurrencyFields
            currency={draft.currency}
            amount={draft.currencyAmount}
            rate={draft.rate}
            onAmountChange={setCurrencyAmount}
            onRateChange={setRate}
            maxByn={maxByn}
          />
        )}
      </Form>
    </Modal>
  );
};
