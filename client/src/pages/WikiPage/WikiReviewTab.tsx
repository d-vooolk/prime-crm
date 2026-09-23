import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Button, Segmented, Tag, Image, Popconfirm, Empty, Spin, Tooltip, Alert,
} from 'antd';
import { GiftOutlined, CheckOutlined, BookOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { diffWordsWithSpace } from 'diff';
import { wikiApi } from '@/api/wiki.api';
import { WikiKey, WikiRevision } from '@/types';
import { useWikiStore } from '@/store/wikiStore';
import { useNotify } from '@/hooks/useNotify';
import { formatPrice } from '@/utils/formatters';
import styles from './WikiPage.module.scss';

interface Props {
  bonusAmount: number;
  onOpenCar: (key: WikiKey) => void;
}

const carTitle = (r: WikiRevision) =>
  [r.entry.markName, r.entry.modelName, r.entry.generationName].filter(Boolean).join(' ');

const countChars = (s: string) => s.replace(/\s/g, '').length;

/** Итоговая разница текста: добавленное подсвечено зелёным, удалённое — красным и зачёркнуто. */
const DiffView: React.FC<{ prev: string; next: string }> = ({ prev, next }) => {
  const parts = useMemo(() => diffWordsWithSpace(prev, next), [prev, next]);
  return (
    <div className={styles.diff}>
      {parts.map((p, i) => {
        if (p.added) return <span key={i} className={styles.diffAdded}>{p.value}</span>;
        if (p.removed) return <span key={i} className={styles.diffRemoved}>{p.value}</span>;
        return <span key={i}>{p.value}</span>;
      })}
    </div>
  );
};

const RevisionCard: React.FC<{
  revision: WikiRevision;
  bonusAmount: number;
  onOpenCar: (key: WikiKey) => void;
  onDone: () => void;
}> = ({ revision: r, bonusAmount, onOpenCar, onDone }) => {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const parts = diffWordsWithSpace(r.prevContent, r.newContent);
    return {
      added: parts.filter(p => p.added).reduce((n, p) => n + countChars(p.value), 0),
      removed: parts.filter(p => p.removed).reduce((n, p) => n + countChars(p.value), 0),
    };
  }, [r.prevContent, r.newContent]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      notify.success(success);
      onDone();
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addedPhotos = r.addedMedia.filter(m => m.type === 'PHOTO');
  const addedVideos = r.addedMedia.filter(m => m.type === 'VIDEO');
  const textChanged = r.prevContent !== r.newContent;

  return (
    <Card size="small">
      <div className={styles.revisionHeader}>
        <div>
          <div className={styles.revisionCar}>{carTitle(r)}</div>
          <div className={styles.revisionMeta}>
            {r.authorName}{r.authorRole ? ` (${r.authorRole})` : ''} · {dayjs(r.updatedAt).format('DD.MM.YYYY HH:mm')}
          </div>
        </div>
        <Button
          type="link"
          icon={<BookOutlined />}
          onClick={() => onOpenCar({ markId: r.entry.markId, modelId: r.entry.modelId, generationId: r.entry.generationId })}
        >
          Открыть карточку
        </Button>
      </div>

      <div className={styles.revisionStats}>
        {stats.added > 0 && <Tag color="green">+{stats.added} симв.</Tag>}
        {stats.removed > 0 && <Tag color="red">−{stats.removed} симв.</Tag>}
        {addedPhotos.length > 0 && <Tag color="green">+{addedPhotos.length} фото</Tag>}
        {addedVideos.length > 0 && <Tag color="green">+{addedVideos.length} видео</Tag>}
        {r.removedMedia.length > 0 && <Tag color="red">−{r.removedMedia.length} файл(ов)</Tag>}
        {r.status === 'REWARDED' && (
          <Tag color="gold">Премия {formatPrice(r.bonusAmount ?? 0)} · {r.reviewedByName}</Tag>
        )}
        {r.status === 'REVIEWED' && <Tag>Просмотрено · {r.reviewedByName}</Tag>}
      </div>

      {textChanged && <DiffView prev={r.prevContent} next={r.newContent} />}

      {r.addedMedia.length > 0 && (
        <>
          <div className={styles.revisionMediaLabel}>Добавленные файлы</div>
          <Image.PreviewGroup>
            <div className={styles.revisionMedia}>
              {addedPhotos.map(m => <Image key={m.id} src={m.url} alt={m.originalName} />)}
              {addedVideos.map(m => <video key={m.id} src={m.url} controls preload="metadata" playsInline />)}
            </div>
          </Image.PreviewGroup>
        </>
      )}

      {r.removedMedia.length > 0 && (
        <>
          <div className={styles.revisionMediaLabel}>Удалённые файлы</div>
          <div className={styles.revisionMedia}>
            {r.removedMedia.map(m => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className={styles.removedFile}>
                {m.originalName}
              </a>
            ))}
          </div>
        </>
      )}

      {r.status !== 'REWARDED' && (
        <div className={styles.revisionActions}>
          {r.status === 'PENDING' && (
            <Button icon={<CheckOutlined />} loading={busy} onClick={() => act(() => wikiApi.markReviewed(r.id), 'Отмечено как просмотренное')}>
              Просмотрено
            </Button>
          )}
          <Tooltip title={bonusAmount > 0 ? undefined : 'Размер премии не задан — укажите его во вкладке «Настройки»'}>
            <Popconfirm
              title={`Назначить премию ${formatPrice(bonusAmount)}?`}
              description={`Сотрудник: ${r.authorName}. Премия попадёт в расчёт ЗП за текущий месяц.`}
              okText="Назначить"
              cancelText="Отмена"
              disabled={!(bonusAmount > 0)}
              onConfirm={() => act(() => wikiApi.reward(r.id), `Премия назначена: ${r.authorName}`)}
            >
              <Button type="primary" icon={<GiftOutlined />} loading={busy} disabled={!(bonusAmount > 0)}>
                Назначить премию {bonusAmount > 0 ? formatPrice(bonusAmount) : ''}
              </Button>
            </Popconfirm>
          </Tooltip>
        </div>
      )}
    </Card>
  );
};

export const WikiReviewTab: React.FC<Props> = ({ bonusAmount, onOpenCar }) => {
  const refreshPendingCount = useWikiStore(s => s.refreshPendingCount);
  const [status, setStatus] = useState<'PENDING' | 'DONE'>('PENDING');
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    wikiApi.getRevisions(status)
      .then(setRevisions)
      .catch(() => setRevisions([]))
      .finally(() => setLoading(false));
    refreshPendingCount();
  };

  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.section}>
      <div className={styles.reviewToolbar}>
        <Segmented
          value={status}
          onChange={v => setStatus(v as 'PENDING' | 'DONE')}
          options={[
            { value: 'PENDING', label: 'На проверке' },
            { value: 'DONE', label: 'Проверенные' },
          ]}
        />
      </div>

      {status === 'PENDING' && !(bonusAmount > 0) && (
        <Alert type="info" showIcon message="Размер премии за заполнение вики не задан — укажите его во вкладке «Настройки»." />
      )}

      <Spin spinning={loading}>
        {revisions.length === 0 ? (
          <Empty description={status === 'PENDING' ? 'Новых правок нет' : 'Проверенных правок пока нет'} />
        ) : (
          <div className={styles.revisionList}>
            {revisions.map(r => (
              <RevisionCard key={r.id} revision={r} bonusAmount={bonusAmount} onOpenCar={onOpenCar} onDone={load} />
            ))}
          </div>
        )}
      </Spin>
    </div>
  );
};
