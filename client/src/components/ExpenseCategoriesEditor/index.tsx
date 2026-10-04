import React, { useState } from 'react';
import { Alert, Button, Input, Popconfirm, Table, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { expensesApi, ExpenseCategory } from '@/api/expenses.api';
import { useNotify } from '@/hooks/useNotify';
import { useExpenseCategories, useInvalidateReference } from '@/hooks/useReferenceData';
import { getErrorMessage } from '@/utils/errors';
import styles from './ExpenseCategoriesEditor.module.scss';

interface ExpenseCategoriesEditorProps {
  // Сотрудник видит список, но не правит его
  readOnly?: boolean;
}

/** Справочник категорий затрат для расходов кассы (Настройки → Категории расходов). */
export const ExpenseCategoriesEditor: React.FC<ExpenseCategoriesEditorProps> = ({ readOnly }) => {
  const { data: categories = [], isLoading, isError, error, refetch } = useExpenseCategories();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = () => invalidate('expenseCategories');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await expensesApi.createCategory(name);
      setNewName('');
      await reload();
    } catch (e) { notify.error(e, 'Не удалось добавить категорию'); }
    finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await expensesApi.updateCategory(editingId, name);
      setEditingId(null);
      await reload();
    } catch (e) { notify.error(e, 'Не удалось переименовать категорию'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await expensesApi.deleteCategory(id);
      await reload();
    } catch (e) { notify.error(e, 'Не удалось удалить категорию'); }
  };

  const columns = [
    {
      title: 'Категория',
      key: 'name',
      render: (_: unknown, c: ExpenseCategory) => editingId === c.id ? (
        <Input
          value={editingName}
          onChange={e => setEditingName(e.target.value)}
          onPressEnter={handleRename}
          maxLength={60}
          autoFocus
        />
      ) : c.name,
    },
    {
      title: 'Расходов',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      align: 'right' as const,
    },
    ...(readOnly ? [] : [{
      title: '',
      key: 'actions',
      width: 88,
      render: (_: unknown, c: ExpenseCategory) => editingId === c.id ? (
        <div className={styles.actions}>
          <Button size="small" type="text" icon={<CheckOutlined />} loading={saving} onClick={handleRename} />
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setEditingId(null)} />
        </div>
      ) : (
        <div className={styles.actions}>
          <Tooltip title="Переименовать">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => { setEditingId(c.id); setEditingName(c.name); }}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить категорию?"
            description={c.usageCount > 0
              ? `У ${c.usageCount} расх. категория станет пустой, сами расходы останутся`
              : undefined}
            onConfirm={() => handleDelete(c.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    }]),
  ];

  return (
    <div className={styles.wrapper}>
      <p className={styles.hint}>
        Подсказки для поля «Категория» при списании денег из кассы. Новую категорию можно
        вписать прямо в форме расхода — она появится здесь автоматически.
      </p>
      {!readOnly && (
        <div className={styles.addRow}>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onPressEnter={handleAdd}
            placeholder="Новая категория"
            maxLength={60}
          />
          <Button type="primary" icon={<PlusOutlined />} loading={saving} disabled={!newName.trim()} onClick={handleAdd}>
            Добавить
          </Button>
        </div>
      )}
      {isError && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить категории расходов"
          description={getErrorMessage(error)}
          action={<Button size="small" onClick={() => refetch()}>Повторить</Button>}
        />
      )}
      <Table<ExpenseCategory>
        dataSource={categories}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={false}
      />
    </div>
  );
};
