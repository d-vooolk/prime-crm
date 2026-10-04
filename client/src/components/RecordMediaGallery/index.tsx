import React, { useCallback, useEffect, useState } from 'react';
import { Button, Divider, Empty, Image, Popconfirm, Progress, Spin, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { RecordMedia } from '@/types';
import { recordsApi } from '@/api/records.api';
import { useAuthStore } from '@/store/authStore';
import { useNotify } from '@/hooks/useNotify';
import { isManagerOrAbove } from '@/utils/roles';
import { formatDate } from '@/utils/formatters';
import styles from './RecordMediaGallery.module.scss';

interface Props {
  recordId: string;
  /** Сообщает карточке записи, сколько файлов прикреплено (для счётчика) */
  onCountChange?: (count: number) => void;
}

interface UploadState { id: number; name: string; percent: number }

let uploadSeq = 0;

/**
 * Фото и видео нюансов авто в записи. Добавлять может любая роль; удалить — тот, кто загрузил,
 * или менеджер и выше. Файлы хранятся год и потом удаляются с сервера автоматически.
 */
export const RecordMediaGallery: React.FC<Props> = ({ recordId, onCountChange }) => {
  const { user } = useAuthStore();
  const notify = useNotify();
  const [media, setMedia] = useState<RecordMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const load = useCallback(async () => {
    try {
      setMedia(await recordsApi.getMedia(recordId));
    } catch (e) {
      notify.error(e, 'Не удалось загрузить фото записи');
    } finally {
      setLoading(false);
    }
  }, [recordId, notify]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => { onCountChange?.(media.length); }, [media.length, onCountChange]);

  const upload = async (file: File) => {
    const id = ++uploadSeq;
    setUploads(prev => [...prev, { id, name: file.name, percent: 0 }]);
    try {
      const created = await recordsApi.uploadMedia(recordId, file, percent => {
        setUploads(prev => prev.map(u => (u.id === id ? { ...u, percent } : u)));
      });
      setMedia(prev => [...prev, created]);
    } catch (e) {
      notify.error(e, `Не удалось загрузить «${file.name}»`);
    } finally {
      setUploads(prev => prev.filter(u => u.id !== id));
    }
  };

  const remove = async (item: RecordMedia) => {
    try {
      await recordsApi.deleteMedia(recordId, item.id);
      setMedia(prev => prev.filter(m => m.id !== item.id));
    } catch (e) {
      notify.error(e, 'Не удалось удалить файл');
    }
  };

  const canDelete = (item: RecordMedia) => item.uploadedByName === user?.name || isManagerOrAbove(user);
  const photos = media.filter(m => m.type === 'PHOTO');

  return (
    <>
      <Divider orientation="left" className={styles.divider}>Фото и видео авто</Divider>
      <div className={styles.toolbar}>
        <Upload
          accept="image/*,video/*,.heic,.heif"
          multiple
          showUploadList={false}
          beforeUpload={file => { void upload(file); return false; }}
        >
          <Button icon={<CameraOutlined />} size="small">Добавить фото или видео</Button>
        </Upload>
        <span className={styles.hint}>Для нюансов авто. Хранятся год, потом удаляются автоматически</span>
      </div>

      {uploads.map(u => (
        <div key={u.id} className={styles.upload}>
          <span className={styles.uploadName}>{u.name}</span>
          <Progress percent={u.percent} size="small" />
        </div>
      ))}

      {loading ? (
        <div className={styles.center}><Spin size="small" /></div>
      ) : media.length === 0 ? (
        uploads.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет файлов" className={styles.empty} />
      ) : (
        <Image.PreviewGroup items={photos.map(p => p.url)}>
          <div className={styles.grid}>
            {media.map(item => (
              <div key={item.id} className={styles.tile}>
                {item.type === 'PHOTO' ? (
                  <Image src={item.url} alt={item.originalName} className={styles.thumb} />
                ) : (
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className={styles.video}>
                    <video src={item.url} preload="metadata" muted className={styles.thumb} />
                    <PlayCircleOutlined className={styles.play} />
                  </a>
                )}
                <div className={styles.meta} title={`Загрузил: ${item.uploadedByName ?? '—'}. Удалится ${formatDate(item.expiresAt)}`}>
                  <span className={styles.metaText}>{item.uploadedByName ?? '—'} · до {formatDate(item.expiresAt)}</span>
                  {canDelete(item) && (
                    <Popconfirm title="Удалить файл?" okText="Удалить" cancelText="Отмена" onConfirm={() => remove(item)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Удалить" />
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
      )}
    </>
  );
};
