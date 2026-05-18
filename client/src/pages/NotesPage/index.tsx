import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Select, Form, Input, DatePicker, TimePicker,
  Switch, Modal, Tag, Empty, Spin, Popconfirm, message, Space,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, CheckCircleFilled, CalendarOutlined,
  ClockCircleOutlined, RetweetOutlined, InboxOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import cn from 'classnames';
import { Note, NotePriority, NoteRepeat, Serviceman } from '@/types';
import { notesApi, NotePayload } from '@/api/notes.api';
import { servicesApi } from '@/api/services.api';
import { useAuthStore } from '@/store/authStore';
import styles from './NotesPage.module.scss';

const CREATOR_ROLES = ['Создатель'];
const MANAGER_ROLES = ['Создатель', 'Директор', 'Менеджер'];

const PRIORITY_LABEL: Record<NotePriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
};

const PRIORITY_COLOR: Record<NotePriority, string> = {
  LOW: '#1890ff',
  MEDIUM: '#fa8c16',
  HIGH: '#ff4d4f',
};

const REPEAT_LABEL: Record<NoteRepeat, string> = {
  DAILY: 'Каждый день',
  WEEKLY: 'Каждую неделю',
  MONTHLY: 'Каждый месяц',
};

export const NotesPage: React.FC = () => {
  const { user } = useAuthStore();
  const isCreator = (user?.isMaster || CREATOR_ROLES.includes(user?.role || ''));

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const formDate = Form.useWatch('date', form);
  const formAllDay = Form.useWatch('allDay', form);
  const formHasRepeat = Form.useWatch('hasRepeat', form);

  useEffect(() => {
    if (isCreator) {
      servicesApi.getAllServicemen()
        .then(all => setServicemen(all.filter(s => !s.isDismissed)))
        .catch(() => {});
    }
  }, [isCreator]);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const target = isCreator && viewingId ? viewingId : undefined;
      setNotes(await notesApi.getAll(target, showArchive));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [isCreator, viewingId, showArchive]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleToggleDone = async (note: Note) => {
    try {
      await notesApi.update(note.id, { isDone: !note.isDone });
      loadNotes();
    } catch { message.error('Ошибка'); }
  };

  const openCreate = () => {
    setEditingNote(null);
    form.resetFields();
    form.setFieldsValue({ allDay: true, priority: 'LOW', hasRepeat: false });
    setModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    form.setFieldsValue({
      text: note.text,
      date: note.date ? dayjs(note.date) : null,
      allDay: note.allDay,
      time: note.time ? dayjs(note.time, 'HH:mm') : null,
      hasRepeat: !!note.repeat,
      repeat: note.repeat ?? 'DAILY',
      priority: note.priority,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const hasDate = !!values.date;
      const isAllDay = values.allDay ?? true;
      const payload: NotePayload = {
        text: values.text,
        date: hasDate ? (values.date as Dayjs).toISOString() : null,
        allDay: isAllDay,
        time: (hasDate && !isAllDay && values.time)
          ? (values.time as Dayjs).format('HH:mm')
          : null,
        repeat: (hasDate && values.hasRepeat && values.repeat) ? values.repeat : null,
        priority: values.priority ?? 'LOW',
        ...(isCreator && viewingId ? { servicemanId: viewingId } : {}),
      };
      if (editingNote) {
        await notesApi.update(editingNote.id, payload);
        message.success('Заметка обновлена');
      } else {
        await notesApi.create(payload);
        message.success('Заметка добавлена');
      }
      setModalOpen(false);
      loadNotes();
    } catch { message.error('Ошибка при сохранении'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await notesApi.delete(id);
      loadNotes();
    } catch { message.error('Ошибка при удалении'); }
  };

  const canManageNote = (note: Note) =>
    isCreator || note.servicemanId === user?.id || MANAGER_ROLES.includes(user?.role || '');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Заметки</h1>
        <div className={styles.headerActions}>
          <Button
            icon={showArchive ? <UnorderedListOutlined /> : <InboxOutlined />}
            onClick={() => setShowArchive(v => !v)}
          >
            {showArchive ? 'Активные' : 'Архив'}
          </Button>
          {!showArchive && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Добавить
            </Button>
          )}
        </div>
      </div>

      {isCreator && (
        <div className={styles.employeeRow}>
          <Select
            placeholder="Мои заметки"
            value={viewingId ?? undefined}
            onChange={v => setViewingId(v ?? null)}
            allowClear
            onClear={() => setViewingId(null)}
            style={{ width: 240 }}
            options={servicemen.map(s => ({ value: s.id, label: s.name }))}
          />
        </div>
      )}

      <Spin spinning={loading}>
        {notes.length === 0 && !loading ? (
          <Empty
            description={showArchive ? 'Архив пуст' : 'Заметок нет'}
            style={{ marginTop: 60 }}
          />
        ) : (
          <div className={styles.list}>
            {notes.map(note => (
              <div
                key={note.id}
                className={cn(
                  styles.card,
                  {
                    [styles.priorityLow]: note.priority === 'LOW',
                    [styles.priorityMedium]: note.priority === 'MEDIUM',
                    [styles.priorityHigh]: note.priority === 'HIGH',
                    [styles.done]: note.isDone,
                  }
                )}
              >
                <button
                  className={cn(styles.checkBtn, { [styles.checkBtnDone]: note.isDone })}
                  onClick={() => handleToggleDone(note)}
                  title={note.isDone ? 'Восстановить' : 'Отметить выполненным'}
                >
                  {note.isDone
                    ? <CheckCircleFilled style={{ color: 'var(--color-success)' }} />
                    : <CheckCircleOutlined />}
                </button>

                <div className={styles.cardBody}>
                  <div className={styles.cardText}>{note.text}</div>
                  {(note.date || note.time) && (
                    <div className={styles.cardMeta}>
                      {note.date && (
                        <span className={styles.metaItem}>
                          <CalendarOutlined />
                          {dayjs(note.date).format('DD.MM.YYYY')}
                        </span>
                      )}
                      {note.allDay && note.date && (
                        <span className={styles.metaItem}>Весь день</span>
                      )}
                      {!note.allDay && note.time && (
                        <span className={styles.metaItem}>
                          <ClockCircleOutlined />
                          {note.time}
                        </span>
                      )}
                      {note.repeat && (
                        <span className={styles.metaItem}>
                          <RetweetOutlined />
                          {REPEAT_LABEL[note.repeat as NoteRepeat]}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.cardRight}>
                  <Tag
                    style={{
                      borderColor: PRIORITY_COLOR[note.priority],
                      color: PRIORITY_COLOR[note.priority],
                      flexShrink: 0,
                    }}
                  >
                    {PRIORITY_LABEL[note.priority]}
                  </Tag>
                  {canManageNote(note) && (
                    <Space size={2} className={styles.cardActions}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(note)}
                      />
                      <Popconfirm
                        title="Удалить заметку?"
                        onConfirm={() => handleDelete(note.id)}
                        okText="Да"
                        cancelText="Нет"
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Spin>

      <Modal
        title={editingNote ? 'Редактировать заметку' : 'Новая заметка'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Сохранить"
        cancelText="Отмена"
        okButtonProps={{ loading: saving }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="text"
            label="Текст заметки"
            rules={[{ required: true, message: 'Введите текст заметки' }]}
          >
            <Input.TextArea rows={3} placeholder="Введите заметку..." />
          </Form.Item>

          <Form.Item name="date" label="Дата (необязательно)">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" allowClear />
          </Form.Item>

          {formDate && (
            <Form.Item name="allDay" label="Весь день" valuePropName="checked">
              <Switch defaultChecked />
            </Form.Item>
          )}

          {formDate && formAllDay === false && (
            <Form.Item name="time" label="Время">
              <TimePicker
                style={{ width: '100%' }}
                format="HH:mm"
                minuteStep={5}
                needConfirm={false}
              />
            </Form.Item>
          )}

          {formDate && (
            <Form.Item name="hasRepeat" label="Повтор" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}

          {formDate && formHasRepeat && (
            <Form.Item name="repeat" label="Частота повтора">
              <Select
                options={[
                  { value: 'DAILY', label: 'Каждый день' },
                  { value: 'WEEKLY', label: 'Каждую неделю' },
                  { value: 'MONTHLY', label: 'Каждый месяц' },
                ]}
              />
            </Form.Item>
          )}

          <Form.Item name="priority" label="Приоритет">
            <Select
              options={[
                { value: 'LOW', label: 'Низкий' },
                { value: 'MEDIUM', label: 'Средний' },
                { value: 'HIGH', label: 'Высокий' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
