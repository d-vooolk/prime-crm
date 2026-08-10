import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, Button, Modal, Form, InputNumber, message, Tag, Empty, Popconfirm, Tooltip, Alert, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { carsApi, CatalogItemInput } from '@/api/cars.api';
import { CarBrand, CarModel, CarGeneration } from '@/types';
import styles from './CarCatalogEditor.module.scss';

/**
 * Редактор справочника авто.
 *
 * Каскад из трёх колонок: марка → модель → поколение. Записи из каталога донора
 * (source=SNAPSHOT) доступны только для чтения — их всё равно перезапишет
 * очередная синхронизация. Редактировать и удалять можно только то, что
 * заведено руками: грузовые и прочее, чего у донора нет.
 */

type Level = 'mark' | 'model' | 'generation';
type AnyItem = CarBrand | CarModel | CarGeneration;

const LEVEL_LABELS: Record<Level, { one: string; add: string; empty: string }> = {
  mark: { one: 'марку', add: 'Добавить марку', empty: 'Марок нет' },
  model: { one: 'модель', add: 'Добавить модель', empty: 'Выберите марку слева' },
  generation: { one: 'поколение', add: 'Добавить поколение', empty: 'Выберите модель слева' },
};

function yearsLabel(item: AnyItem) {
  if (!item.year_from && !item.year_to) return null;
  return `${item.year_from ?? '...'}–${item.year_to ?? 'н.в.'}`;
}

interface ColumnProps {
  level: Level;
  title: string;
  items: AnyItem[];
  loading: boolean;
  disabled: boolean;
  selectedId: string | null;
  manualOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (item: AnyItem) => void;
  onDelete: (item: AnyItem) => void;
}

