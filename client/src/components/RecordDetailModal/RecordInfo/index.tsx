import React from 'react';
import { Button, Descriptions, Divider, Typography } from 'antd';
import { HistoryOutlined, BookOutlined, PictureOutlined, LinkOutlined } from '@ant-design/icons';
import { useCompanySettings } from '@/hooks/useReferenceData';
import type { Record } from '@/types';
import { formatDate, formatTime } from '@/utils/formatters';
import { RecordMediaGallery } from '@/components/RecordMediaGallery';
import { TWO_COLUMNS } from '@/config/descriptions';
import styles from './RecordInfo.module.scss';

interface Props {
  record: Record;
  isEmployee: boolean;
  onOpenHistory: () => void;
  onOpenWiki: () => void;
}

/**
 * Ссылка на страницу записи для клиента (zapis.prime-auto.by/<код>) — открыть или скопировать,
 * чтобы отправить вручную. Страница живёт, только пока запись активна.
 */
const ClientPageLink: React.FC<{ token: string }> = ({ token }) => {
  const { data: settings } = useCompanySettings();
  if (!settings?.publicRecordUrl) return null;
  const url = `${settings.publicRecordUrl}/${token}`;
  return (
    <div className={styles.clientPage}>
      <LinkOutlined />
      <Typography.Link href={url} target="_blank" rel="noreferrer noopener">Страница для клиента</Typography.Link>
      <Typography.Text copyable={{ text: url, tooltips: ['Скопировать ссылку', 'Скопировано'] }} />
    </div>
  );
};

/** Клиент, юрлицо, автомобиль и данные записи */
export const RecordInfo: React.FC<Props> = ({ record: r, isEmployee, onOpenHistory, onOpenWiki }) => (
  <>
    {/* Сотрудникам данные клиента и историю посещений не показываем */}
    {!isEmployee && (
      <>
        <Divider orientation="left" className={styles.divider}>Клиент</Divider>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label={r.isLegalEntity ? 'ФИО представителя' : 'ФИО'}>
            {r.client.name}
          </Descriptions.Item>
          <Descriptions.Item label="Телефон">
            <a href={`tel:${r.client.phone}`} rel="noreferrer noopener">
              {r.client.phone}
            </a>
          </Descriptions.Item>
        </Descriptions>
        <Button
          type="link"
          size="small"
          icon={<HistoryOutlined />}
          onClick={onOpenHistory}
          className={styles.linkButton}
        >
          История посещений клиента
        </Button>
        {r.status === 'ACTIVE' && r.publicToken && <ClientPageLink token={r.publicToken} />}
      </>
    )}

    {r.isLegalEntity && !isEmployee && (
      <>
        <Divider orientation="left" className={styles.divider}>Юридическое лицо</Divider>
        <Descriptions size="small" column={TWO_COLUMNS}>
          {r.legalCompanyName && (
            <Descriptions.Item label="Организация" span={2}>{r.legalCompanyName}</Descriptions.Item>
          )}
          {r.legalAddress && (
            <Descriptions.Item label="Юр. адрес" span={2}>{r.legalAddress}</Descriptions.Item>
          )}
          {r.legalUnp && <Descriptions.Item label="УНП">{r.legalUnp}</Descriptions.Item>}
          {r.legalBic && <Descriptions.Item label="БИК">{r.legalBic}</Descriptions.Item>}
          {r.legalOkpo && <Descriptions.Item label="ОКПО">{r.legalOkpo}</Descriptions.Item>}
          {r.legalPhone && <Descriptions.Item label="Телефон орг.">{r.legalPhone}</Descriptions.Item>}
          {r.legalEmail && <Descriptions.Item label="Email орг.">{r.legalEmail}</Descriptions.Item>}
        </Descriptions>
      </>
    )}

    <Divider orientation="left" className={styles.divider}>Автомобиль</Divider>
    <Descriptions size="small" column={TWO_COLUMNS}>
      <Descriptions.Item label="Марка / Модель">
        {r.car.brand} {r.car.model}
      </Descriptions.Item>
      <Descriptions.Item label="Год">{r.car.year}</Descriptions.Item>
      {r.car.generationName && (
        <Descriptions.Item label="Поколение">{r.car.generationName}</Descriptions.Item>
      )}
      {r.car.plateNumber && (
        <Descriptions.Item label="Гос. номер">{r.car.plateNumber}</Descriptions.Item>
      )}
    </Descriptions>

    <div className={styles.carLinks}>
      {/* Wiki по автомобилю — доступна всем ролям */}
      <Button type="link" size="small" icon={<BookOutlined />} className={styles.linkButton} onClick={onOpenWiki}>
        Wiki по автомобилю
      </Button>
      {/* Фото поколения из справочника — в новой вкладке, чтобы не закрывать запись */}
      {r.car.generationId && (
        <Button
          type="link"
          size="small"
          icon={<PictureOutlined />}
          className={styles.linkButton}
          href={`/api/cars/photo/${r.car.brandId}/${r.car.modelId}/${r.car.generationId}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Посмотреть авто
        </Button>
      )}
    </div>

    <Divider orientation="left" className={styles.divider}>Запись</Divider>
    <Descriptions size="small" column={TWO_COLUMNS}>
      <Descriptions.Item label="Принято">{formatDate(r.scheduledAt)}</Descriptions.Item>
      <Descriptions.Item label="Время">{formatTime(r.scheduledAt)}</Descriptions.Item>
      {r.serviceman && (
        <Descriptions.Item label="Сотрудник">{r.serviceman}</Descriptions.Item>
      )}
      {r.receptionist && (
        <Descriptions.Item label="Мастер приёмщик">{r.receptionist}</Descriptions.Item>
      )}
      {r.clientSource && !isEmployee && (
        <Descriptions.Item label="Источник клиента">{r.clientSource.name}</Descriptions.Item>
      )}
    </Descriptions>

    {r.notes && <p className={styles.notes}>📌 {r.notes}</p>}

    <RecordMediaGallery recordId={r.id} />
  </>
);
