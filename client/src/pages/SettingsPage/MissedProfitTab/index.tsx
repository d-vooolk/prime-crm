import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Empty, Input, Popconfirm, Select, Spin,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { wikiApi } from '@/api/wiki.api';
import { WikiSection } from '@/types';
import { useServiceCategories } from '@/hooks/useReferenceData';
import { useWikiSections, WIKI_SECTIONS_KEY } from '@/hooks/useWikiSections';
import { useNotify } from '@/hooks/useNotify';
import styles from './MissedProfitTab.module.scss';

type ServiceOptions = { label: string; title: string; options: { value: string; label: string }[] }[];

interface SectionRowProps {
  section?: WikiSection;
  options: ServiceOptions;
  /** true — сохранено */
  onSave: (data: { name: string; serviceIds: string[] }) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
}

/** Раздел вики и услуги, после которых его нужно заполнить. Без section — форма нового раздела. */
const SectionRow: React.FC<SectionRowProps> = ({ section, options, onSave, onDelete }) => {
  const [name, setName] = useState(section?.name ?? '');
  const [serviceIds, setServiceIds] = useState<string[]>(section?.serviceIds ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(section?.name ?? '');
    setServiceIds(section?.serviceIds ?? []);
  }, [section]);

  const saved = section?.serviceIds ?? [];
  const changed = name.trim() !== (section?.name ?? '')
    || serviceIds.length !== saved.length || serviceIds.some(id => !saved.includes(id));

  const save = async () => {
    setSaving(true);
    try {
      const ok = await onSave({ name: name.trim(), serviceIds });
      if (ok && !section) {
        setName('');
        setServiceIds([]);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.row}>
      <Input
        className={styles.name}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Раздел вики, например «Bi-Led модули»"
        maxLength={100}
      />
      <Select
        mode="multiple"
        className={styles.services}
        placeholder="Услуги, после которых раздел нужно заполнить"
        value={serviceIds}
        onChange={setServiceIds}
        options={options}
        optionFilterProp="label"
        allowClear
      />
      <div className={styles.actions}>
        <Button
          type="primary"
          icon={section ? undefined : <PlusOutlined />}
          loading={saving}
          disabled={!name.trim() || !changed}
          onClick={save}
        >
          {section ? 'Сохранить' : 'Добавить'}
        </Button>
        {onDelete && (
          <Popconfirm
            title="Удалить раздел?"
            description="Раздел с описаниями удалить нельзя — только переименовать"
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
          >
            <Button danger icon={<DeleteOutlined />} aria-label="Удалить раздел" />
          </Popconfirm>
        )}
      </div>
    </div>
  );
};

/**
 * Упущенная прибыль за вики: разделы карточки вики и услуги, после которых раздел нужно заполнить.
 * Закрыта сделка с такой услугой, а раздел у этого авто пуст — сотруднику показывается
 * упущенная премия с подсказкой, какой раздел заполнить. Услуги без раздела (полировка, оклейка)
 * вики не требуют.
 */
export const MissedProfitTab: React.FC = () => {
  const { data: categories = [], isPending: categoriesPending } = useServiceCategories();
  const { data: sections = [], isPending } = useWikiSections();
  const queryClient = useQueryClient();
  const notify = useNotify();

  // Услуга — только в одном разделе: в подписи видно, из какого раздела она перейдёт
  const options = useMemo<ServiceOptions>(() => {
    const sectionOf = new Map(sections.flatMap(s => s.serviceIds.map(id => [id, s.name] as const)));
    return categories
      .filter(c => c.services.length > 0)
      .map(c => ({
        label: c.name,
        title: c.name,
        options: c.services.map(s => ({
          value: s.id,
          label: sectionOf.has(s.id) ? `${s.name} (${sectionOf.get(s.id)})` : s.name,
        })),
      }));
  }, [categories, sections]);

  const apply = async (request: Promise<WikiSection[]>, message: string) => {
    try {
      queryClient.setQueryData(WIKI_SECTIONS_KEY, await request);
      // Упущенная прибыль пересчитается по новым разделам
      void queryClient.invalidateQueries({ queryKey: ['missed-wiki'] });
      notify.toast.success(message);
      return true;
    } catch (e) {
      notify.error(e, 'Не удалось сохранить');
      return false;
    }
  };

  return (
    <Card title="Упущенная прибыль">
      <Alert
        className={styles.hint}
        type="info"
        showIcon
        message="Какие разделы вики сотрудник заполняет после работ"
        description="Карточка вики делится на разделы. Сделка закрыта с услугой раздела, а раздел у этого авто пуст — сотрудник видит упущенную премию и ссылку сразу на этот раздел. Если раздел уже заполнен, а другой — нет, предлагается только незаполненный. Услуги без раздела (полировка, оклейка) заполнять в вики не нужно."
      />
      <Spin spinning={isPending || categoriesPending}>
        {!isPending && sections.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Разделов пока нет — упущенная прибыль не считается" />
        )}
        <div className={styles.list}>
          {sections.map(s => (
            <SectionRow
              key={s.id}
              section={s}
              options={options}
              onSave={data => apply(wikiApi.updateSection(s.id, data), 'Сохранено')}
              onDelete={() => apply(wikiApi.deleteSection(s.id), 'Раздел удалён')}
            />
          ))}
        </div>
        <div className={styles.label}>Новый раздел</div>
        <SectionRow options={options} onSave={data => apply(wikiApi.createSection(data), 'Раздел добавлен')} />
      </Spin>
    </Card>
  );
};
