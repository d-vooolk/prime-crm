import React, { useEffect, useState } from 'react';
import { InputNumber, Modal, Switch } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import styles from './PercentModal.module.scss';

export interface PercentTarget {
  type: 'service' | 'category';
  id: string;
  name: string;
  /** Текущий кастомный процент; null — берётся из профиля сотрудника */
  current: number | null | undefined;
}

interface Props {
  target: PercentTarget | null;
  onClose: () => void;
}

/** Кастомный процент от прибыли для услуги или всей категории */
export const PercentModal: React.FC<Props> = ({ target, onClose }) => {
  const [value, setValue] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const invalidate = useInvalidateReference();

  useEffect(() => {
    if (!target) return;
    setValue(target.current ?? null);
    setIsDefault(target.current == null);
  }, [target]);

  const handleSave = async () => {
    if (!target) return;
    const customPercent = isDefault ? null : value;
    setSaving(true);
    try {
      if (target.type === 'service') await servicesApi.updateService(target.id, { customPercent });
      else await servicesApi.updateCategory(target.id, { customPercent });
      notify.toast.success('Сохранено');
      await invalidate('serviceCategories');
      onClose();
    } catch (e) {
      notify.error(e, 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={target !== null}
      onCancel={onClose}
      onOk={handleSave}
      okButtonProps={{ loading: saving }}
      title={`Процент: ${target?.name}`}
      width={360}
      okText="Сохранить"
      cancelText="Отмена"
      destroyOnHidden
    >
      <div className={styles.body}>
        <div className={styles.switchRow}>
          <Switch
            checked={isDefault}
            onChange={v => {
              setIsDefault(v);
              if (v) setValue(null);
            }}
          />
          <span className={styles.switchLabel}>По умолчанию (% из профиля сотрудника)</span>
        </div>
        <div>
          <div className={styles.fieldLabel}>Кастомный процент</div>
          <InputNumber
            className={styles.fullWidth}
            min={0}
            max={100}
            step={0.5}
            suffix="%"
            placeholder="Например: 50"
            disabled={isDefault}
            value={isDefault ? undefined : (value ?? undefined)}
            onChange={v => {
              setValue(v ?? null);
              if (v != null) setIsDefault(false);
            }}
          />
        </div>
        {!isDefault && target?.type === 'category' && (
          <div className={styles.note}>
            Все услуги этой категории будут использовать этот процент, если у самой услуги не задан свой.
          </div>
        )}
      </div>
    </Modal>
  );
};
