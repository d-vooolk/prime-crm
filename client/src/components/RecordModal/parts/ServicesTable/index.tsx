import React from 'react';
import { Select, InputNumber, Button, Table, Tag, Space, Tooltip } from 'antd';
import cn from 'classnames';
import { DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import { formatPrice } from '@/utils/formatters';
import { SelectedService, ServiceRowContext } from '../../types';
import { ServicesTotals as Totals, groupThousands } from '../../calc';
import { PrepayTag } from '../PrepayTag';
import { ItemServiceman, SplitButton } from '../ItemServiceman';
import { ServicesTotals } from '../ServicesTotals';
import styles from './ServicesTable.module.scss';

interface Props {
  services: SelectedService[];
  totals: Totals;
  ctx: ServiceRowContext;
}

/** Таблица выбранных услуг (десктоп) */
export const ServicesTable: React.FC<Props> = ({ services, totals, ctx }) => {
  const hasEmployees = ctx.employeeOptions.length > 0;

  const columns = [
    {
      title: 'Услуга',
      dataIndex: 'serviceName',
      key: 'name',
      render: (name: string, row: SelectedService) => (
        <div>
          <div className={styles.name}>{name}</div>
          <Tag className={styles.categoryTag}>{row.categoryName}</Tag>
          <PrepayTag row={row} />
          {row.hasEquipment && (
            <Select
              size="small"
              className={styles.equipment}
              placeholder="Выберите Bi-Led модуль..."
              value={row.equipmentId || undefined}
              onChange={v => ctx.update(row.serviceId, { equipmentId: v })}
              allowClear
              onClear={() => ctx.update(row.serviceId, { equipmentId: undefined })}
              options={ctx.equipmentOptions}
              optionFilterProp="label"
              showSearch
              popupMatchSelectWidth={false}
            />
          )}
        </div>
      ),
    },
    {
      title: 'Кол-во',
      key: 'quantity',
      width: 100,
      render: (_: unknown, row: SelectedService) => (
        <InputNumber
          min={1}
          max={99}
          value={row.quantity}
          onChange={v => ctx.update(row.serviceId, { quantity: v || 1 })}
          size="small"
          controls
          className={styles.quantity}
        />
      ),
    },
    {
      title: 'Цена',
      key: 'price',
      width: 140,
      render: (_: unknown, row: SelectedService) => (
        <Space.Compact size="small">
          <InputNumber
            min={0}
            value={row.price}
            onChange={v => ctx.update(row.serviceId, { price: v || 0 })}
            className={styles.price}
            formatter={groupThousands}
          />
          <span className={styles.currency}>р.</span>
        </Space.Compact>
      ),
    },
    {
      title: 'Итого',
      key: 'total',
      width: 110,
      render: (_: unknown, row: SelectedService) => (
        <span className={styles.rowTotal}>{formatPrice(row.price * row.quantity)}</span>
      ),
    },
    {
      title: '',
      key: 'prepay',
      width: 36,
      render: (_: unknown, row: SelectedService) => (
        <Tooltip title={ctx.prepaymentLocked ? 'Предоплата недоступна для закрытых записей' : 'Предоплата'}>
          <Button
            type="text"
            icon={<DollarOutlined />}
            size="small"
            disabled={ctx.prepaymentLocked}
            onClick={() => ctx.openPrepay(row)}
            className={cn({ [styles.prepaid]: (row.prepaidAmount || 0) > 0 })}
          />
        </Tooltip>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 36,
      render: (_: unknown, row: SelectedService) => (
        <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => ctx.remove(row.serviceId)} />
      ),
    },
  ];

  return (
    <Table
      className={styles.table}
      dataSource={services}
      columns={columns}
      rowKey="serviceId"
      pagination={false}
      size="small"
      footer={() => <ServicesTotals totals={totals} />}
      expandable={{
        // Выбор сотрудника — отдельной строкой под услугой, всегда раскрыт.
        // У товаров назначения нет, поэтому строку им не показываем.
        showExpandColumn: false,
        expandedRowKeys: hasEmployees ? services.filter(s => !s.isProduct).map(s => s.serviceId) : [],
        expandedRowRender: (row: SelectedService) => (
          <div className={styles.servicemanRow}>
            <span className={styles.servicemanLabel}>Сотрудник:</span>
            <div className={styles.servicemanControl}><ItemServiceman row={row} ctx={ctx} /></div>
            <SplitButton row={row} ctx={ctx} />
          </div>
        ),
      }}
    />
  );
};
