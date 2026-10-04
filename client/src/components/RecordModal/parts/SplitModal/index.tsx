import React, { useState } from 'react';
import { Select, InputNumber, Button, Modal } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ServicemanSplitEntry } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useNotify } from '@/hooks/useNotify';
import { SelectedService } from '../../types';
import { initialSplitEntries, validateSplit } from '../../calc';
import styles from './SplitModal.module.scss';

interface Props {
  /** Позиция, работу по которой делят; null — окно закрыто */
  item: SelectedService | null;
  /** Чистая прибыль позиции — больше неё разделить нельзя */
  netProfit: number;
  defaultServiceman: string;
  employeeOptions: { value: string; label: string }[];
  onSave: (serviceId: string, entries: ServicemanSplitEntry[]) => void;
  onCancel: () => void;
}

/** Разделение заработка по услуге между несколькими сотрудниками */
export const SplitModal: React.FC<Props> = ({ item, netProfit, defaultServiceman, employeeOptions, onSave, onCancel }) => {
  const notify = useNotify();
  const [entries, setEntries] = useState<ServicemanSplitEntry[]>([]);
  const [entriesFor, setEntriesFor] = useState<SelectedService | null>(null);

  // Строки — при открытии окна, сразу при рендере (без кадра со старыми значениями)
  if (item !== entriesFor) {
    setEntriesFor(item);
    if (item) setEntries(initialSplitEntries(item, defaultServiceman, netProfit));
  }

  const updateEntry = (idx: number, patch: Partial<ServicemanSplitEntry>) =>
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const handleSave = () => {
    if (!item) return;
    const result = validateSplit(entries, netProfit);
    if (!result.ok) {
      if (result.reason === 'tooFew') notify.warning('Укажите минимум двух сотрудников');
      else notify.warning(
        'Сумма превышает чистую прибыль',
        `Указано: ${formatPrice(result.total)}, чистая прибыль услуги: ${formatPrice(netProfit)}`,
      );
      return;
    }
    onSave(item.serviceId, result.entries);
  };

  return (
    <Modal
      open={!!item}
      onCancel={onCancel}
      title={item ? `Разделить: ${item.serviceName}` : 'Разделить между сотрудниками'}
      width={480}
      footer={null}
      destroyOnHidden
    >
      {item && (
        <div className={styles.profit}>
          Чистая прибыль по услуге:{' '}
          <strong className={styles.profitValue}>{formatPrice(netProfit)}</strong>
        </div>
      )}

      <div className={styles.entries}>
        {entries.map((entry, idx) => (
          <div key={idx} className={styles.entry}>
            <Select
              className={styles.name}
              placeholder="Сотрудник"
              value={entry.name || undefined}
              onChange={v => updateEntry(idx, { name: v })}
              options={employeeOptions}
              optionFilterProp="label"
              showSearch
            />
            <InputNumber
              className={styles.amount}
              placeholder="Сумма"
              min={0}
              value={entry.amount || undefined}
              onChange={v => updateEntry(idx, { amount: v ?? 0 })}
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
        className={styles.add}
      >
        Добавить сотрудника
      </Button>

      <div className={styles.footer}>
        <Button onClick={onCancel}>Отмена</Button>
        <Button type="primary" onClick={handleSave}>Сохранить</Button>
      </div>
    </Modal>
  );
};
