import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Form, Input, Modal, Popconfirm, Spin } from 'antd';
import { DeleteOutlined, EditOutlined, PhoneOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Contact, contactsApi, ContactPayload } from '@/api/contacts.api';
import { useContacts, useInvalidateContacts } from '@/hooks/useContacts';
import { useNotify } from '@/hooks/useNotify';
import { LoadError } from '@/components/Shared/LoadError';
import styles from './ContactsPage.module.scss';

/** Ссылка для звонка с телефона */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

const matches = (c: Contact, query: string) =>
  [c.name, c.phone, c.comment].some(v => v?.toLowerCase().includes(query));

/** Полезные контакты компании (менеджер и выше): поставщики, службы, партнёры */
export const ContactsPage: React.FC = () => {
  const notify = useNotify();
  const invalidate = useInvalidateContacts();
  const { data: contacts = [], isLoading, isError, error, refetch } = useContacts();
  const [search, setSearch] = useState('');
  // undefined — окно закрыто, null — новый контакт
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ContactPayload>();

  const query = search.trim().toLowerCase();
  const visible = useMemo(() => (query ? contacts.filter(c => matches(c, query)) : contacts), [contacts, query]);

  useEffect(() => {
    if (editing === undefined) return;
    form.resetFields();
    if (editing) form.setFieldsValue({ name: editing.name, phone: editing.phone, comment: editing.comment });
  }, [editing, form]);

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const payload = { name: values.name, phone: values.phone || null, comment: values.comment || null };
      if (editing) await contactsApi.update(editing.id, payload);
      else await contactsApi.create(payload);
      notify.toast.success(editing ? 'Контакт сохранён' : 'Контакт добавлен');
      setEditing(undefined);
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось сохранить контакт');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    try {
      await contactsApi.delete(contact.id);
      notify.toast.success('Контакт удалён');
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось удалить контакт');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Контакты</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>Добавить</Button>
      </div>

      <Input
        className={styles.search}
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Поиск по названию, телефону, комментарию"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {isError && <LoadError title="Не удалось загрузить контакты" error={error} onRetry={() => refetch()} />}

      {isLoading ? (
        <div className={styles.loader}><Spin /></div>
      ) : visible.length === 0 && !isError ? (
        <Empty className={styles.empty} description={query ? 'Ничего не найдено' : 'Контактов пока нет'} />
      ) : (
        <div className={styles.list}>
          {visible.map(contact => (
            <article key={contact.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.name}>{contact.name}</span>
                <div className={styles.cardActions}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditing(contact)} aria-label="Изменить" />
                  <Popconfirm title="Удалить контакт?" okText="Удалить" cancelText="Отмена" onConfirm={() => handleDelete(contact)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Удалить" />
                  </Popconfirm>
                </div>
              </div>
              {contact.phone && (
                <a className={styles.phone} href={telHref(contact.phone)}>
                  <PhoneOutlined /> {contact.phone}
                </a>
              )}
              {contact.comment && <p className={styles.comment}>{contact.comment}</p>}
            </article>
          ))}
        </div>
      )}

      <Modal
        title={editing ? 'Изменить контакт' : 'Новый контакт'}
        open={editing !== undefined}
        onCancel={() => setEditing(undefined)}
        onOk={handleSave}
        okText="Сохранить"
        cancelText="Отмена"
        okButtonProps={{ loading: saving }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название или имя" rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}>
            <Input placeholder="Например: Шиномонтаж на Тимирязева" maxLength={200} />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input inputMode="tel" placeholder="+375 (29) 123-45-67" maxLength={100} />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 12 }} placeholder="Адрес, сайт, кто отвечает, другие телефоны..." maxLength={5000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
