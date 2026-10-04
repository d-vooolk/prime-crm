import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card, Button, Input, Upload, Popconfirm, Progress, Empty, Spin, Divider,
} from 'antd';
import { EditOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import cn from 'classnames';
import { wikiApi } from '@/api/wiki.api';
import { WikiEntry, WikiKey, WikiMedia } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { WikiPhotoGallery, GalleryPhoto } from './WikiPhotoGallery';
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

const keyString = (k: WikiKey) => `${k.markId}/${k.modelId}/${k.generationId}`;

/**
 * Новый список медиа, но уже показанные файлы остаются теми же объектами —
 * плитки галереи (memo) не перерисовываются и не перезагружают картинки.
 */
function mergeMedia(prev: WikiEntry | null, next: WikiEntry | null): WikiEntry | null {
  if (!prev || !next || prev.id !== next.id) return next;
  const byId = new Map(prev.media.map(m => [m.id, m]));
  return {
    ...next,
    media: next.media.map(m => {
      const old = byId.get(m.id);
      return old && old.thumbUrl === m.thumbUrl && old.mediumUrl === m.mediumUrl ? old : m;
    }),
  };
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

  // Загрузки идут пачкой и параллельно: считаем активные, чтобы в конце пачки один раз
  // сверить карточку с сервером и один раз обновить список у родителя
  const activeUploads = useRef(0);
  const batchChanged = useRef(false);
  const entryRef = useRef(entry);
  entryRef.current = entry;
  // Пользователь мог переключить автомобиль, пока файлы грузились, — ответы старой карточки игнорируем
  const currentKey = useRef(keyString(carKey));
  currentKey.current = keyString(carKey);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

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
      .catch(e => !cancelled && notify.error(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [markId, modelId, generationId, notify]);

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
      notify.error(e);
    } finally {
      setSaving(false);
    }
  };

  const reloadEntry = async (key: WikiKey) => {
    const fresh = await wikiApi.getEntry(key);
    if (currentKey.current === keyString(key)) setEntry(prev => mergeMedia(prev, fresh));
  };

  const finishUpload = (key: WikiKey) => {
    activeUploads.current -= 1;
    if (activeUploads.current > 0 || !batchChanged.current) return;
    batchChanged.current = false;
    // Сверка в конце пачки: подтягивает всё, что не удалось дописать локально
    reloadEntry(key).catch(() => {
      // Намеренно молча: файлы уже загружены и показаны, сверка лишь уточняет список
    });
    onChangedRef.current();
  };

  const upload = async (file: File, uid: string) => {
    const problem = validateFile(file);
    if (problem) {
      notify.error(problem, file.name);
      return;
    }
    const key = carKey;
    activeUploads.current += 1;
    setUploads(list => [...list, { uid, name: file.name, percent: 0 }]);
    try {
      const media = await wikiApi.uploadMedia(key, file, percent =>
        // Прогресс приходит часто — без изменения процента не перерисовываем
        setUploads(list => (list.some(u => u.uid === uid && u.percent !== percent)
          ? list.map(u => (u.uid === uid ? { ...u, percent } : u))
          : list)),
      );
      batchChanged.current = true;
      if (currentKey.current !== keyString(key)) return;
      if (entryRef.current) {
        // Дописываем файл локально, а не перечитываем карточку после каждого из десятков файлов
        setEntry(prev => (prev && !prev.media.some(m => m.id === media.id)
          ? { ...prev, media: [...prev.media, media] }
          : prev));
      } else {
        // Карточки ещё не было — сервер создал её при первой загрузке
        await reloadEntry(key);
      }
    } catch (e) {
      notify.error(e, file.name);
    } finally {
      setUploads(list => list.filter(u => u.uid !== uid));
      finishUpload(key);
    }
  };

  const removeMedia = useCallback(async (mediaId: string) => {
    try {
      await wikiApi.deleteMedia(mediaId);
      setEntry(prev => (prev ? { ...prev, media: prev.media.filter(m => m.id !== mediaId) } : prev));
      onChangedRef.current();
    } catch (e) {
      notify.error(e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const media = entry?.media;
  const photos = useMemo(() => media?.filter(m => m.type === 'PHOTO') ?? [], [media]);
  const videos = useMemo(() => media?.filter(m => m.type === 'VIDEO') ?? [], [media]);

  const deleteButton = useCallback((item: WikiMedia | GalleryPhoto) => (
    <Popconfirm
      title="Удалить файл?"
      okText="Удалить"
      cancelText="Отмена"
      okButtonProps={{ danger: true }}
      onConfirm={() => removeMedia(item.id)}
    >
      <Button className={styles.mediaDelete} size="small" danger icon={<DeleteOutlined />} />
    </Popconfirm>
  ), [removeMedia]);

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

        <Divider orientation="left" className={styles.cardDivider}>Информация</Divider>

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

        <Divider orientation="left" className={styles.cardDivider}>Фото и видео</Divider>

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

        {photos.length > 0 && <WikiPhotoGallery photos={photos} renderActions={deleteButton} />}

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
