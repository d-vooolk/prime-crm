import React, { useEffect, useState } from 'react';
import { Button, Drawer, Grid, Popconfirm, Space, Spin, Tooltip } from 'antd';
import { DeleteOutlined, EyeInvisibleOutlined, PaperClipOutlined, StopOutlined } from '@ant-design/icons';
import { mailApi } from '@/api/mail.api';
import { useInvalidateMail, useMailMessage } from '@/hooks/useMail';
import { useNotify } from '@/hooks/useNotify';
import { formatDateTime } from '@/utils/formatters';
import { MailAttachment } from '@/types';
import { buildMailSrcDoc, formatSize, senderLabel } from '../mail.utils';
import styles from './MailMessageDrawer.module.scss';

interface Props {
  /** Открытое письмо; null — закрыто */
  id: string | null;
  onClose: () => void;
}

/** Письмо целиком. На телефоне — на весь экран */
export const MailMessageDrawer: React.FC<Props> = ({ id, onClose }) => {
  const isMobile = !Grid.useBreakpoint().md;
  const { data: msg, isLoading } = useMailMessage(id);
  const invalidate = useInvalidateMail();
  const notify = useNotify();
  const [downloading, setDownloading] = useState<string | null>(null);

  // Сервер отметил письмо прочитанным — обновляем список и счётчики в меню
  useEffect(() => {
    if (msg) void invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg?.id]);

  const download = async (att: MailAttachment) => {
    setDownloading(att.id);
    try {
      const blob = await mailApi.getAttachment(att.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    } catch (e) {
      notify.error(e, 'Не удалось скачать вложение');
    } finally {
      setDownloading(null);
    }
  };

  const markUnread = async () => {
    if (!msg) return;
    try {
      await mailApi.setRead(msg.id, false);
      await invalidate();
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось отметить письмо');
    }
  };

  // Письма больше нет: сначала закрываем окно, иначе обновление перезапросит
  // открытое письмо и покажет «Письмо не найдено»
  const closeRemoved = () => {
    onClose();
    void invalidate();
  };

  const [movingToSpam, setMovingToSpam] = useState(false);
  const toSpam = async () => {
    if (!msg) return;
    setMovingToSpam(true);
    try {
      await mailApi.moveToSpam(msg.id);
      notify.toast.success('Письмо перенесено в спам');
      closeRemoved();
    } catch (e) {
      notify.error(e, 'Не удалось перенести в спам');
    } finally {
      setMovingToSpam(false);
    }
  };

  const remove = async () => {
    if (!msg) return;
    try {
      await mailApi.deleteMessage(msg.id);
      closeRemoved();
    } catch (e) {
      notify.error(e, 'Не удалось удалить письмо');
    }
  };

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      width={isMobile ? '100%' : 760}
      title={msg?.subject || (isLoading ? '' : '(без темы)')}
      destroyOnHidden
      classNames={{ body: styles.body }}
      extra={msg && (
        <Space size="small">
          <Tooltip title="Отметить непрочитанным">
            <Button icon={<EyeInvisibleOutlined />} onClick={markUnread} />
          </Tooltip>
          <Popconfirm
            title="Перенести в спам?"
            description="Письмо уйдёт в папку «Спам» в почтовом ящике и пропадёт из CRM"
            okText="В спам"
            onConfirm={toSpam}
          >
            <Tooltip title="В спам">
              <Button icon={<StopOutlined />} loading={movingToSpam}>{!isMobile && 'В спам'}</Button>
            </Tooltip>
          </Popconfirm>
          <Popconfirm title="Удалить письмо из CRM?" description="В почтовом ящике оно останется" onConfirm={remove}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )}
    >
      {isLoading || !msg ? (
        <div className={styles.loading}><Spin /></div>
      ) : (
        <>
          <div className={styles.meta}>
            <div className={styles.from}>
              {senderLabel(msg)}
              {msg.fromName && msg.fromAddress && (
                <a href={`mailto:${msg.fromAddress}`} className={styles.address}>&lt;{msg.fromAddress}&gt;</a>
              )}
            </div>
            {msg.to && <div className={styles.secondary}>Кому: {msg.to}</div>}
            <div className={styles.secondary}>{formatDateTime(msg.date)}</div>
          </div>

          {msg.attachments.length > 0 && (
            <div className={styles.attachments}>
              {msg.attachments.map(att => (
                <Button
                  key={att.id}
                  size="small"
                  icon={<PaperClipOutlined />}
                  loading={downloading === att.id}
                  onClick={() => download(att)}
                  className={styles.attachment}
                >
                  <span className={styles.attachmentName}>{att.originalName}</span>
                  <span className={styles.secondary}>{formatSize(att.size)}</span>
                </Button>
              ))}
            </div>
          )}

          {msg.html ? (
            // Без allow-scripts и allow-same-origin: письмо не выполнит код и не достанет до CRM
            <iframe
              title="Письмо"
              className={styles.frame}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={buildMailSrcDoc(msg.html)}
            />
          ) : (
            <pre className={styles.text}>{msg.text || 'Письмо без текста'}</pre>
          )}
        </>
      )}
    </Drawer>
  );
};
