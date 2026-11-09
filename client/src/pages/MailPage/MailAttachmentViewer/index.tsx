import React, { useEffect, useMemo } from 'react';
import { Button, Grid, Image, Modal } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { isIos, isStandalone } from '@/pwa';
import { useNotify } from '@/hooks/useNotify';
import { MailAttachment } from '@/types';
import { formatSize } from '../mail.utils';
import styles from './MailAttachmentViewer.module.scss';

export interface LoadedAttachment {
  att: MailAttachment;
  blob: Blob;
}

interface Props {
  /** Загруженное вложение; null — окно закрыто */
  file: LoadedAttachment | null;
  onClose: () => void;
}

/**
 * Вложение письма — внутри приложения, с кнопкой закрытия. Ссылка download в установленном
 * приложении на iPhone уводила само окно на файл, и после закрытия оставался белый экран
 * без возможности вернуться. Сохранить файл там можно через «Поделиться».
 */
export const MailAttachmentViewer: React.FC<Props> = ({ file, onClose }) => {
  const isMobile = !Grid.useBreakpoint().md;
  const notify = useNotify();
  const url = useMemo(() => (file ? URL.createObjectURL(file.blob) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const shareFile = useMemo(() => {
    if (!file) return null;
    const f = new File([file.blob], file.att.originalName, { type: file.att.contentType || file.blob.type });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] }) ? f : null;
  }, [file]);
  // На iPhone в установленном приложении скачивание ломает окно — там только «Поделиться»
  const canDownload = !(isIos() && isStandalone() && shareFile);

  const share = async () => {
    if (!shareFile) return;
    try {
      await navigator.share({ files: [shareFile], title: shareFile.name });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') notify.error(e, 'Не удалось поделиться файлом');
    }
  };

  const download = () => {
    if (!url || !file) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.att.originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const type = file?.att.contentType || '';
  const isImage = !!file?.att.viewable && type.startsWith('image/');
  const isPdf = !!file?.att.viewable && type === 'application/pdf';

  return (
    <Modal
      open={!!file}
      onCancel={onClose}
      title={file?.att.originalName}
      width={isMobile ? '100%' : 900}
      centered={!isMobile}
      className={isMobile ? styles.mobile : undefined}
      classNames={{ body: styles.body }}
      footer={(
        <div className={styles.footer}>
          {shareFile && <Button icon={<ShareAltOutlined />} onClick={share}>Поделиться</Button>}
          {canDownload && <Button icon={<DownloadOutlined />} onClick={download}>Скачать</Button>}
          <Button type="primary" onClick={onClose}>Закрыть</Button>
        </div>
      )}
      destroyOnHidden
    >
      {file && url && (
        isImage ? (
          <div className={styles.image}><Image src={url} alt={file.att.originalName} /></div>
        ) : isPdf ? (
          <iframe title={file.att.originalName} src={url} className={styles.frame} />
        ) : (
          <div className={styles.noPreview}>
            <div>Просмотр этого файла в приложении недоступен</div>
            <div className={styles.secondary}>{formatSize(file.att.size)}</div>
          </div>
        )
      )}
    </Modal>
  );
};