const Column: React.FC<ColumnProps> = ({
  level, title, items, loading, disabled, selectedId, manualOnly, onSelect, onAdd, onEdit, onDelete,
}) => {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i => (!manualOnly || i.source === 'MANUAL') && (!q || i.name.toLowerCase().includes(q)));
  }, [items, query, manualOnly]);

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <span className={styles.columnTitle}>
          {title}
          {!disabled && <span className={styles.count}>{visible.length}</span>}
        </span>
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          disabled={disabled}
          onClick={onAdd}
        >
          Добавить
        </Button>
      </div>

      <Input
        size="small"
        allowClear
        disabled={disabled}
        prefix={<SearchOutlined />}
        placeholder="Поиск по названию"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className={styles.search}
      />

      <div className={styles.list}>
        {loading && <div className={styles.centered}><Spin size="small" /></div>}
        {!loading && disabled && (
          <div className={styles.centered}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={LEVEL_LABELS[level].empty} />
          </div>
        )}
        {!loading && !disabled && visible.length === 0 && (
          <div className={styles.centered}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={query || manualOnly ? 'Ничего не найдено' : LEVEL_LABELS[level].empty}
            />
          </div>
        )}
        {!loading && !disabled && visible.map(item => {
          const isManual = item.source === 'MANUAL';
          const years = yearsLabel(item);
          const photo = level === 'generation' ? (item as CarGeneration).photo : null;
          return (
            <div
              key={item.id}
              className={`${styles.row} ${selectedId === item.id ? styles.rowActive : ''}`}
              onClick={() => onSelect(item.id)}
            >
              {level === 'generation' && (
                photo
                  ? <img src={photo.startsWith('http') ? photo : `https://${photo}`} alt="" className={styles.thumb} loading="lazy" />
                  : <span className={styles.thumbEmpty} title="Фото не задано">—</span>
              )}
              <div className={styles.rowMain}>
                <div className={styles.rowName}>
                  {item.name}
                  {isManual && <Tag color="gold" className={styles.badge}>вручную</Tag>}
                </div>
                {years && <div className={styles.rowYears}>{years}</div>}
              </div>

              <div className={styles.rowActions} onClick={e => e.stopPropagation()}>
                {isManual ? (
                  <>
                    <Tooltip title="Изменить">
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(item)} />
                    </Tooltip>
                    <Popconfirm
                      title={`Удалить ${LEVEL_LABELS[level].one}?`}
                      description="Вместе со всем, что вложено внутрь"
                      okText="Удалить"
                      cancelText="Отмена"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => onDelete(item)}
                    >
                      <Tooltip title="Удалить">
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </>
                ) : (
                  <Tooltip title="Запись из основного каталога, редактированию не подлежит">
                    <span className={styles.lockHint}>из каталога</span>
                  </Tooltip>
                )}
                {level !== 'generation' && <RightOutlined className={styles.chevron} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CarCatalogEditor: React.FC = () => {
  const [marks, setMarks] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [generations, setGenerations] = useState<CarGeneration[]>([]);

  const [markId, setMarkId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);

  const [loadingMarks, setLoadingMarks] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);

  const [manualOnly, setManualOnly] = useState(false);

  const [editor, setEditor] = useState<{ level: Level; item: AnyItem | null } | null>(null);
  const [form] = Form.useForm<CatalogItemInput>();
  const [saving, setSaving] = useState(false);
  // Отдельным стейтом, чтобы предпросмотр перерисовывался по мере ввода ссылки
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBroken, setPhotoBroken] = useState(false);

  const loadMarks = useCallback(async () => {
    setLoadingMarks(true);
    try {
      setMarks(await carsApi.getBrands());
    } catch {
      message.error('Не удалось загрузить марки');
    } finally {
      setLoadingMarks(false);
    }
  }, []);

  const loadModels = useCallback(async (mark: string) => {
    setLoadingModels(true);
    try {
      setModels(await carsApi.getModels(mark));
    } catch {
      message.error('Не удалось загрузить модели');
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const loadGenerations = useCallback(async (mark: string, model: string) => {
    setLoadingGenerations(true);
    try {
      setGenerations(await carsApi.getGenerations(mark, model));
    } catch {
      message.error('Не удалось загрузить поколения');
      setGenerations([]);
    } finally {
      setLoadingGenerations(false);
    }
  }, []);

  useEffect(() => { loadMarks(); }, [loadMarks]);

  const selectMark = (id: string) => {
    setMarkId(id);
    setModelId(null);
    setGenerations([]);
    loadModels(id);
  };

  const selectModel = (id: string) => {
    setModelId(id);
    if (markId) loadGenerations(markId, id);
  };

  const openEditor = (level: Level, item: AnyItem | null) => {
    setEditor({ level, item });
    const photo = level === 'generation' ? (item as CarGeneration | null)?.photo ?? null : null;
    form.setFieldsValue({
      name: item?.name ?? '',
      yearFrom: item?.year_from ?? null,
      yearTo: item?.year_to ?? null,
      photo,
    });
    setPhotoPreview(photo);
  };

  const closeEditor = () => {
    setEditor(null);
    form.resetFields();
    setPhotoPreview(null);
    setPhotoBroken(false);
  };

  const handleSubmit = async (values: CatalogItemInput) => {
    if (!editor) return;
    const payload: CatalogItemInput = {
      name: values.name.trim(),
      yearFrom: values.yearFrom ?? null,
      yearTo: values.yearTo ?? null,
    };
    const { level, item } = editor;
    if (level === 'generation') payload.photo = values.photo?.trim() || null;

    setSaving(true);
    try {
      if (level === 'mark') {
        if (item) await carsApi.updateMark(item.id, payload);
        else await carsApi.createMark(payload);
        await loadMarks();
      } else if (level === 'model' && markId) {
        if (item) await carsApi.updateModel(markId, item.id, payload);
        else await carsApi.createModel(markId, payload);
        await loadModels(markId);
      } else if (level === 'generation' && markId && modelId) {
        if (item) await carsApi.updateGeneration(markId, modelId, item.id, payload);
        else await carsApi.createGeneration(markId, modelId, payload);
        await loadGenerations(markId, modelId);
      }
      message.success(item ? 'Изменения сохранены' : 'Запись добавлена');
      closeEditor();
    } catch (e) {
      message.error((e as Error).message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (level: Level, item: AnyItem) => {
    try {
      if (level === 'mark') {
        await carsApi.deleteMark(item.id);
        if (markId === item.id) { setMarkId(null); setModelId(null); setModels([]); setGenerations([]); }
        await loadMarks();
      } else if (level === 'model' && markId) {
        await carsApi.deleteModel(markId, item.id);
        if (modelId === item.id) { setModelId(null); setGenerations([]); }
        await loadModels(markId);
      } else if (level === 'generation' && markId && modelId) {
        await carsApi.deleteGeneration(markId, modelId, item.id);
        await loadGenerations(markId, modelId);
      }
      message.success('Удалено');
    } catch (e) {
      message.error((e as Error).message || 'Не удалось удалить');
    }
  };

  const selectedMark = marks.find(m => m.id === markId);
  const selectedModel = models.find(m => m.id === modelId);
  const manualMarkCount = marks.filter(m => m.source === 'MANUAL').length;

  return (
    <div className={styles.wrapper}>
      <Alert
        type="info"
        showIcon
        className={styles.hint}
        message="Легковые марки приходят из внешнего каталога и доступны только для чтения"
        description="Грузовые и всё, чего в каталоге нет, добавляйте здесь вручную — такие записи помечаются меткой «вручную» и не стираются при обновлении каталога."
      />

      <div className={styles.toolbar}>
        <Button
          size="small"
          type={manualOnly ? 'primary' : 'default'}
          onClick={() => setManualOnly(v => !v)}
        >
          {manualOnly ? 'Показаны только добавленные' : 'Только добавленные вручную'}
        </Button>
        {manualMarkCount > 0 && (
          <span className={styles.toolbarNote}>вручную заведено марок: {manualMarkCount}</span>
        )}
      </div>

      <div className={styles.columns}>
        <Column
          level="mark"
          title="Марка"
          items={marks}
          loading={loadingMarks}
          disabled={false}
          selectedId={markId}
          manualOnly={manualOnly}
          onSelect={selectMark}
          onAdd={() => openEditor('mark', null)}
          onEdit={item => openEditor('mark', item)}
          onDelete={item => handleDelete('mark', item)}
        />
        <Column
          level="model"
          title={selectedMark ? `Модели · ${selectedMark.name}` : 'Модели'}
          items={models}
          loading={loadingModels}
          disabled={!markId}
          selectedId={modelId}
          manualOnly={manualOnly}
          onSelect={selectModel}
          onAdd={() => openEditor('model', null)}
          onEdit={item => openEditor('model', item)}
          onDelete={item => handleDelete('model', item)}
        />
        <Column
          level="generation"
          title={selectedModel ? `Поколения · ${selectedModel.name}` : 'Поколения'}
          items={generations}
          loading={loadingGenerations}
          disabled={!modelId}
          selectedId={null}
          manualOnly={manualOnly}
          onSelect={() => {}}
          onAdd={() => openEditor('generation', null)}
          onEdit={item => openEditor('generation', item)}
          onDelete={item => handleDelete('generation', item)}
        />
      </div>

      <Modal
        open={!!editor}
        title={editor
          ? `${editor.item ? 'Изменить' : 'Добавить'} ${LEVEL_LABELS[editor.level].one}`
          : ''}
        onCancel={closeEditor}
        onOk={() => form.submit()}
        okText={editor?.item ? 'Сохранить' : 'Добавить'}
        okButtonProps={{ loading: saving }}
        cancelText="Отмена"
        destroyOnHidden
        width={420}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className={styles.form}>
          <Form.Item
            label="Название"
            name="name"
            rules={[{ required: true, message: 'Укажите название' }]}
          >
            <Input
              autoFocus
              placeholder={editor?.level === 'mark' ? 'Например: КамАЗ'
                : editor?.level === 'model' ? 'Например: 5490'
                  : 'Например: I поколение'}
            />
          </Form.Item>

          <div className={styles.yearRow}>
            <Form.Item label="Год начала" name="yearFrom">
              <InputNumber min={1900} max={2100} precision={0} placeholder="не важно" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Год окончания" name="yearTo">
              <InputNumber min={1900} max={2100} precision={0} placeholder="выпускается" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className={styles.formHint}>
            Годы указывать не обязательно. Если заполните — в карточке записи год авто
            можно будет выбрать из этого диапазона.
          </div>

          {editor?.level === 'generation' && (
            <>
              <Form.Item
                label="Ссылка на фото"
                name="photo"
                className={styles.photoField}
                rules={[{
                  validator: (_, value?: string) => {
                    const url = value?.trim();
                    if (!url) return Promise.resolve();
                    return /^https?:\/\/\S+$/i.test(url)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Ссылка должна начинаться с http:// или https://'));
                  },
                }]}
              >
                <Input
                  allowClear
                  placeholder="https://example.com/truck.jpg"
                  onChange={e => {
                    const url = e.target.value.trim();
                    setPhotoPreview(url || null);
                    setPhotoBroken(false);
                  }}
                />
              </Form.Item>

              <div className={styles.photoBox}>
                {photoPreview && !photoBroken ? (
                  <img
                    src={photoPreview}
                    alt="Предпросмотр"
                    className={styles.photoPreview}
                    onError={() => setPhotoBroken(true)}
                  />
                ) : (
                  <div className={styles.photoEmpty}>
                    {photoBroken ? 'Картинка не загрузилась — проверьте ссылку' : 'Фото не задано'}
                  </div>
                )}
              </div>

              <div className={styles.formHint}>
                Это фото показывается на карточке записи и при выборе авто.
                Нужна прямая ссылка на картинку, а не на страницу с ней.
              </div>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};
