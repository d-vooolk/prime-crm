import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Popconfirm, Select, Space, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { ActMemoBlock, Category } from '@/types';
import {
  DEFAULT_ACT_MEMO, guessMemoTargets, memoBlocksFromText, newMemoBlockId,
} from '@/utils/actMemo';
import styles from './ActMemoEditor.module.scss';

interface Props {
  categories: Category[];
}

/** Текстовая памятка → блоки с отмеченными по названию услугами (фары — разборка, плёнка — оклейка) */
const blocksFromText = (text: string, categories: Category[]) =>
  memoBlocksFromText(text).map(b => ({ ...b, targets: guessMemoTargets(b.title, categories) }));

// Пустые строки-заготовки «- » не считаем текстом
const hasText = (b: ActMemoBlock) => b.text.replace(/^-\s*$/gm, '').trim().length > 0;

/**
 * Памятка в акте по услугам: выбираем услугу (или несколько с одинаковой памяткой) и пишем к ней текст.
 * В акт попадают памятки только тех услуг, что есть в записи. Без услуг — печатается всегда.
 */
export const ActMemoEditor: React.FC<Props> = ({ categories }) => {
  const [blocks, setBlocks] = useState<ActMemoBlock[] | null>(null);
  // Сохранённых памяток по услугам ещё нет — показываем перенесённые из текста, пока не нажмут «Сохранить»
  const [fromText, setFromText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    servicesApi.getSettings()
      .then(s => {
        if (s?.actMemoBlocks) setBlocks(s.actMemoBlocks);
        else setFromText(s?.actMemo ?? DEFAULT_ACT_MEMO);
      })
      .catch(() => setFromText(DEFAULT_ACT_MEMO));
  }, []);

  // Автоподбор услуг ждёт справочник
  useEffect(() => {
    if (fromText == null || !categories.length) return;
    setBlocks(blocksFromText(fromText, categories));
    setFromText(null);
  }, [fromText, categories]);

  const serviceOptions = useMemo(() => categories.map(c => ({
    label: c.name,
    options: c.services.map(s => ({ label: s.name, value: `svc:${s.id}` })),
  })), [categories]);

  const update = (id: string, patch: Partial<ActMemoBlock>) =>
    setBlocks(prev => prev?.map(b => (b.id === id ? { ...b, ...patch } : b)) ?? prev);

  const remove = (id: string) => setBlocks(prev => prev?.filter(b => b.id !== id) ?? prev);

  const addBlock = () =>
    setBlocks(prev => [...(prev ?? []), { id: newMemoBlockId(), title: '', text: '', targets: [] }]);

  const save = async () => {
    if (!blocks) return;
    setSaving(true);
    try {
      const clean = blocks.filter(hasText);
      await servicesApi.updateSettings({ actMemoBlocks: clean });
      setBlocks(clean);
      message.success(clean.length ? 'Памятка сохранена' : 'Памятка отключена');
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Памятка клиенту в акте"
      extra={
        <Space>
          <Popconfirm
            title="Заменить памятки текстом по умолчанию?"
            onConfirm={() => setBlocks(blocksFromText(DEFAULT_ACT_MEMO, categories))}
            okText="Заменить"
            cancelText="Отмена"
          >
            <Button size="small">По умолчанию</Button>
          </Popconfirm>
          <Button type="primary" size="small" loading={saving} onClick={save} disabled={!blocks}>Сохранить</Button>
        </Space>
      }
    >
      <p className={styles.hint}>
        Добавьте услугу и напишите к ней памятку — она напечатается в акте под гарантиями, только если
        эта услуга есть в записи. Одну памятку можно привязать сразу к нескольким услугам. Шрифт подбирается
        так, чтобы акт уместился на один лист. Строка с «- » — пункт списка.
      </p>

      {blocks && blocks.length === 0 && <Empty description="Памятка не печатается" />}

      <div className={styles.blocks}>
        {blocks?.map(block => (
          <div key={block.id} className={styles.block}>
            <div className={styles.blockHead}>
              <Select
                mode="multiple"
                className={styles.targets}
                options={serviceOptions}
                value={block.targets.filter(t => t.startsWith('svc:'))}
                onChange={(targets: string[]) => update(block.id, { targets })}
                optionFilterProp="label"
                showSearch
                allowClear
                maxTagCount="responsive"
                placeholder="Услуга — выберите из списка"
              />
              <Popconfirm title="Удалить памятку?" onConfirm={() => remove(block.id)} okText="Удалить" cancelText="Отмена">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
            {!block.targets.length && (
              <div className={styles.targetsHint}>Услуга не выбрана — памятка печатается в каждом акте</div>
            )}
            <Input.TextArea
              value={block.text}
              onChange={e => update(block.id, { text: e.target.value })}
              autoSize={{ minRows: 3, maxRows: 14 }}
              placeholder={'Памятка, например:\n- Не мойте автомобиль 3 дня после оклейки.'}
            />
            <Input
              value={block.title}
              onChange={e => update(block.id, { title: e.target.value })}
              placeholder="Заголовок в акте — необязательно, иначе название услуги"
              size="small"
            />
          </div>
        ))}
      </div>

      <Button type="dashed" icon={<PlusOutlined />} onClick={addBlock} className={styles.add} disabled={!blocks}>
        Добавить памятку к услуге
      </Button>
    </Card>
  );
};
