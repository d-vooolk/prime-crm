import React, { useEffect, useState } from 'react';
import { Button, Form, Grid, Input, Modal, Select, Upload } from 'antd';
import { CloseOutlined, PaperClipOutlined, SendOutlined } from '@ant-design/icons';
import { mailApi } from '@/api/mail.api';
import { useInvalidateMail } from '@/hooks/useMail';
import { useNotify } from '@/hooks/useNotify';
import { formatSize } from '../mail.utils';
import styles from './MailComposeModal.module.scss';

/** Черновик нового письма или ответа */
export interface MailDraft {
  account?: string;
  to?: string;
  subject?: string;
  text?: string;
  /** Письмо из CRM, на которое отвечаем */
  replyToId?: string;
}

interface Props {
  /** null — окно закрыто */
  draft: MailDraft | null;
  /** Ящики, от имени которых можно отправить */
  accounts: string[];
  onClose: () => void;
}

interface FormValues {
  account: string;
  to: string;
  cc?: string;
  subject?: string;
  text?: string;
}

/** Совпадает с лимитом сервера (routes/mail.routes.ts) */
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
const MAX_FILES = 10;

/** Новое письмо или ответ: отправка по SMTP от имени ящика, копия — в «Отправленные» */
export const MailComposeModal: React.FC<Props> = ({ draft, accounts, onClose }) => {
  const isMobile = !Grid.useBreakpoint().md;
  const [form] = Form.useForm<FormValues>();
  const [files, setFiles] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const notify = useNotify();
  const invalidate = useInvalidateMail();

  useEffect(() => {
    if (!draft) return;
    form.setFieldsValue({
      account: draft.account && accounts.includes(draft.account) ? draft.account : accounts[0],
      to: draft.to ?? '',
      cc: '',
      subject: draft.subject ?? '',
      text: draft.text ?? '',
    });
    setFiles([]);
    setShowCc(false);
  }, [draft, accounts, form]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const addFile = (file: File) => {
    setFiles(prev => {
      if (prev.length >= MAX_FILES) {
        notify.toast.warning(`Не больше ${MAX_FILES} вложений`);
        return prev;
      }
      if (prev.reduce((s, f) => s + f.size, 0) + file.size > MAX_TOTAL_BYTES) {
        notify.toast.warning(`Вложения вместе — не больше ${formatSize(MAX_TOTAL_BYTES)}`);
        return prev;
      }
      return [...prev, file];
    });
  };

  const send = async () => {
    const values = await form.validateFields();
    if (!values.text?.trim() && !files.length) {
      notify.toast.warning('Напишите текст письма или приложите файл');
      return;
    }
    setSending(true);
    try {
      const { savedToSent } = await mailApi.send({
        account: values.account,
        to: values.to,
        cc: values.cc,
        subject: values.subject ?? '',
        text: values.text ?? '',
        replyToId: draft?.replyToId,
        files,
      });
      notify.toast.success(savedToSent ? 'Письмо отправлено' : 'Письмо отправлено, но копия не сохранилась в «Отправленных»');
      void invalidate();
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось отправить письмо');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={!!draft}
      onCancel={onClose}
      // Набранный текст не теряется от случайного нажатия мимо окна
      maskClosable={false}
      title={draft?.replyToId ? 'Ответ' : 'Новое письмо'}
      width={isMobile ? '100%' : 720}
      className={isMobile ? styles.mobile : undefined}
      footer={(
        <div className={styles.footer}>
          <Upload
            multiple
            showUploadList={false}
            beforeUpload={file => { addFile(file); return false; }}
          >
            <Button icon={<PaperClipOutlined />}>{!isMobile && 'Прикрепить'}</Button>
          </Upload>
          <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={send}>Отправить</Button>
        </div>
      )}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className={styles.form}>
        {accounts.length > 1 && (
          <Form.Item label="От кого" name="account" rules={[{ required: true, message: 'Выберите ящик' }]}>
            <Select options={accounts.map(a => ({ value: a, label: a }))} />
          </Form.Item>
        )}
        {accounts.length <= 1 && <Form.Item name="account" hidden><Input /></Form.Item>}
        <Form.Item
          label="Кому"
          name="to"
          rules={[{ required: true, whitespace: true, message: 'Укажите адрес получателя' }]}
          extra={!showCc && (
            <Button type="link" size="small" className={styles.ccToggle} onClick={() => setShowCc(true)}>Копия</Button>
          )}
        >
          <Input placeholder="адрес@почта.by, несколько — через запятую" inputMode="email" autoComplete="email" />
        </Form.Item>
        {showCc && (
          <Form.Item label="Копия" name="cc">
            <Input placeholder="адрес@почта.by" inputMode="email" />
          </Form.Item>
        )}
        <Form.Item label="Тема" name="subject">
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item name="text" className={styles.textItem}>
          <Input.TextArea autoSize={{ minRows: 8, maxRows: 20 }} placeholder="Текст письма" />
        </Form.Item>
      </Form>

      {files.length > 0 && (
        <div className={styles.files}>
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className={styles.file}>
              <PaperClipOutlined />
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.secondary}>{formatSize(f.size)}</span>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                aria-label="Убрать вложение"
                onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
              />
            </span>
          ))}
          <span className={styles.secondary}>Всего {formatSize(totalSize)}</span>
        </div>
      )}
    </Modal>
  );
};
