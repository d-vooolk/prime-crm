import React from 'react';
import { Button, Checkbox, Empty, Popconfirm, Space, Table, Tag } from 'antd';
import { EditOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { Serviceman } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { UNDISMISSABLE_ROLE } from '@/utils/roles';
import { birthdayInfo } from '../servicesPage.utils';
import styles from './ServicemanList.module.scss';

/** employees — активные сотрудники, dismissed — уволенные, receptionists — мастера приёмщики */
export type ServicemanListMode = 'employees' | 'dismissed' | 'receptionists';

interface Props {
  list: Serviceman[];
  mode: ServicemanListMode;
  isMobile: boolean;
  loading?: boolean;
  canEdit?: (row: Serviceman) => boolean;
  onEdit?: (row: Serviceman) => void;
  onDismiss?: (id: string) => void;
  onRestore?: (id: string) => void;
  onSetDefault?: (id: string) => void;
}

/** Отметки в списке сотрудников: исполнитель работ и мастер приёмщик */
const ServicemanFlags: React.FC<{ row: Serviceman }> = ({ row }) => (
  <>
    {row.isPerformer && <Tag color="purple" className={styles.tag}>Исполнитель</Tag>}
    {row.isReceptionist && <Tag color="cyan" className={styles.tag}>Приёмщик</Tag>}
  </>
);

const emptyColumn = (key: string) => ({ title: '', key, width: 0, render: () => null });

/** Сотрудники таблицей, а на телефоне — списком карточек (таблица из четырёх столбцов там не читается) */
export const ServicemanList: React.FC<Props> = ({
  list, mode, isMobile, loading, canEdit = () => false, onEdit, onDismiss, onRestore, onSetDefault,
}) => {
  const isReceptionist = mode === 'receptionists';
  const isDismissedList = mode === 'dismissed';
  const emptyText = isReceptionist ? 'Нет мастеров приёмщиков' : 'Нет сотрудников';

  const actions = (row: Serviceman) => {
    if (!canEdit(row)) return null;
    return (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit?.(row)} />
        {row.role !== UNDISMISSABLE_ROLE && (
          <Popconfirm
            title="Уволить сотрудника?"
            description="Сотрудник будет перемещён в список уволенных"
            onConfirm={() => onDismiss?.(row.id)}
            okText="Уволить"
            cancelText="Отмена"
          >
            <Button size="small" danger icon={<StopOutlined />} title="Уволить" />
          </Popconfirm>
        )}
      </Space>
    );
  };

  const restoreAction = (row: Serviceman) => {
    if (!canEdit(row)) return null;
    return (
      <Popconfirm
        title="Восстановить сотрудника?"
        description="Вернётся в активный список со всей историей по зарплате"
        onConfirm={() => onRestore?.(row.id)}
        okText="Восстановить"
        cancelText="Отмена"
      >
        <Button size="small" icon={<UndoOutlined />}>Восстановить</Button>
      </Popconfirm>
    );
  };

  const defaultCheckbox = (row: Serviceman, label?: React.ReactNode) => (
    <Checkbox
      checked={row.isDefault}
      onChange={() => { if (!row.isDefault) onSetDefault?.(row.id); }}
    >
      {label}
    </Checkbox>
  );

  if (isMobile) {
    if (list.length === 0) return <Empty description={emptyText} />;
    return (
      <div className={styles.mobileList}>
        {list.map(row => {
          const bd = birthdayInfo(row.birthday);
          return (
            <div key={row.id} className={cn(styles.mobileCard, { [styles.mobileCardDimmed]: isDismissedList })}>
              <div className={styles.mobileCardTop}>
                <div className={styles.mobileCardInfo}>
                  <div className={styles.mobileCardName}>
                    <span>{row.name}</span>
                    {row.role && <Tag className={styles.tag}>{row.role}</Tag>}
                  </div>
                  {row.position && <div className={styles.mobileCardSub}>{row.position}</div>}
                </div>
                {isReceptionist ? null : isDismissedList ? restoreAction(row) : actions(row)}
              </div>
              <div className={styles.mobileCardMeta}>
                {!isReceptionist && <ServicemanFlags row={row} />}
                {!isReceptionist && (row.baseSalary ?? 0) > 0 && (
                  <Tag color="blue" className={styles.tag}>оклад {formatPrice(row.baseSalary!)}</Tag>
                )}
                {!isReceptionist && row.profitPercent > 0 && (
                  <Tag color="green" className={styles.tag}>{row.profitPercent}% прибыли</Tag>
                )}
                {bd && (
                  <span className={bd.isToday ? styles.birthdayToday : styles.mobileCardSub}>
                    🎂 {bd.text}{bd.isToday && ' — сегодня!'}
                  </span>
                )}
                {isReceptionist && !isDismissedList
                  && defaultCheckbox(row, <span className={styles.mobileCardSub}>По умолчанию</span>)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const dash = <span className={styles.muted}>—</span>;

  const columns = [
    {
      title: 'ФИО',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: Serviceman) => (
        <div>
          <div className={styles.nameRow}>
            <span className={styles.strong}>{name}</span>
            {row.role && <Tag className={styles.tag}>{row.role}</Tag>}
          </div>
          {row.position && <div className={styles.position}>{row.position}</div>}
          {!isReceptionist && <div className={styles.flags}><ServicemanFlags row={row} /></div>}
        </div>
      ),
    },
    !isReceptionist ? {
      title: 'Оклад',
      key: 'baseSalary',
      width: 110,
      render: (_: unknown, row: Serviceman) => ((row.baseSalary ?? 0) > 0 ? formatPrice(row.baseSalary!) : dash),
    } : emptyColumn('emptySalary'),
    !isReceptionist ? {
      title: '% прибыли',
      key: 'profitPercent',
      width: 110,
      render: (_: unknown, row: Serviceman) => (row.profitPercent > 0 ? <Tag color="green">{row.profitPercent}%</Tag> : dash),
    } : emptyColumn('emptyProfit'),
    {
      title: 'День рождения',
      key: 'birthday',
      width: 130,
      render: (_: unknown, row: Serviceman) => {
        const bd = birthdayInfo(row.birthday);
        if (!bd) return dash;
        return (
          <span className={bd.isToday ? styles.birthdayTodayCell : undefined}>
            {bd.text}
            {bd.isToday && ' (сегодня!)'}
          </span>
        );
      },
    },
    isReceptionist && !isDismissedList ? {
      title: 'По умолчанию',
      key: 'default',
      width: 130,
      render: (_: unknown, row: Serviceman) => defaultCheckbox(row),
    } : emptyColumn('empty'),
    isReceptionist ? emptyColumn('emptyActions') : {
      title: '', key: 'actions', width: isDismissedList ? 150 : 120,
      render: (_: unknown, row: Serviceman) => (isDismissedList ? restoreAction(row) : actions(row)),
    },
  ];

  return (
    <Table
      dataSource={list}
      rowKey="id"
      size="middle"
      pagination={false}
      loading={loading}
      columns={columns}
      locale={{ emptyText }}
      rowClassName={isDismissedList ? () => 'ant-table-row-dimmed' : undefined}
      scroll={isReceptionist ? { x: 'max-content' } : undefined}
    />
  );
};
