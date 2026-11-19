import React, { useEffect, useState } from 'react';
import { Checkbox, InputNumber, Modal } from 'antd';
import type { Record } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { ActLine, actLinesOf, actLinesTotal } from '../closeDeal.utils';
import styles from './CorrectedActModal.module.scss';

interface Props {
  open: boolean;
  record: Record;
  /** Раздельная оплата — для сверки суммы акта */
  cashAmount: number;
  cardAmount: number;
  loading: boolean;
  onCancel: () => void;
  onPrint: (lines: ActLine[]) => void;
}

/** Исправленный акт при раздельной оплате: убрать услуги или поменять суммы и сразу распечатать */
export const CorrectedActModal: React.FC<Props> = ({ open, record, cashAmount, cardAmount, loading, onCancel, onPrint }) => {
  const [lines, setLines] = useState<ActLine[]>([]);

  // Каждый раз — с позиций записи: исправленный акт нигде не хранится
  useEffect(() => {
    if (open) setLines(actLinesOf(record));
  }, [open, record]);

  const update = (itemId: string, patch: Partial<ActLine>) =>
    setLines(prev => prev.map(l => (l.itemId === itemId ? { ...l, ...patch } : l)));

  const total = actLinesTotal(lines);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="Исправить акт"
      width={520}
      okText="Печать"
      cancelText="Отмена"
      onOk={() => onPrint(lines)}
      okButtonProps={{ disabled: !lines.some(l => l.included), loading }}
      destroyOnHidden
    >
      <div className={styles.hint}>
        Акт печатается только сейчас и нигде не сохраняется. Сделка и касса не меняются.
      </div>
      <div className={styles.payment}>
        <span>💵 Наличные: <strong>{formatPrice(cashAmount)}</strong></span>
        <span>💳 Безнал: <strong>{formatPrice(cardAmount)}</strong></span>
      </div>

      <div className={styles.list}>
        {record.items.map(item => {
          const line = lines.find(l => l.itemId === item.id);
          if (!line) return null;
          return (
            <div key={item.id} className={styles.row}>
              <Checkbox
                checked={line.included}
                onChange={e => update(item.id, { included: e.target.checked })}
                className={styles.name}
              >
                {item.service.name}
                {item.quantity > 1 && <span className={styles.qty}> × {item.quantity}</span>}
              </Checkbox>
              <InputNumber
                className={styles.amount}
                value={line.amount}
                onChange={v => update(item.id, { amount: v ?? 0 })}
                disabled={!line.included}
                min={0}
                precision={2}
                suffix="BYN"
              />
            </div>
          );
        })}
      </div>

      <div className={styles.total}>Итого в акте: <strong>{formatPrice(total)}</strong></div>
    </Modal>
  );
};
