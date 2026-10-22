import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Empty, Input, Pagination, Segmented, Spin, Tooltip } from 'antd';
import { CheckOutlined, PaperClipOutlined, ReloadOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { mailApi } from '@/api/mail.api';
import { useInvalidateMail, useMailList, useMailStatus } from '@/hooks/useMail';
import { useNotify } from '@/hooks/useNotify';
import { LoadError } from '@/components/Shared/LoadError';
import { MailMessageDrawer } from './MailMessageDrawer';
import { formatMailDate, senderLabel } from './mail.utils';
import styles from './MailPage.module.scss';

const PAGE_SIZE = 30;

/**
 * Почта компании (только создатель). Письма приходят сами через IMAP.
 * Ящиков несколько — сверху выбор ящика с числом новых писем; выбранный — в адресе (?box=, туда ведёт пуш)
 */
export const MailPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const notify = useNotify();
  const invalidate = useInvalidateMail();
  const { data: status } = useMailStatus();
  const accounts = status?.accounts ?? [];
  const boxParam = searchParams.get('box');
  const current = accounts.find(a => a.user === boxParam) ?? accounts[0];
  const { data, isLoading, isFetching, isError, error, refetch } = useMailList(
    { account: current?.user, page, pageSize: PAGE_SIZE, q: query, unread: unreadOnly },
    !!status,
  );

  const selectBox = (user: string) => {
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('box', user); return next; }, { replace: true });
    setPage(1);
    setOpenId(null);
  };

  // Поиск — после паузы в наборе, с первой страницы
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await mailApi.sync();
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось проверить почту');
    } finally {
      setSyncing(false);
    }
  };

  const handleReadAll = async () => {
    try {
      await mailApi.markAllRead(current?.user);
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось отметить письма');
    }
  };

  const items = data?.items ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Почта</h1>
        {accounts.length === 1 && <span className={styles.account}>{accounts[0].user}</span>}
        <div className={styles.headerActions}>
          <Tooltip title={accounts.length > 1 ? 'Отметить все в этом ящике прочитанными' : 'Отметить все прочитанными'}>
            <Button icon={<CheckOutlined />} onClick={handleReadAll} />
          </Tooltip>
          <Tooltip title="Проверить почту">
            <Button icon={<ReloadOutlined />} loading={syncing} onClick={handleSync} />
          </Tooltip>
        </div>
      </div>

      {status && !status.configured && (
        <Alert
          type="info"
          showIcon
          className={styles.alert}
          message="Почта не подключена"
          description="Добавьте MAIL_USER и MAIL_PASSWORD (второй ящик — MAIL2_USER и MAIL2_PASSWORD) в .env на сервере и перезапустите CRM."
        />
      )}
      {accounts.length > 1 && (
        <div className={styles.boxes} role="tablist" aria-label="Почтовый ящик">
          {accounts.map(a => (
            <button
              key={a.user}
              type="button"
              role="tab"
              aria-selected={a.user === current?.user}
              className={cn(styles.box, { [styles.boxActive]: a.user === current?.user })}
              onClick={() => selectBox(a.user)}
            >
              <span className={styles.boxName}>{a.user}</span>
              <Badge count={a.unread} size="small" overflowCount={99} />
            </button>
          ))}
        </div>
      )}

      {current && !current.connected && current.lastError && (
        <Alert
          type="warning"
          showIcon
          className={styles.alert}
          message="Нет связи с почтовым сервером"
          description={`${accounts.length > 1 ? `${current.user}: ` : ''}${current.lastError}. CRM переподключится сама через минуту.`}
        />
      )}

      <div className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Поиск по теме, отправителю, тексту"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.search}
        />
        <Segmented
          value={unreadOnly ? 'unread' : 'all'}
          onChange={v => { setUnreadOnly(v === 'unread'); setPage(1); }}
          options={[{ value: 'all', label: 'Все' }, { value: 'unread', label: 'Непрочитанные' }]}
        />
      </div>

      {isError && <LoadError title="Не удалось загрузить письма" error={error} onRetry={() => refetch()} />}

      <Spin spinning={isLoading || (isFetching && !data)}>
        {!isLoading && items.length === 0 ? (
          <Empty className={styles.empty} description={query || unreadOnly ? 'Ничего не найдено' : 'Писем пока нет'} />
        ) : (
          <ul className={styles.list}>
            {items.map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  className={cn(styles.item, { [styles.unread]: !m.isRead, [styles.selected]: m.id === openId })}
                  onClick={() => setOpenId(m.id)}
                >
                  <span className={styles.itemTop}>
                    <span className={styles.from}>{senderLabel(m)}</span>
                    {m.attachmentsCount > 0 && <PaperClipOutlined className={styles.clip} />}
                    <span className={styles.date}>{formatMailDate(m.date)}</span>
                  </span>
                  <span className={styles.subject}>{m.subject || '(без темы)'}</span>
                  {m.preview && <span className={styles.preview}>{m.preview}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Spin>

      {(data?.total ?? 0) > PAGE_SIZE && (
        <Pagination
          className={styles.pagination}
          current={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onChange={p => { setPage(p); window.scrollTo({ top: 0 }); }}
          showSizeChanger={false}
          size="small"
        />
      )}

      <MailMessageDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};
