import React, { useEffect, useState } from 'react';
import { InputNumber, Modal } from 'antd';
import { roundMoney } from '@/utils/formatters';
import styles from './PaymentSplitModal.module.scss';

interface Props {
  open: boolean;
  /** Сколько платить рублями — делится на нал и безнал */
  rubleRemaining: number;
  /** Уже заданный безнал (при повторном открытии) */
  initialCard: number | null;
  onCancel: () => void;
  onApply: (cardAmount: number | null) => void;
}

/** Раздельная оплата: вводится безнал, наличные — остаток */
export const PaymentSplitModal: React.FC<Props> = ({ open, rubleRemaining, initialCard, onCancel, onApply }) => {
  const [draft, setDraft] = useState<number | null>(null);

  useEffect(() => {
    if (open) setDraft(initialCard ?? 0);
  }, [open, initialCard]);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="Раздельная оплата"
      width={380}
      onOk={() => onApply(draft)}
      okText="Применить"
      cancelText="Отмена"
      destroyOnHidden
    >
      <div className={styles.fields}>
        <div>
          <div className={styles.label}>Наличные</div>
          <InputNumber
            className={styles.input}
            value={draft != null ? roundMoney(rubleRemaining - draft) : rubleRemaining}
            disabled
            suffix="BYN"
            precision={2}
          />
        </div>
        <div>
          <div className={styles.label}>Безнал (карта / РС)</div>
          <InputNumber
            className={styles.input}
            min={0}
            max={rubleRemaining}
            precision={2}
            suffix="BYN"
            placeholder="0.00"
            value={draft ?? undefined}
            onChange={v => setDraft(v ?? 0)}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
};
