import React from 'react';
import { Button, Select, Tag, Tooltip } from 'antd';
import cn from 'classnames';
import { TeamOutlined } from '@ant-design/icons';
import { formatPrice } from '@/utils/formatters';
import { SelectedService, ServiceRowContext } from '../../types';
import { hasSplit } from '../../calc';
import styles from './ItemServiceman.module.scss';

interface Props {
  row: SelectedService;
  ctx: ServiceRowContext;
}

/** Кнопка «разделить работу между сотрудниками» — рядом с названием услуги */
export const SplitButton: React.FC<Props> = ({ row, ctx }) => {
  if (!ctx.employeeOptions.length || row.isProduct) return null;
  return (
    <Tooltip title="Разделить между сотрудниками">
      <Button
        type="text"
        size="small"
        className={styles.iconButton}
        icon={<TeamOutlined className={cn(styles.splitIcon, { [styles.splitIconActive]: !!row.servicemanSplit?.length })} />}
        onClick={() => ctx.openSplit(row)}
      />
    </Tooltip>
  );
};

/**
 * Выбор сотрудника по услуге. Пока сотрудник не выбран явно, показываем
 * основного мастера записи с первого шага — он и попадёт в закрытие сделки.
 */
export const ItemServiceman: React.FC<Props> = ({ row, ctx }) => {
  if (row.isProduct) {
    return <Tag color="orange" className={styles.tag}>Товар</Tag>;
  }
  if (hasSplit(row)) {
    const split = row.servicemanSplit!;
    return (
      <div className={styles.split}>
        <Tooltip title={split.map(e => `${e.name}: ${formatPrice(e.amount)}`).join(' / ')}>
          <Tag color="blue" className={cn(styles.tag, styles.clickable)} onClick={() => ctx.openSplit(row)}>
            {split.map(e => e.name).join(', ')}
          </Tag>
        </Tooltip>
        <Button type="text" size="small" className={styles.cancelSplit} onClick={() => ctx.cancelSplit(row.serviceId)}>
          ✕
        </Button>
      </div>
    );
  }
  return (
    <Select
      size="small"
      className={styles.select}
      value={row.servicemanName || ctx.defaultServiceman || undefined}
      placeholder="Сотрудник"
      onChange={(v?: string) => ctx.update(row.serviceId, { servicemanName: v ?? null, servicemanSplit: null })}
      options={ctx.employeeOptions}
      optionFilterProp="label"
      showSearch
      popupMatchSelectWidth={false}
      allowClear
    />
  );
};
