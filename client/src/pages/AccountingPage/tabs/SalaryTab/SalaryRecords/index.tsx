import React from 'react';
import { Button, Empty, Spin, Table } from 'antd';
import { SalaryData, SalaryRecord } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { formatDate } from '../../../utils';
import { salaryColumns, salaryItemColumns, TransferIcon, transferTitle } from '../../../columns/salaryColumns';
import styles from './SalaryRecords.module.scss';

interface Props {
  salaryData: SalaryData;
  loading: boolean;
  isMobile: boolean;
  canSeeClientName: boolean;
  canTransfer: boolean;
  onTransfer: (row: SalaryRecord) => void;
}

/**
 * Записи, за которые начислена ЗП. На телефоне пять столбцов с раскрытием не помещаются —
 * список карточек, услуги по записи показываем сразу, без раскрытия.
 */
export const SalaryRecords: React.FC<Props> = ({ salaryData, loading, isMobile, canSeeClientName, canTransfer, onTransfer }) => {
  if (isMobile) {
    return (
      <Spin spinning={loading}>
        <div className={styles.salaryList}>
          {salaryData.records.map(row => (
            <div key={row.recordId} className={styles.salaryCard}>
              <div className={styles.salaryCardTop}>
                <div className={styles.salaryCardInfo}>
                  {canSeeClientName && <div className={styles.salaryCardName}>{row.clientName}</div>}
                  <div className={canSeeClientName ? styles.salaryCardSub : styles.salaryCardName}>{row.carInfo}</div>
                </div>
                <div className={styles.salaryCardRight}>
                  <strong className={styles.salaryCardPayment}>{formatPrice(row.totalPayment)}</strong>
                  {canTransfer && (
                    <Button
                      type="text"
                      size="small"
                      icon={<TransferIcon row={row} />}
                      title={transferTitle(row)}
                      onClick={() => onTransfer(row)}
                    />
                  )}
                </div>
              </div>
              <div className={styles.salaryCardMeta}>
                <span>{formatDate(row.closedAt)}</span>
                <span>Сумма: {formatPrice(row.totalNetProfit)}</span>
              </div>
              <div className={styles.salaryCardItems}>
                {row.items.map(item => (
                  <div key={item.serviceName} className={styles.salaryCardItem}>
                    <span className={styles.salaryCardItemName}>{item.serviceName}</span>
                    <span className={styles.salaryCardItemSum}>{formatPrice(item.netProfit)}</span>
                    <strong className={styles.salaryCardItemPayment}>{formatPrice(item.payment)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {salaryData.records.length === 0 && <Empty description="Нет данных за период" />}
        </div>
        <div className={styles.salaryCardsFooter}>
          База: <strong>{formatPrice(salaryData.totalPayment)}</strong>
        </div>
      </Spin>
    );
  }

  return (
    <Table<SalaryRecord>
      dataSource={salaryData.records}
      columns={salaryColumns({ canSeeClientName, canTransfer, onTransfer })}
      rowKey="recordId"
      size="small"
      pagination={false}
      loading={loading}
      expandable={{
        expandedRowRender: row => (
          <Table dataSource={row.items} rowKey="serviceName" size="small" pagination={false} columns={salaryItemColumns} />
        ),
      }}
      footer={() => (
        <div className={styles.tableFooter}>
          <span>База: <strong>{formatPrice(salaryData.totalPayment)}</strong></span>
        </div>
      )}
    />
  );
};
