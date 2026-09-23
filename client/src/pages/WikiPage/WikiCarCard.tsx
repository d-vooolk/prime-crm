import React, { useEffect, useState } from 'react';
import {
  Card, Button, Input, Upload, Image, Popconfirm, Progress, Empty, Spin, Divider,
} from 'antd';
import { EditOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import cn from 'classnames';
import { wikiApi } from '@/api/wiki.api';
import { WikiEntry, WikiKey, WikiMedia } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import styles from './WikiPage.module.scss';

interface Props {
  carKey: WikiKey;
  title: string;
  /** Карточка изменилась — родитель обновляет список заполненных */
  onChanged: () => void;
}

// Тот же предел, что на сервере (server/src/routes/wiki.routes.ts) и в nginx
const MAX_FILE_SIZE_MB = 300;
const MEDIA_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif|mp4|mov|m4v|webm|avi|mkv|3gp)$/i;

/** Проверяем до отправки, чтобы не гонять по сети файл, который сервер всё равно отклонит. */
function validateFile(file: File): string | null {
  const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') || MEDIA_EXT.test(file.name);
  if (!isMedia) return 'можно загружать только фото и видео';
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `файл больше ${MAX_FILE_SIZE_MB} МБ`;
  return null;
}

interface UploadState {
  uid: string;
  name: string;
  percent: number;
}

export const WikiCarCard: React.FC<Props> = ({ carKey, title, onChanged }) => {
  const notify = useNotify();
  const [entry, setEntry] = useState<WikiEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const { markId, modelId, generationId } = carKey;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    wikiApi.getEntry({ markId, modelId, generationId })
      .then(data => {
        if (cancelled) return;
        setEntry(data);
        // Пустую карточку сразу открываем на заполнение
        if (!data?.content) {
          setDraft('');
          setEditing(true);
        }
      })
      .catch(e => !cancelled && notify.error((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [markId, modelId, generationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    setDraft(entry?.content ?? '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(entry?.content ?? '');
    setEditing(!entry?.content);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await wikiApi.saveContent(carKey, draft);
      setEntry(saved);
      setEditing(!saved.content);
      notify.success('Сохранено');
      onChanged();
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File, uid: string) => {
    const problem = validateFile(file);
    if (problem) {
      notify.error(`${file.name}: ${problem}`);
      return;
    }
    setUploads(list => [...list, { uid, name: file.name, percent: 0 }]);
    try {
      await wikiApi.uploadMedia(carKey, file, percent =>
        setUploads(list => list.map(u => (u.uid === uid ? { ...u, percent } : u))),
      );
      // Перечитываем целиком: если карточки ещё не было, сервер создал её при загрузке
      setEntry(await wikiApi.getEntry(carKey));
      onChanged();
    } catch (e) {
      notify.error(`${file.name}: ${(e as Error).message}`);
    } finally {
      setUploads(list => list.filter(u => u.uid !== uid));
    }
  };

  const removeMedia = async (media: WikiMedia) => {
    try {
      await wikiApi.deleteMedia(media.id);
      setEntry(prev => (prev ? { ...prev, media: prev.media.filter(m => m.id !== media.id) } : prev));
      onChanged();
    } catch (e) {
      notify.error((e as Error).message);
    }
  };

  const photos = entry?.media.filter(m => m.type === 'PHOTO') ?? [];
  const videos = entry?.media.filter(m => m.type === 'VIDEO') ?? [];

  const deleteButton = (media: WikiMedia) => (
    <Popconfirm
      title="Удалить файл?"
      okText="Удалить"
      cancelText="Отмена"
      okButtonProps={{ danger: true }}
      onConfirm={() => removeMedia(media)}
    >
      <Button className={styles.mediaDelete} size="small" danger icon={<DeleteOutlined />} />
    </Popconfirm>
  );

  return (
    <Card>
      <Spin spinning={loading}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>{title}</div>
          {entry?.updatedByName && (
            <div className={styles.cardMeta}>
              Обновлено {dayjs(entry.updatedAt).format('DD.MM.YYYY HH:mm')} · {entry.updatedByName}
            </div>
          )}
        </div>

        <Divider orientation="left" style={{ fontSize: 13 }}>Информация</Divider>

        {editing ? (
          <>
            <Input.TextArea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoSize={{ minRows: 8, maxRows: 30 }}
              placeholder="Снятие бампера и фар, рамки, обманки, особенности..."
            />
            <div className={styles.editActions}>
              {!!entry?.content && <Button onClick={cancelEdit}>Отмена</Button>}
              <Button type="primary" loading={saving} onClick={save} disabled={draft === (entry?.content ?? '')}>
                Сохранить
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.content}>{entry?.content}</div>
            <div className={styles.editActions}>
              <Button icon={<EditOutlined />} onClick={startEdit}>Редактировать</Button>
            </div>
          </>
        )}

        <Divider orientation="left" style={{ fontSize: 13 }}>Фото и видео</Divider>

        <div className={styles.mediaHeader}>
          <span className={styles.mediaTitle}>
            {photos.length} фото · {videos.length} видео
          </span>
          <Upload
            multiple
            accept="image/*,video/*"
            showUploadList={false}
            customRequest={({ file }) => {
              const f = file as File & { uid: string };
              upload(f, f.uid);
            }}
          >
            <Button icon={<UploadOutlined />}>Загрузить</Button>
          </Upload>
        </div>

        {uploads.length > 0 && (
          <div className={styles.uploadProgress}>
            {uploads.map(u => (
              <div key={u.uid}>
                {u.name}
                <Progress percent={u.percent} size="small" />
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && videos.length === 0 && uploads.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Файлов пока нет" />
        )}

        {photos.length > 0 && (
          <Image.PreviewGroup>
            <div className={styles.mediaGrid}>
              {photos.map(p => (
                <div key={p.id} className={styles.mediaItem}>
                  {deleteButton(p)}
                  <Image src={p.url} alt={p.originalName} />
                </div>
              ))}
            </div>
          </Image.PreviewGroup>
        )}

        {videos.length > 0 && (
          <div className={cn(styles.videoGrid, { [styles.videoGridSpaced]: photos.length > 0 })}>
            {videos.map(v => (
              <div key={v.id} className={styles.mediaItem}>
                {deleteButton(v)}
                <video src={v.url} controls preload="metadata" playsInline />
              </div>
            ))}
          </div>
        )}
      </Spin>
    </Card>
  );
};
