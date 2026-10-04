import React, { useEffect } from 'react';
import { DatePicker, Form, Input, Modal, Select, Switch, TimePicker } from 'antd';
import dayjs from 'dayjs';
import type { Note } from '@/types';
import type { NoteFormValues } from '../notesHelpers';
import styles from './NoteFormModal.module.scss';

interface Props {
  open: boolean;
  /** null — создание новой заметки */
  note: Note | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: NoteFormValues) => void;
}

const REPEAT_OPTIONS = [
  { value: 'DAILY', label: 'Каждый день' },
  { value: 'WEEKLY', label: 'Каждую неделю' },
  { value: 'MONTHLY', label: 'Каждый месяц' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Низкий' },
  { value: 'MEDIUM', label: 'Средний' },
  { value: 'HIGH', label: 'Высокий' },
];

export const NoteFormModal: React.FC<Props> = ({ open, note, saving, onCancel, onSubmit }) => {
  const [form] = Form.useForm<NoteFormValues>();
  const formDate = Form.useWatch('date', form);
  const formAllDay = Form.useWatch('allDay', form);
  const formHasRepeat = Form.useWatch('hasRepeat', form);

  // Заполняем форму при каждом открытии: новая заметка или правка существующей
  useEffect(() => {
    if (!open) return;
    if (note) {
      form.setFieldsValue({
        text: note.text,
        date: note.date ? dayjs(note.date) : null,
        allDay: note.allDay,
        time: note.time ? dayjs(note.time, 'HH:mm') : null,
        hasRepeat: !!note.repeat,
        repeat: note.repeat ?? 'DAILY',
        priority: note.priority,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ allDay: true, priority: 'LOW', hasRepeat: false });
    }
  }, [open, note, form]);

  const handleOk = async () => {
    // Ошибки валидации antd показывает у полей сам
    const values = await form.validateFields().catch(() => null);
    if (values) onSubmit(values);
  };

  return (
    <Modal
      title={note ? 'Редактировать заметку' : 'Новая заметка'}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Сохранить"
      cancelText="Отмена"
      okButtonProps={{ loading: saving }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className={styles.form}>
        <Form.Item
          name="text"
          label="Текст заметки"
          rules={[{ required: true, message: 'Введите текст заметки' }]}
        >
          <Input.TextArea rows={3} placeholder="Введите заметку..." />
        </Form.Item>

        <Form.Item name="date" label="Дата (необязательно)">
          <DatePicker className={styles.fullWidth} format="DD.MM.YYYY" allowClear />
        </Form.Item>

        {formDate && (
          <Form.Item name="allDay" label="Весь день" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        )}

        {formDate && formAllDay === false && (
          <Form.Item name="time" label="Время">
            <TimePicker className={styles.fullWidth} format="HH:mm" minuteStep={5} needConfirm={false} />
          </Form.Item>
        )}

        {formDate && (
          <Form.Item name="hasRepeat" label="Повтор" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}

        {formDate && formHasRepeat && (
          <Form.Item name="repeat" label="Частота повтора">
            <Select options={REPEAT_OPTIONS} />
          </Form.Item>
        )}

        <Form.Item name="priority" label="Приоритет">
          <Select options={PRIORITY_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
