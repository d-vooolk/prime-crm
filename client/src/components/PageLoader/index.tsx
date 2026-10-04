import React from 'react';
import { Spin } from 'antd';
import styles from './PageLoader.module.scss';

/** Заглушка на время загрузки чанка страницы (React.lazy) */
export const PageLoader: React.FC = () => (
  <div className={styles.root}>
    <Spin size="large" />
  </div>
);
