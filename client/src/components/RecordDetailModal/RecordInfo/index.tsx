import React from 'react';
import { Button, Descriptions, Divider } from 'antd';
import { HistoryOutlined, BookOutlined, PictureOutlined } from '@ant-design/icons';
import type { Record } from '@/types';
import { formatDate, formatTime } from '@/utils/formatters';
import { clientSourceLabel } from '@/utils/clientSource';
import { RecordMediaGallery } from '@/components/RecordMediaGallery';
import { TWO_COLUMNS } from '@/config/descriptions';
import styles from './RecordInfo.module.scss';

interface Props {
  record: Record;
  isEmployee: boolean;
  onOpenHistory: () => void;
  onOpenWiki: () => void;
}

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
        <Descriptions.Item label="Источник клиента">{clientSourceLabel(r.clientSource)}</Descriptions.Item>
      )}
    </Descriptions>

    {r.notes && <p className={styles.notes}>📌 {r.notes}</p>}

    <RecordMediaGallery recordId={r.id} />
  </>
);
