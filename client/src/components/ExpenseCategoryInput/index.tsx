import React, { useMemo } from 'react';
import { AutoComplete } from 'antd';
import { useExpenseCategories } from '@/hooks/useReferenceData';
import styles from './ExpenseCategoryInput.module.scss';

interface ExpenseCategoryInputProps {
  // value/onChange передаёт Form.Item
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

/**
 * Поле «Категория затрат» с подсказками из справочника.
 * Можно вписать новое название — категория создастся на сервере при сохранении расхода.
 */
export const ExpenseCategoryInput: React.FC<ExpenseCategoryInputProps> = ({
  value, onChange, placeholder = 'Например: расходники',
}) => {
  // Подсказки не обязательны: при ошибке загрузки поле работает как обычный ввод (уведомление покажет QueryErrorReporter)
  const { data: categories = [] } = useExpenseCategories();

  const query = (value ?? '').trim().toLowerCase();
  const options = useMemo(() => {
    const matched = query
      ? categories.filter(c => c.name.toLowerCase().includes(query))
      : categories;
    return matched.map(c => ({ value: c.name, label: c.name }));
  }, [categories, query]);

  const isNew = !!query && !categories.some(c => c.name.toLowerCase() === query);

  return (
    <AutoComplete
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      allowClear
      className={styles.input}
      notFoundContent={isNew ? `Новая категория «${value?.trim()}» будет создана` : undefined}
    />
  );
};
