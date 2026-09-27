import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Button, Segmented, Tag, Popconfirm, Empty, Spin, Tooltip, Alert, InputNumber,
} from 'antd';
import { GiftOutlined, CheckOutlined, BookOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { diffWordsWithSpace } from 'diff';
import { wikiApi } from '@/api/wiki.api';
import { WikiKey, WikiRevision } from '@/types';
import { useWikiStore } from '@/store/wikiStore';
import { useNotify } from '@/hooks/useNotify';
import { formatPrice } from '@/utils/formatters';
import { WikiPhotoGallery } from './WikiPhotoGallery';
import styles from './WikiPage.module.scss';

interface Props {
  bonusAmount: number;
  onOpenCar: (key: WikiKey) => void;
}

const carTitle = (r: WikiRevision) =>
  [r.entry.markName, r.entry.modelName, r.entry.generationName].filter(Boolean).join(' ');

const countChars = (s: string) => s.replace(/\s/g, '').length;

/** Сравнение сумм премии без копеечных погрешностей float */
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Подпись к назначенной премии: видно, если оплачено не полностью или сверх стандартной. */
function rewardLabel(r: WikiRevision) {
  const paid = r.bonusAmount ?? 0;
  const base = r.bonusBaseAmount;
  if (!base || sameAmount(paid, base)) return `Премия ${formatPrice(paid)}`;
  return paid < base
    ? `Частичная оплата ${formatPrice(paid)} из ${formatPrice(base)}`
    : `Премия ${formatPrice(paid)} (стандартная ${formatPrice(base)})`;
}

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
  // Сумма премии редактируется перед подтверждением: по умолчанию — из настроек
  const [amount, setAmount] = useState<number | null>(bonusAmount > 0 ? bonusAmount : null);
  const isAmountValid = amount !== null && amount > 0;
  const isChanged = isAmountValid && bonusAmount > 0 && !sameAmount(amount, bonusAmount);

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
          <Tag color="gold">{rewardLabel(r)} · {r.reviewedByName}</Tag>
        )}
        {r.status === 'REVIEWED' && <Tag>Просмотрено · {r.reviewedByName}</Tag>}
      </div>

      {textChanged && <DiffView prev={r.prevContent} next={r.newContent} />}

      {r.addedMedia.length > 0 && (
        <>
          <div className={styles.revisionMediaLabel}>Добавленные файлы</div>
          {addedPhotos.length > 0 && <WikiPhotoGallery photos={addedPhotos} compact />}
          {addedVideos.length > 0 && (
            <div className={styles.revisionMedia}>
              {addedVideos.map(m => <video key={m.id} src={m.url} controls preload="metadata" playsInline />)}
            </div>
          )}
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
          <Tooltip title={bonusAmount > 0 ? undefined : 'Размер премии не задан в настройках — укажите сумму вручную'}>
            <Popconfirm
              title="Назначить премию?"
              description={(
                <div className={styles.rewardForm}>
                  <div>Сотрудник: {r.authorName}. Премия попадёт в расчёт ЗП за текущий месяц.</div>
                  <InputNumber
                    className={styles.rewardInput}
                    value={amount}
                    onChange={v => setAmount(v)}
                    min={0.01}
                    step={5}
                    precision={2}
                    addonAfter="р."
                    placeholder="Сумма"
                    autoFocus
                  />
                  {isChanged && amount < bonusAmount && (
                    <div className={styles.rewardHint}>
                      Частичная оплата: {formatPrice(amount)} из {formatPrice(bonusAmount)}
                    </div>
                  )}
                  {isChanged && amount > bonusAmount && (
                    <div className={styles.rewardHint}>
                      Больше стандартной премии ({formatPrice(bonusAmount)})
                    </div>
                  )}
                  {!isChanged && bonusAmount > 0 && (
                    <div className={styles.rewardHintMuted}>Полная премия по настройкам. Для частичной оплаты уменьшите сумму.</div>
                  )}
                </div>
              )}
              okText={isChanged && amount < bonusAmount ? 'Оплатить частично' : 'Назначить'}
              cancelText="Отмена"
              okButtonProps={{ disabled: !isAmountValid }}
              onOpenChange={open => { if (open) setAmount(bonusAmount > 0 ? bonusAmount : null); }}
              onConfirm={() => {
                if (!isAmountValid) return;
                // Сумма совпадает с настройками — не передаём её, сервер возьмёт стандартную
                const custom = isChanged || !(bonusAmount > 0) ? amount : undefined;
                return act(
                  () => wikiApi.reward(r.id, custom),
                  isChanged && amount < bonusAmount
                    ? `Частичная премия ${formatPrice(amount)} назначена: ${r.authorName}`
                    : `Премия назначена: ${r.authorName}`,
                );
              }}
            >
              <Button type="primary" icon={<GiftOutlined />} loading={busy}>
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
