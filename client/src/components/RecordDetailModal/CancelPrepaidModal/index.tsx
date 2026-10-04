import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Modal } from 'antd';
import styles from './CancelPrepaidModal.module.scss';

interface Props {
  open: boolean;
  /** Внесённая предоплата — по умолчанию вся остаётся в кассе */
  prepaidCash: number;
  prepaidCard: number;
  onCancel: () => void;
  onConfirm: (retainCash: number, retainCard: number) => void;
}

/** Отмена записи с предоплатой: сколько оставить в кассе наличными и по РС */
export const CancelPrepaidModal: React.FC<Props> = ({ open, prepaidCash, prepaidCard, onCancel, onConfirm }) => {
  const [retainedCash, setRetainedCash] = useState(0);
  const [retainedCard, setRetainedCard] = useState(0);

  useEffect(() => {
    if (!open) return;
    setRetainedCash(prepaidCash);
    setRetainedCard(prepaidCard);
  }, [open, prepaidCash, prepaidCard]);

  return (
    <Modal
      title="Отмена записи с предоплатой"
      open={open}
      onCancel={onCancel}
      onOk={() => onConfirm(retainedCash, retainedCard)}
      okText="Отменить запись"
      okButtonProps={{ danger: true }}
      cancelText="Назад"
      width={400}
    >
      <p className={styles.hint}>
        По этой записи есть предоплата. Укажите, какую сумму оставить в кассе.
      </p>
      {prepaidCash > 0 && (
        <Form.Item label="Наличные (оставить в кассе)">
          <InputNumber
            min={0}
            max={prepaidCash}
            value={retainedCash}
            onChange={v => setRetainedCash(v || 0)}
            className={styles.input}
            suffix="р."
          />
        </Form.Item>
      )}
      {prepaidCard > 0 && (
        <Form.Item label="Безнал РС (оставить в кассе)">
          <InputNumber
            min={0}
            max={prepaidCard}
            value={retainedCard}
            onChange={v => setRetainedCard(v || 0)}
            className={styles.input}
            suffix="р."
          />
        </Form.Item>
      )}
    </Modal>
  );
};
