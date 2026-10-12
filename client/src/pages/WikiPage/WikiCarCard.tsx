import React, { useEffect, useMemo, useState } from 'react';
import { Card, Spin, Tabs } from 'antd';
import dayjs from 'dayjs';
import cn from 'classnames';
import { wikiApi } from '@/api/wiki.api';
import { WikiEntry, WikiKey } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { useMissedWiki } from '@/hooks/useMissedWiki';
import { useWikiSections } from '@/hooks/useWikiSections';
import { WikiSectionPanel, sectionContent, sectionMedia, wikiKeyString } from './WikiSectionPanel';
import styles from './WikiPage.module.scss';

interface Props {
  carKey: WikiKey;
  title: string;
  /** Открытый раздел (из адреса); пусто — «Общее» */
  sectionId?: string;
  onSectionChange: (sectionId: string | undefined) => void;
  /** Карточка изменилась — родитель обновляет список заполненных */
  onChanged: () => void;
}

const GENERAL = 'general';

/**
 * Шапка карточки: фото поколения из справочника на фоне, как в карточке записи.
 * Фото нет или не загрузилось — фирменный графитовый фон.
 */
const WikiCarHero: React.FC<{ carKey: WikiKey; title: string; meta?: React.ReactNode }> = ({ carKey, title, meta }) => {
  const [photo, setPhoto] = useState<'loading' | 'ready' | 'error'>('loading');
  const src = `/api/cars/photo/${carKey.markId}/${carKey.modelId}/${carKey.generationId}`;
  return (
    <div className={cn(styles.hero, { [styles.heroWithPhoto]: photo !== 'error' })}>
      {photo !== 'error' && (
        <img
          src={src}
          alt=""
          className={cn(styles.heroPhoto, { [styles.heroPhotoReady]: photo === 'ready' })}
          onLoad={() => setPhoto('ready')}
          onError={() => setPhoto('error')}
        />
      )}
      <div className={styles.heroShade} />
      <div className={styles.heroText}>
        <div className={styles.heroTitle}>{title}</div>
        {meta && <div className={styles.heroMeta}>{meta}</div>}
      </div>
    </div>
  );
};

/**
 * Карточка автомобиля в вики: «Общее» и разделы по видам работ (Настройки → Упущенная прибыль).
 * Раздел, по которому упущена премия, отмечен — его и нужно заполнить.
 */
export const WikiCarCard: React.FC<Props> = ({ carKey, title, sectionId, onSectionChange, onChanged }) => {
  const notify = useNotify();
  const [entry, setEntry] = useState<WikiEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: sections = [] } = useWikiSections();
  const { data: missed } = useMissedWiki();

  const { markId, modelId, generationId } = carKey;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    wikiApi.getEntry({ markId, modelId, generationId })
      .then(data => !cancelled && setEntry(data))
      .catch(e => !cancelled && notify.error(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [markId, modelId, generationId, notify]);

  // Разделы этого авто, по которым упущена премия
  const missedSections = useMemo(() => new Set((missed?.employees ?? []).flatMap(e => e.items)
    .filter(i => i.brandId === markId && i.modelId === modelId && i.generationId === generationId)
    .map(i => i.sectionId)), [missed, markId, modelId, generationId]);

  const isFilled = (id: string | null) => !!sectionContent(entry, id).trim() || sectionMedia(entry, id).length > 0;

  const panel = (id: string | null, placeholder: string) => (
    <WikiSectionPanel
      key={`${wikiKeyString(carKey)}/${id ?? GENERAL}`}
      carKey={carKey}
      sectionId={id}
      entry={entry}
      setEntry={setEntry}
      placeholder={placeholder}
      onChanged={onChanged}
    />
  );

  const generalPlaceholder = 'Снятие бампера и фар, рамки, обманки, особенности...';
  const activeKey = sections.some(s => s.id === sectionId) ? sectionId! : GENERAL;

  return (
    <Card className={styles.carCard}>
      <Spin spinning={loading}>
        {/* key: при выборе другого авто состояние загрузки фото начинается заново */}
        <WikiCarHero
          key={wikiKeyString(carKey)}
          carKey={carKey}
          title={title}
          meta={entry?.updatedByName
            ? `Обновлено ${dayjs(entry.updatedAt).format('DD.MM.YYYY HH:mm')} · ${entry.updatedByName}`
            : undefined}
        />

        {/* Панели — после загрузки: пустой раздел сразу открывается на заполнение */}
        {!loading && (sections.length === 0 ? panel(null, generalPlaceholder) : (
          <Tabs
            className={styles.sectionTabs}
            activeKey={activeKey}
            onChange={key => onSectionChange(key === GENERAL ? undefined : key)}
            items={[
              { key: GENERAL, label: 'Общее', children: panel(null, generalPlaceholder) },
              ...sections.map(s => {
                const isMissed = missedSections.has(s.id);
                return {
                  key: s.id,
                  label: (
                    <span className={cn(styles.sectionTab, { [styles.sectionTabMissed]: isMissed })}>
                      {s.name}
                      {(isMissed || !isFilled(s.id)) && (
                        <span
                          className={cn(styles.sectionDot, { [styles.sectionDotMissed]: isMissed })}
                          title={isMissed ? 'Упущена премия — заполните раздел' : 'Раздел не заполнен'}
                        />
                      )}
                    </span>
                  ),
                  children: panel(s.id, `${s.name}: снятие, доступ, особенности, что важно знать...`),
                };
              }),
            ]}
          />
        ))}
      </Spin>
    </Card>
  );
};
