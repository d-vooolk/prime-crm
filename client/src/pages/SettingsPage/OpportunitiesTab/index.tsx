import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Select } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '@/api/services.api';
import { useInvalidateReference, useServiceCategories } from '@/hooks/useReferenceData';
import { useNotify } from '@/hooks/useNotify';
import styles from './OpportunitiesTab.module.scss';

/**
 * Настройки «Открытых возможностей» (BETA) карточки записи: услуги, которые не предлагать
 * никогда — например, гарантийные работы, диагностику или то, что не продаётся «попутно».
 */
export const OpportunitiesTab: React.FC = () => {
  const { data: categories = [], isPending } = useServiceCategories();
  const invalidate = useInvalidateReference();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const saved = useMemo(
    () => categories.flatMap(c => c.services.filter(s => s.excludeFromOpportunities).map(s => s.id)),
    [categories],
  );
  useEffect(() => { setSelected(saved); }, [saved]);

  const options = useMemo(() => categories
    .filter(c => c.services.length > 0)
    .map(c => ({
      label: c.name,
      title: c.name,
      options: c.services.map(s => ({ value: s.id, label: s.name })),
    })), [categories]);

  const changed = selected.length !== saved.length || selected.some(id => !saved.includes(id));

  const save = async () => {
    setSaving(true);
    try {
      await servicesApi.setOpportunityExclusions(selected);
      await invalidate('serviceCategories');
      // Открытые карточки записей пересчитают допродажи
      void queryClient.invalidateQueries({ queryKey: ['record-opportunities'] });
      notify.toast.success('Сохранено');
    } catch (e) {
      notify.error(e, 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={<span className={styles.title}>Открытые возможности <span className={styles.beta}>BETA</span></span>}>
      <Alert
        className={styles.hint}
        type="info"
        showIcon
        message="Блок в карточке активной записи подсказывает, что ещё предложить клиенту"
        description="Подсказки берутся из прошлых визитов такого же авто: только работы, которые делали попутно, и не дороже текущего заказа. Услуги из списка ниже не предлагаются никогда."
      />
      <div className={styles.label}>Не предлагать</div>
      <Select
        mode="multiple"
        className={styles.select}
        placeholder="Выберите услуги"
        loading={isPending}
        value={selected}
        onChange={setSelected}
        options={options}
        optionFilterProp="label"
        allowClear
      />
      <div className={styles.actions}>
        <Button type="primary" loading={saving} disabled={!changed} onClick={save}>Сохранить</Button>
      </div>
    </Card>
  );
};
