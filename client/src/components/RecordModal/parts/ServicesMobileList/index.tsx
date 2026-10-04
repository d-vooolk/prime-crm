import React from 'react';
import { Select, InputNumber, Button, Space } from 'antd';
import cn from 'classnames';
import { DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import { formatPrice } from '@/utils/formatters';
import { SelectedService, ServiceRowContext } from '../../types';
import { ServicesTotals as Totals, groupThousands } from '../../calc';
import { PrepayTag } from '../PrepayTag';
import { ItemServiceman, SplitButton } from '../ItemServiceman';
import { ServicesTotals } from '../ServicesTotals';
import styles from './ServicesMobileList.module.scss';

interface Props {
  services: SelectedService[];
  totals: Totals;
  ctx: ServiceRowContext;
}

/** Выбранные услуги карточками (телефон) */
export const ServicesMobileList: React.FC<Props> = ({ services, totals, ctx }) => {
  const hasEmployees = ctx.employeeOptions.length > 0;

  return (
    <>
      <div className={styles.list}>
        {services.map(row => (
          <div key={row.serviceId} className={styles.card}>
            <div className={styles.header}>
              <div className={styles.info}>
                <div className={styles.name}>{row.serviceName}</div>
                <div className={styles.category}>{row.categoryName}</div>
                <PrepayTag row={row} />
              </div>
              <SplitButton row={row} ctx={ctx} />
              <Space size={4}>
                {!ctx.prepaymentLocked && (
                  <Button
                    type="text"
                    icon={<DollarOutlined />}
                    size="small"
                    onClick={() => ctx.openPrepay(row)}
                    className={cn({ [styles.prepaid]: (row.prepaidAmount || 0) > 0 })}
                  />
                )}
                <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => ctx.remove(row.serviceId)} />
              </Space>
            </div>
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
                showSearch
              />
            )}
            {hasEmployees && (
              <div className={styles.serviceman}>
                <span className={styles.label}>Сотрудник:</span>
                <div className={styles.servicemanValue}><ItemServiceman row={row} ctx={ctx} /></div>
              </div>
            )}
            <div className={styles.controls}>
              <span className={styles.label}>Кол-во:</span>
              <InputNumber
                min={1} max={99}
                value={row.quantity}
                onChange={v => ctx.update(row.serviceId, { quantity: v || 1 })}
                size="small"
                controls
                className={styles.quantity}
              />
              <span className={styles.label}>Цена:</span>
              <InputNumber
                min={0}
                value={row.price}
                onChange={v => ctx.update(row.serviceId, { price: v || 0 })}
                size="small"
                className={styles.price}
                formatter={groupThousands}
              />
              <span className={styles.label}>р.</span>
              <span className={styles.total}>{formatPrice(row.price * row.quantity)}</span>
            </div>
          </div>
        ))}
      </div>
      <ServicesTotals totals={totals} compact />
    </>
  );
};
