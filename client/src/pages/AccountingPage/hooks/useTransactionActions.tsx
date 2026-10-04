import React, { useState } from 'react';
import { accountingApi } from '@/api/accounting.api';
import { CashTransaction } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { txActionColumns } from '../columns/cashColumns';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { useInvalidateAccounting } from './useAccountingData';

/**
 * Правка и удаление проводок кассы — общие для вкладок «Приходно-расходный» и «Приход РС».
 * Возвращает колонку действий для таблиц и модалку редактирования, которую нужно отрендерить.
 */
export function useTransactionActions(canEdit: boolean) {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await accountingApi.deleteCashTransaction(id);
      notify.toast.success('Запись удалена');
      // Удалённая проводка могла быть выплатой ЗП учредителю или сотруднику
      invalidate('cash', 'founderSalaries', 'salary');
    } catch (e) {
      notify.error(e, 'Не удалось удалить запись');
    }
  };

  return {
    actionColumns: txActionColumns(canEdit, setEditingTx, handleDelete),
    editModal: <EditTransactionModal tx={editingTx} onClose={() => setEditingTx(null)} />,
  };
}
