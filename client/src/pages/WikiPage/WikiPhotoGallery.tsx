import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Image } from 'antd';
import { FileImageOutlined, ExpandOutlined } from '@ant-design/icons';
import cn from 'classnames';
import styles from './WikiPage.module.scss';

/** Фото для галереи — подходит и WikiMedia карточки, и WikiMediaRef из правки. */
export interface GalleryPhoto {
  id: string;
  url: string;
  originalName: string;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  placeholder?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number;
}

interface Props {
  photos: GalleryPhoto[];
  /** Маленькие превью (проверка правок) */
  compact?: boolean;
  /** Кнопки поверх превью (удаление). Должна быть стабильной (useCallback), иначе плитки перерисовываются. */
  renderActions?: (photo: GalleryPhoto) => React.ReactNode;
}

const formatMb = (bytes?: number) => (bytes ? ` · ${(bytes / 1024 / 1024).toFixed(1)} МБ` : '');

/** Заранее грузим картинку в кеш браузера — в просмотрщике она покажется без задержки. */
function preload(src: string | null | undefined) {
  if (!src) return;
  const img = new window.Image();
  img.decoding = 'async';
  img.src = src;
}

interface TileProps {
  photo: GalleryPhoto;
  index: number;
  compact?: boolean;
  onOpen: (index: number) => void;
  renderActions?: (photo: GalleryPhoto) => React.ReactNode;
}

/**
 * Плитка сетки: сразу видно размытое микропревью из БД, поверх него плавно проявляется thumb.
 * Картинка грузится лениво — только когда плитка подъезжает к экрану.
 */
const PhotoTile = memo<TileProps>(({ photo, index, compact, onOpen, renderActions }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn(styles.photoTile, { [styles.photoTileCompact]: compact })}>
      {renderActions?.(photo)}
      {failed ? (
        // Браузер не умеет показать файл (обычно HEIC с iPhone) — даём скачать оригинал
        <a className={styles.photoFallback} href={photo.url} target="_blank" rel="noreferrer" download={photo.originalName}>
          <FileImageOutlined className={styles.photoFallbackIcon} />
          <span className={styles.photoFallbackName}>{photo.originalName}</span>
        </a>
      ) : (
        <button type="button" className={styles.photoButton} onClick={() => onOpen(index)} title={photo.originalName}>
          {photo.placeholder && !loaded && (
            <img className={styles.photoPlaceholder} src={photo.placeholder} alt="" aria-hidden />
          )}
          <img
            className={cn(styles.photoImg, { [styles.photoImgLoaded]: loaded })}
            src={photo.thumbUrl ?? photo.url}
            alt={photo.originalName}
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </button>
      )}
    </div>
  );
});
PhotoTile.displayName = 'PhotoTile';

/**
 * Сетка фото с просмотрщиком. В сетке — лёгкие превью, в просмотрщике — medium (~1280px),
 * оригинал подгружается по кнопке. Один просмотрщик на всю галерею вместо antd Image на каждое фото.
 */
export const WikiPhotoGallery = memo<Props>(({ photos, compact, renderActions }) => {
  const [current, setCurrent] = useState<number | null>(null);
  /** Фото, для которых в просмотрщике показываем оригинал */
  const [originals, setOriginals] = useState<ReadonlySet<string>>(() => new Set());
  const [loadingOriginal, setLoadingOriginal] = useState<string | null>(null);

  const onOpen = useCallback((index: number) => setCurrent(index), []);

  // Фото удалили, пока открыт просмотр, — не выходим за границы
  const safeCurrent = current === null ? null : Math.min(current, photos.length - 1);
  const isOpen = safeCurrent !== null && safeCurrent >= 0;

  const items = useMemo(
    () => photos.map(p => ({
      src: originals.has(p.id) ? p.url : (p.mediumUrl ?? p.url),
      alt: p.originalName,
    })),
    [photos, originals],
  );

  // Соседние фото подгружаем заранее — листание без ожидания
  useEffect(() => {
    if (!isOpen) return;
    [safeCurrent - 1, safeCurrent + 1].forEach(i => {
      const p = photos[i];
      if (p) preload(p.mediumUrl ?? p.url);
    });
  }, [isOpen, safeCurrent, photos]);

  const showOriginal = (photo: GalleryPhoto) => {
    setLoadingOriginal(photo.id);
    // Переключаем картинку, только когда оригинал уже скачан, — до этого виден medium
    const img = new window.Image();
    const done = () => {
      setOriginals(prev => new Set(prev).add(photo.id));
      setLoadingOriginal(id => (id === photo.id ? null : id));
    };
    img.onload = done;
    img.onerror = done;
    img.src = photo.url;
  };

  const toolbarRender = (node: React.ReactElement, info: { current: number }) => {
    const photo = photos[info.current];
    const canLoadOriginal = !!photo?.mediumUrl && !originals.has(photo.id);
    return (
      <div className={styles.previewToolbar}>
        {node}
        {canLoadOriginal && (
          <Button
            ghost
            size="small"
            icon={<ExpandOutlined />}
            loading={loadingOriginal === photo.id}
            onClick={() => showOriginal(photo)}
          >
            Оригинал{formatMb(photo.size)}
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={compact ? styles.photoStrip : styles.mediaGrid}>
        {photos.map((p, i) => (
          <PhotoTile key={p.id} photo={p} index={i} compact={compact} onOpen={onOpen} renderActions={renderActions} />
        ))}
      </div>
      <Image.PreviewGroup
        items={items}
        preview={{
          visible: isOpen,
          current: isOpen ? safeCurrent : 0,
          onChange: index => setCurrent(index),
          onVisibleChange: visible => { if (!visible) setCurrent(null); },
          toolbarRender,
        }}
      />
    </>
  );
});
WikiPhotoGallery.displayName = 'WikiPhotoGallery';
