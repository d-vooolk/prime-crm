import React from 'react';
import { Tooltip } from 'antd';
import { CrownOutlined, StarOutlined, ToolOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { Serviceman, ServicemanBadgeType } from '@/types';
import styles from './ServicemanBadge.module.scss';

/** Значки сотрудников: назначаются в Настройках → Сотрудники, видны в списках выбора исполнителя */
export const SERVICEMAN_BADGES: { value: ServicemanBadgeType; label: string; icon: React.ReactNode; className: string }[] = [
  { value: 'EMPLOYEE', label: 'Сотрудник', icon: <ToolOutlined />, className: styles.employee },
  { value: 'ADMIN', label: 'Администратор', icon: <CrownOutlined />, className: styles.admin },
  { value: 'OTHER', label: 'Другое', icon: <StarOutlined />, className: styles.other },
];

interface Props {
  badge?: ServicemanBadgeType | null;
}

export const ServicemanBadge: React.FC<Props> = ({ badge }) => {
  const meta = SERVICEMAN_BADGES.find(b => b.value === badge);
  if (!meta) return null;
  return (
    <Tooltip title={meta.label}>
      <span className={cn(styles.badge, meta.className)} aria-label={meta.label}>{meta.icon}</span>
    </Tooltip>
  );
};

/** Пункт списка выбора исполнителя: label — строка, чтобы работал поиск по ФИО */
export interface ServicemanOption {
  value: string;
  label: string;
  badge?: ServicemanBadgeType | null;
}

export const toServicemanOption = (s: Pick<Serviceman, 'name' | 'badge'>): ServicemanOption => ({
  value: s.name,
  label: s.name,
  badge: s.badge ?? null,
});

/** optionRender / labelRender для Select: ФИО со значком */
export const renderServicemanOption = (option: { label?: React.ReactNode; data?: ServicemanOption; value?: string | number }) => {
  const badge = option.data?.badge;
  return (
    <span className={styles.option}>
      <ServicemanBadge badge={badge} />
      <span className={styles.name}>{option.label ?? option.value}</span>
    </span>
  );
};

/** labelRender для Select: выбранное ФИО со значком (labelRender не получает данные пункта) */
export const servicemanLabelRender = (options: ServicemanOption[]) =>
  (props: { label?: React.ReactNode; value?: string | number }) => {
    const option = options.find(o => o.value === props.value);
    return renderServicemanOption({ label: props.label, value: props.value, data: option });
  };
