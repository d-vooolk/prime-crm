import React from 'react';
import { Divider } from 'antd';
import cn from 'classnames';
import styles from './SectionDivider.module.scss';

interface Props {
  children?: React.ReactNode;
  /** Приглушённый цвет заголовка (в форме); в итоге — обычный */
  muted?: boolean;
}

/** Заголовок раздела формы записи */
export const SectionDivider: React.FC<Props> = ({ children, muted = true }) => (
  <Divider orientation="left" className={cn(styles.divider, { [styles.muted]: muted })}>
    {children}
  </Divider>
);
