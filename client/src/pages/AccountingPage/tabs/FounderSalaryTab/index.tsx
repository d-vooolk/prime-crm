import React from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { formatPrice } from '@/utils/formatters';
import { useFounderSalaries } from '../../hooks/useAccountingData';
import { usePersons } from '../../hooks/usePersons';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { FounderRow, summarizeFounderSalaries } from '../../utils';
import shared from '../../shared.module.scss';
import styles from './FounderSalaryTab.module.scss';

const amountCell = (v: number) => (v > 0
  ? <span className={styles.paid}>{formatPrice(v)}</span>
  : <span className={styles.none}>—</span>);

/** ЗП учредителей (директор и создатель) по месяцам и кто из них недополучил */
export const FounderSalaryTab: React.FC = () => {
  const query = useFounderSalaries(true);
  const { directorUser, creatorUser } = usePersons();
  const summary = summarizeFounderSalaries(query.data ?? [], directorUser?.name, creatorUser?.name);
  const lessFounder = summary.less === 'director' ? directorUser : creatorUser;

  const columns: ColumnsType<FounderRow> = [
    { title: 'Месяц', dataIndex: 'key', key: 'month', width: 120 },
    { title: directorUser?.name ?? 'Директор', key: 'director', render: (_, row) => amountCell(row.director) },
    { title: creatorUser?.name ?? 'Создатель', key: 'creator', render: (_, row) => amountCell(row.creator) },
  ];

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert errors={[query.error]} title="Не удалось загрузить ЗП учредителей" onRetry={() => query.refetch()} />
      <Table<FounderRow>
        dataSource={summary.rows}
        rowKey="key"
        size="small"
        pagination={false}
        loading={query.isLoading}
        locale={{ emptyText: 'Нет данных' }}
        columns={columns}
      />
      {summary.diff > 0 && lessFounder && (
        <div className={styles.diff}>
          <strong>{lessFounder.name}</strong> получил меньше на{' '}
          <strong className={styles.diffAmount}>{formatPrice(summary.diff)}</strong>
        </div>
      )}
    </div>
  );
};
