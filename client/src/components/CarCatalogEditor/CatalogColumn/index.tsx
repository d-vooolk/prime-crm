import React, { useMemo, useState } from 'react';
import { Button, Empty, Input, Popconfirm, Spin, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { CarGeneration } from '@/types';
import { AnyItem, LEVEL_LABELS, Level, photoUrl, yearsLabel } from '../catalog';
import styles from './CatalogColumn.module.scss';

interface Props {
  level: Level;
  title: string;
  items: AnyItem[];
  loading: boolean;
  /** Список не загрузился — вместо пустой колонки показываем ошибку и «Повторить» */
  error?: boolean;
  onRetry?: () => void;
  disabled: boolean;
  selectedId: string | null;
  manualOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (item: AnyItem) => void;
  onDelete: (item: AnyItem) => void;
}

/** Одна колонка каскада «марка → модель → поколение» с поиском */
export const CatalogColumn: React.FC<Props> = ({
  level, title, items, loading, error, onRetry, disabled, selectedId, manualOnly, onSelect, onAdd, onEdit, onDelete,
}) => {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i => (!manualOnly || i.source === 'MANUAL') && (!q || i.name.toLowerCase().includes(q)));
  }, [items, query, manualOnly]);

  const showList = !loading && !disabled && !error;

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <span className={styles.columnTitle}>
          {title}
          {!disabled && <span className={styles.count}>{visible.length}</span>}
        </span>
        <Button size="small" type="primary" icon={<PlusOutlined />} disabled={disabled} onClick={onAdd}>
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
        {!loading && error && (
          <div className={styles.centered}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Не удалось загрузить">
              {onRetry && <Button size="small" onClick={onRetry}>Повторить</Button>}
            </Empty>
          </div>
        )}
        {!loading && !error && disabled && (
          <div className={styles.centered}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={LEVEL_LABELS[level].empty} />
          </div>
        )}
        {showList && visible.length === 0 && (
          <div className={styles.centered}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={query || manualOnly ? 'Ничего не найдено' : LEVEL_LABELS[level].empty}
            />
          </div>
        )}
        {showList && visible.map(item => {
          const isManual = item.source === 'MANUAL';
          const years = yearsLabel(item);
          const photo = level === 'generation' ? (item as CarGeneration).photo : null;
          return (
            <div
              key={item.id}
              className={cn(styles.row, { [styles.rowActive]: selectedId === item.id })}
              onClick={() => onSelect(item.id)}
            >
              {level === 'generation' && (
                photo
                  ? <img src={photoUrl(photo)} alt="" className={styles.thumb} loading="lazy" />
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
