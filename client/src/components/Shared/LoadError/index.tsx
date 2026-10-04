import React from 'react';
import { Alert, Button } from 'antd';
import { getErrorMessage } from '@/utils/errors';
import styles from './LoadError.module.scss';

interface Props {
  title?: string;
  error: unknown;
  onRetry: () => void;
}

/** Общая заглушка для страниц и вкладок. Ошибка загрузки списка — вместо пустой таблицы, которую легко принять за «данных нет» */
export const LoadError: React.FC<Props> = ({ title = 'Не удалось загрузить данные', error, onRetry }) => (
  <Alert
    className={styles.alert}
    type="error"
    showIcon
    message={title}
    description={getErrorMessage(error)}
    action={<Button size="small" onClick={onRetry}>Повторить</Button>}
  />
);
