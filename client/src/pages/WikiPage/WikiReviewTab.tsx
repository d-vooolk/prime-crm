import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card, Button, Segmented, Tag, Popconfirm, Empty, Spin, Tooltip, Alert, InputNumber, Input,
} from 'antd';
import { GiftOutlined, CheckOutlined, BookOutlined, RollbackOutlined, CloseOutlined, LinkOutlined, ShopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { diffWordsWithSpace } from 'diff';
import { wikiApi } from '@/api/wiki.api';
import { WikiKey, WikiReviewNote, WikiRevision } from '@/types';
import { useWikiStore } from '@/store/wikiStore';
import { useNotify } from '@/hooks/useNotify';
import { formatPrice } from '@/utils/formatters';
import { getErrorMessage } from '@/utils/errors';
import { WikiPhotoGallery } from './WikiPhotoGallery';
import { ProductThumb } from './WikiProductPicker';
import styles from './WikiPage.module.scss';

interface Props {
  bonusAmount: number;
  onOpenCar: (key: WikiKey, sectionId?: string) => void;
}

const carTitle = (r: WikiRevision) =>
  [r.entry.markName, r.entry.modelName, r.entry.generationName].filter(Boolean).join(' ')
  + (r.sectionName ? ` · ${r.sectionName}` : '');

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

type ReviewStatus = 'PENDING' | 'REWORK' | 'DONE';

const EMPTY_TEXT: Record<ReviewStatus, string> = {
  PENDING: 'Новых правок нет',
  REWORK: 'На доработке ничего нет',
  DONE: 'Проверенных правок пока нет',
};

/** Замечания проверяющих по кругам доработки — последнее снизу */
export const ReviewNotes: React.FC<{ notes: WikiReviewNote[] }> = ({ notes }) => (
  <div className={styles.reviewNotes}>
    {notes.map((n, i) => (
      <div key={i} className={styles.reviewNote}>
        <div className={styles.reviewNoteMeta}>Замечание · {n.byName} · {dayjs(n.at).format('DD.MM.YYYY HH:mm')}</div>
        <div className={styles.reviewNoteText}>{n.text}</div>
      </div>
    ))}
  </div>
);

const RevisionCard: React.FC<{
  revision: WikiRevision;
  bonusAmount: number;
  onOpenCar: (key: WikiKey, sectionId?: string) => void;
  onDone: () => void;
}> = ({ revision: r, bonusAmount, onOpenCar, onDone }) => {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  // Сумма премии редактируется перед подтверждением: по умолчанию — из настроек
  const [amount, setAmount] = useState<number | null>(bonusAmount > 0 ? bonusAmount : null);
  const isAmountValid = amount !== null && amount > 0;
  const isChanged = isAmountValid && bonusAmount > 0 && !sameAmount(amount, bonusAmount);
  const [comment, setComment] = useState('');

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
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };

  const reworkButton = (
    <Popconfirm
      title="Вернуть на доработку?"
      description={(
        <div className={styles.rewardForm}>
          <div>{r.authorName} получит замечание, исправит раздел и снова отправит на проверку.</div>
          <Input.TextArea
            className={styles.reworkInput}
            value={comment}
            onChange={e => setComment(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 10 }}
            maxLength={3000}
            placeholder="Что нужно доработать"
            autoFocus
          />
        </div>
      )}
      okText="Вернуть"
      cancelText="Отмена"
      okButtonProps={{ disabled: !comment.trim() }}
      onOpenChange={open => { if (open) setComment(''); }}
      onConfirm={() => act(() => wikiApi.requestChanges(r.id, comment.trim()), `Возвращено на доработку: ${r.authorName}`)}
    >
      <Button icon={<RollbackOutlined />} loading={busy}>На доработку</Button>
    </Popconfirm>
  );

  const addedPhotos = r.addedMedia.filter(m => m.type === 'PHOTO');
  const addedVideos = r.addedMedia.filter(m => m.type === 'VIDEO');
  const textChanged = r.prevContent !== r.newContent;

  return (
    <Card size="small">
      <div className={styles.revisionHeader}>
        <div>
          <div className={styles.revisionCar}>{carTitle(r)}</div>
          <div className={styles.revisionMeta}>
            {r.isExternal && <ShopOutlined />} {r.authorName}{r.authorRole ? ` (${r.authorRole})` : ''}
            {r.isExternal && r.authorPhone && <> · <a href={`tel:${r.authorPhone}`}>{r.authorPhone}</a></>}
            {' · '}{dayjs(r.updatedAt).format('DD.MM.YYYY HH:mm')}
          </div>
        </div>
        <Button
          type="link"
          icon={<BookOutlined />}
          onClick={() => onOpenCar(
            { markId: r.entry.markId, modelId: r.entry.modelId, generationId: r.entry.generationId },
            r.sectionId ?? undefined,
          )}
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
        {r.isExternal && r.status !== 'REVIEWED' && r.status !== 'REJECTED' && (
          <Tag color="purple">Предложение оптовика — в карточке появится после «Принять»</Tag>
        )}
        {r.addedProducts.length > 0 && <Tag color="green">+{r.addedProducts.length} товар(ов)</Tag>}
        {r.status === 'REVIEWED' && <Tag>{r.isExternal ? 'Принято' : 'Просмотрено'} · {r.reviewedByName}</Tag>}
        {r.status === 'REJECTED' && <Tag color="red">Отклонено · {r.reviewedByName}</Tag>}
        {r.status === 'CHANGES_REQUESTED' && <Tag color="orange">На доработке у автора</Tag>}
        {r.status === 'PENDING' && r.reviewNotes.length > 0 && <Tag color="blue">Исправлено после замечаний</Tag>}
      </div>

      {r.reviewNotes.length > 0 && <ReviewNotes notes={r.reviewNotes} />}

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

      {r.addedProducts.length > 0 && (
        <>
          <div className={styles.revisionMediaLabel}>Товары</div>
          <ul className={styles.productList}>
            {r.addedProducts.map(p => (
              <li key={p.id} className={styles.productRow}>
                <ProductThumb src={p.imageUrl} />
                <a className={styles.productLink} href={p.url} target="_blank" rel="noreferrer">
                  {p.title}
                  <LinkOutlined className={styles.productLinkIcon} />
                </a>
              </li>
            ))}
          </ul>
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

      {r.isExternal && (r.status === 'PENDING' || r.status === 'CHANGES_REQUESTED') && (
        <div className={styles.revisionActions}>
          {r.status === 'PENDING' && reworkButton}
          <Popconfirm
            title="Отклонить предложение?"
            description="Текст не попадёт в вики, фото, видео и товары удалятся"
            okText="Отклонить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={() => act(() => wikiApi.rejectProposal(r.id), 'Предложение отклонено')}
          >
            <Button danger icon={<CloseOutlined />} loading={busy}>Отклонить</Button>
          </Popconfirm>
          <Popconfirm
            title="Принять в вики?"
            description="Текст допишется в конец раздела, фото, видео и товары появятся в карточке"
            okText="Принять"
            cancelText="Отмена"
            onConfirm={() => act(() => wikiApi.acceptProposal(r.id), `Принято в вики: ${r.authorName}`)}
          >
            <Button type="primary" icon={<CheckOutlined />} loading={busy}>Принять</Button>
          </Popconfirm>
        </div>
      )}

      {!r.isExternal && r.status !== 'REWARDED' && r.status !== 'REJECTED' && (
        <div className={styles.revisionActions}>
          {r.status === 'PENDING' && reworkButton}
          {(r.status === 'PENDING' || r.status === 'CHANGES_REQUESTED') && (
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
  const [status, setStatus] = useState<ReviewStatus>('PENDING');
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Номер последнего запроса: при быстром переключении вкладок ответ старой не перетрёт новую
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    wikiApi.getRevisions(status)
      .then(data => {
        if (requestId !== requestIdRef.current) return;
        setRevisions(data);
        setLoadError(null);
      })
      .catch(e => {
        if (requestId !== requestIdRef.current) return;
        setRevisions([]);
        setLoadError(getErrorMessage(e));
      })
      .finally(() => { if (requestId === requestIdRef.current) setLoading(false); });
    refreshPendingCount();
  }, [status, refreshPendingCount]);

  useEffect(load, [load]);

  return (
    <div className={styles.section}>
      <div className={styles.reviewToolbar}>
        <Segmented
          value={status}
          onChange={v => setStatus(v as ReviewStatus)}
          options={[
            { value: 'PENDING', label: 'На проверке' },
            { value: 'REWORK', label: 'На доработке' },
            { value: 'DONE', label: 'Проверенные' },
          ]}
        />
      </div>

      {status === 'PENDING' && !(bonusAmount > 0) && (
        <Alert type="info" showIcon message="Размер премии за заполнение вики не задан — укажите его во вкладке «Настройки»." />
      )}

      {loadError && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить правки"
          description={loadError}
          action={<Button size="small" onClick={load}>Повторить</Button>}
        />
      )}

      <Spin spinning={loading}>
        {loadError ? null : revisions.length === 0 ? (
          <Empty description={EMPTY_TEXT[status]} />
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
