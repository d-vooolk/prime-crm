import React from 'react';
import { Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useCompanySettings } from '@/hooks/useReferenceData';
import styles from './ClientPageLink.module.scss';

interface Props {
  token: string;
}

/**
 * Ссылка на страницу записи для клиента (zapis.prime-auto.by/<код>).
 * Страница живёт, только пока запись активна.
 */
export const ClientPageLink: React.FC<Props> = ({ token }) => {
  const { data: settings } = useCompanySettings();
  if (!settings?.publicRecordUrl) return null;
  const url = `${settings.publicRecordUrl}/${token}`;
  return (
    <div className={styles.clientPage}>
      <LinkOutlined />
      <Typography.Link href={url} target="_blank" rel="noreferrer noopener">Страница для клиента</Typography.Link>
    </div>
  );
};
