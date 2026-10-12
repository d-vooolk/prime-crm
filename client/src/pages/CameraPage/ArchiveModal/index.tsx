import React, { useEffect, useState } from 'react';
import { Alert, Button, DatePicker, Empty, Modal, Spin, Tag } from 'antd';
import { DownloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { cameraApi, CameraArchiveRange } from '@/api/camera.api';
import { getErrorMessage } from '@/utils/errors';
import { ARCHIVE_MAX_HOURS, archiveRangeError, formatArchiveRange, overlapsArchive } from '../archive.utils';
import styles from './ArchiveModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Range = [Dayjs | null, Dayjs | null] | null;

/** Архив камеры: какие промежутки записаны, просмотр и скачивание выбранного промежутка */
export const ArchiveModal: React.FC<Props> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ranges, setRanges] = useState<CameraArchiveRange[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [value, setValue] = useState<Range>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  // Список записей и свежий токен просмотра — при каждом открытии
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPlayUrl(null);
    Promise.all([cameraApi.getArchive(), cameraApi.getSession()])
      .then(([list, session]) => {
        if (cancelled) return;
        setRanges(list);
        setToken(session.token);
        setLoadError(null);
      })
      .catch(e => { if (!cancelled) setLoadError(getErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const start = value?.[0] ?? null;
  const end = value?.[1] ?? null;
  const rangeError = value ? archiveRangeError(start, end) : null;
  const noRecording = !rangeError && start && end && !overlapsArchive(ranges, start, end);
  const canExport = !!token && !!start && !!end && !rangeError && !noRecording;

  const fileUrl = (inline: boolean) =>
    cameraApi.archiveFileUrl(token!, start!.toISOString(), end!.toISOString(), inline);

  // Клик по записанному промежутку подставляет его (длинный — последние 4 часа)
  const pickRange = (range: CameraArchiveRange) => {
    const rangeEnd = dayjs(range.end);
    const earliest = rangeEnd.subtract(ARCHIVE_MAX_HOURS, 'hour');
    const rangeStart = dayjs(range.start).isAfter(earliest) ? dayjs(range.start) : earliest;
    setValue([rangeStart.second(0).millisecond(0), rangeEnd.second(0).millisecond(0)]);
    setPlayUrl(null);
  };

  return (
    <Modal
      title="Архив камеры"
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        {loadError ? (
          <Alert type="error" showIcon message="Не удалось открыть архив" description={loadError} />
        ) : (
          <div className={styles.body}>
            <div className={styles.label}>Есть запись</div>
            {ranges.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Записей пока нет" />
            ) : (
              <div className={styles.ranges}>
                {[...ranges].reverse().map(r => (
                  <Tag key={r.start} className={styles.rangeTag} onClick={() => pickRange(r)}>
                    {formatArchiveRange(r)}
                  </Tag>
                ))}
              </div>
            )}

            <div className={styles.label}>Промежуток (не больше {ARCHIVE_MAX_HOURS} часов)</div>
            <DatePicker.RangePicker
              className={styles.picker}
              showTime={{ format: 'HH:mm' }}
              format="DD.MM.YYYY HH:mm"
              value={value}
              onChange={v => { setValue(v); setPlayUrl(null); }}
              disabledDate={d => d.isAfter(dayjs(), 'day')}
              placeholder={['Начало', 'Конец']}
            />
            {rangeError && <div className={styles.error}>{rangeError}</div>}
            {noRecording && <div className={styles.error}>За этот промежуток записи нет</div>}

            <div className={styles.actions}>
              <Button
                icon={<PlayCircleOutlined />}
                disabled={!canExport}
                onClick={() => setPlayUrl(fileUrl(true))}
              >
                Смотреть
              </Button>
              {/* Обычная ссылка: файл скачивает браузер, без загрузки в память страницы */}
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                disabled={!canExport}
                href={canExport ? fileUrl(false) : undefined}
              >
                Скачать
              </Button>
            </div>

            {playUrl && (
              <video key={playUrl} className={styles.video} src={playUrl} controls autoPlay playsInline />
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
};
