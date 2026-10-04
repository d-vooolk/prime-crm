import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { carsApi, CatalogItemInput } from '@/api/cars.api';
import { CarModel, CarGeneration } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { useCarBrands, useInvalidateReference } from '@/hooks/useReferenceData';
import { isAbortError } from '@/utils/errors';
import { AnyItem, Level } from './catalog';
import { CatalogColumn } from './CatalogColumn';
import { CatalogEditorTarget, CatalogItemModal } from './CatalogItemModal';
import styles from './CarCatalogEditor.module.scss';

/**
 * Редактор справочника авто.
 *
 * Каскад из трёх колонок: марка → модель → поколение. Записи из каталога донора
 * (source=SNAPSHOT) доступны только для чтения — их всё равно перезапишет
 * очередная синхронизация. Редактировать и удалять можно только то, что
 * заведено руками: грузовые и прочее, чего у донора нет.
 */

/** Загрузка вложенного списка с отменой: при быстром переключении марок ответ по старой не затрёт новую */
function useCancellableList<T, A extends unknown[]>(fetcher: (...args: [...A, AbortSignal]) => Promise<T[]>, errorTitle: string) {
  const notify = useNotify();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (...args: A) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    try {
      setItems(await fetcher(...args, controller.signal));
    } catch (e) {
      if (isAbortError(e)) return;
      notify.error(e, errorTitle);
      setItems([]);
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }, [fetcher, errorTitle, notify]);

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    setItems([]);
    setLoading(false);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { items, loading, load, clear };
}

export const CarCatalogEditor: React.FC = () => {
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const { data: marks = [], isLoading: loadingMarks, isError: marksError, refetch: refetchMarks } = useCarBrands();
  const models = useCancellableList<CarModel, [string]>(carsApi.getModels, 'Не удалось загрузить модели');
  const generations = useCancellableList<CarGeneration, [string, string]>(carsApi.getGenerations, 'Не удалось загрузить поколения');

  const [markId, setMarkId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [manualOnly, setManualOnly] = useState(false);
  const [editor, setEditor] = useState<CatalogEditorTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const selectMark = (id: string) => {
    setMarkId(id);
    setModelId(null);
    generations.clear();
    models.load(id);
  };

  const selectModel = (id: string) => {
    setModelId(id);
    if (markId) generations.load(markId, id);
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
        // Марки — общий справочник: обновятся и в форме записи
        await invalidate('carBrands');
      } else if (level === 'model' && markId) {
        if (item) await carsApi.updateModel(markId, item.id, payload);
        else await carsApi.createModel(markId, payload);
        await models.load(markId);
      } else if (level === 'generation' && markId && modelId) {
        if (item) await carsApi.updateGeneration(markId, modelId, item.id, payload);
        else await carsApi.createGeneration(markId, modelId, payload);
        await generations.load(markId, modelId);
      }
      notify.toast.success(item ? 'Изменения сохранены' : 'Запись добавлена');
      setEditor(null);
    } catch (e) {
      notify.error(e, 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (level: Level, item: AnyItem) => {
    try {
      if (level === 'mark') {
        await carsApi.deleteMark(item.id);
        if (markId === item.id) { setMarkId(null); setModelId(null); models.clear(); generations.clear(); }
        await invalidate('carBrands');
      } else if (level === 'model' && markId) {
        await carsApi.deleteModel(markId, item.id);
        if (modelId === item.id) { setModelId(null); generations.clear(); }
        await models.load(markId);
      } else if (level === 'generation' && markId && modelId) {
        await carsApi.deleteGeneration(markId, modelId, item.id);
        await generations.load(markId, modelId);
      }
      notify.toast.success('Удалено');
    } catch (e) {
      notify.error(e, 'Не удалось удалить');
    }
  };

  const selectedMark = marks.find(m => m.id === markId);
  const selectedModel = models.items.find(m => m.id === modelId);
  const manualMarkCount = marks.filter(m => m.source === 'MANUAL').length;

  const columnHandlers = (level: Level) => ({
    level,
    manualOnly,
    onAdd: () => setEditor({ level, item: null }),
    onEdit: (item: AnyItem) => setEditor({ level, item }),
    onDelete: (item: AnyItem) => handleDelete(level, item),
  });

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
        <Button size="small" type={manualOnly ? 'primary' : 'default'} onClick={() => setManualOnly(v => !v)}>
          {manualOnly ? 'Показаны только добавленные' : 'Только добавленные вручную'}
        </Button>
        {manualMarkCount > 0 && (
          <span className={styles.toolbarNote}>вручную заведено марок: {manualMarkCount}</span>
        )}
      </div>

      <div className={styles.columns}>
        <CatalogColumn
          {...columnHandlers('mark')}
          title="Марка"
          items={marks}
          loading={loadingMarks}
          error={marksError}
          onRetry={() => refetchMarks()}
          disabled={false}
          selectedId={markId}
          onSelect={selectMark}
        />
        <CatalogColumn
          {...columnHandlers('model')}
          title={selectedMark ? `Модели · ${selectedMark.name}` : 'Модели'}
          items={models.items}
          loading={models.loading}
          disabled={!markId}
          selectedId={modelId}
          onSelect={selectModel}
        />
        <CatalogColumn
          {...columnHandlers('generation')}
          title={selectedModel ? `Поколения · ${selectedModel.name}` : 'Поколения'}
          items={generations.items}
          loading={generations.loading}
          disabled={!modelId}
          selectedId={null}
          onSelect={() => { /* поколение — последний уровень, выбирать нечего */ }}
        />
      </div>

      <CatalogItemModal
        target={editor}
        saving={saving}
        onCancel={() => setEditor(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
