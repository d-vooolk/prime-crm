import React from 'react';
import { LoadError } from '@/components/Shared/LoadError';

interface Props {
  /** Ошибки запросов вкладки; показывается первая */
  errors: unknown[];
  title?: string;
  onRetry: () => void;
}

/** Вкладка грузит несколько запросов — показываем первую ошибку общей заглушкой */
export const LoadErrorAlert: React.FC<Props> = ({ errors, title, onRetry }) => {
  const error = errors.find(Boolean);
  if (!error) return null;
  return <LoadError title={title} error={error} onRetry={onRetry} />;
};
