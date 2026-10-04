import React, { useEffect, useState } from 'react';
import { Button, InputNumber, Modal, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ServicemanSplitEntry } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useNotify } from '@/hooks/useNotify';
import { ItemRow, validateSplit } from '../closeDeal.utils';
import styles from './ServicemanSplitModal.module.scss';

interface Props {
  open: boolean;
  item: ItemRow | undefined;
  /** Исполнитель записи — первый в разделении, если у позиции сотрудник не выбран */
  defaultServiceman: string;
  employeeOptions: { value: string; label: string }[];
  onCancel: () => void;
  onSave: (entries: ServicemanSplitEntry[]) => void;
}

/** Разделение чистой прибыли услуги между несколькими сотрудниками */
export const ServicemanSplitModal: React.FC<Props> = ({ open, item, defaultServiceman, employeeOptions, onCancel, onSave }) => {
  const notify = useNotify();
  const [entries, setEntries] = useState<ServicemanSplitEntry[]>([]);

  // При открытии — сохранённое разделение или исполнитель со всей прибылью + пустая строка
  useEffect(() => {
    if (!open || !item) return;
    setEntries(item.split && item.split.length >= 2 ? item.split : [
      { name: item.servicemanName || defaultServiceman, amount: item.netProfit },
      { name: '', amount: 0 },
    ]);
  }, [open, item, defaultServiceman]);

  const update = (idx: number, patch: Partial<ServicemanSplitEntry>) =>
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const save = () => {
    const result = validateSplit(entries, item?.netProfit);
    if (result.ok) {
      onSave(result.entries);
      return;
    }
    if (result.reason === 'tooFew') {
      notify.warning('Укажите минимум двух сотрудников');
    } else {
      notify.warning(
        'Сумма превышает чистую прибыль',
        `Указано: ${formatPrice(result.total)}, чистая прибыль услуги: ${formatPrice(item?.netProfit ?? 0)}`,
      );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={item ? `Разделить: ${item.serviceName}` : 'Разделить между сотрудниками'}
      width={480}
      footer={null}
      destroyOnHidden
    >
      {item && (
        <div className={styles.profit}>
          Чистая прибыль по услуге: <strong className={styles.profitValue}>{formatPrice(item.netProfit)}</strong>
        </div>
      )}

      <div className={styles.entries}>
        {entries.map((entry, idx) => (
          <div key={idx} className={styles.entry}>
            <Select
              className={styles.entryName}
              placeholder="Сотрудник"
              value={entry.name || undefined}
              onChange={v => update(idx, { name: v })}
              options={employeeOptions}
            />
            <InputNumber
              className={styles.entryAmount}
              placeholder="Сумма"
              min={0}
              value={entry.amount || undefined}
              onChange={v => update(idx, { amount: v ?? 0 })}
              suffix="BYN"
            />
            {entries.length > 2 && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setEntries(prev => prev.filter((_, i) => i !== idx))}
              />
            )}
          </div>
        ))}
      </div>

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() => setEntries(prev => [...prev, { name: '', amount: 0 }])}
        className={styles.addButton}
      >
        Добавить сотрудника
      </Button>

      <div className={styles.footer}>
        <Button onClick={onCancel}>Отмена</Button>
        <Button type="primary" onClick={save}>Сохранить</Button>
      </div>
    </Modal>
  );
};
