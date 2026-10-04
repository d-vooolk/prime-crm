import React from 'react';
import { Button, Result } from 'antd';
import styles from './ErrorBoundary.module.scss';

interface Props {
  children: React.ReactNode;
  /** При смене ключа (например, адреса страницы) ошибка сбрасывается — можно уйти в другой раздел */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** Ловит падения рендера, чтобы вместо белого экрана показать понятную заглушку. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Единственный способ увидеть причину на проде — консоль браузера
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.root}>
        <Result
          status="error"
          title="Что-то пошло не так"
          subTitle="Попробуйте обновить страницу. Если ошибка повторяется — сообщите администратору."
          extra={<Button type="primary" onClick={() => window.location.reload()}>Обновить страницу</Button>}
        />
      </div>
    );
  }
}
