import React, { useEffect, useState } from 'react';
import { Form, Input, Modal } from 'antd';
import { stockApi } from '@/api/stock.api';
import { useNotify } from '@/hooks/useNotify';

interface Props {
  open: boolean;
  /** Переименование существующей категории */
  category?: { id: string; name: string } | null;
  /** Создание: родитель (null — категория верхнего уровня) и его путь для подписи */
  parent?: { id: string; path: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Создание категории/подкатегории склада или переименование */
export const StockCategoryModal: React.FC<Props> = ({ open, category, parent, onClose, onSaved }) => {
  const [form] = Form.useForm<{ name: string }>();
  const notify = useNotify();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) form.setFieldsValue({ name: category?.name ?? '' });
  }, [open, category, form]);

  const save = async () => {
    const { name } = await form.validateFields();
    setSaving(true);
    try {
      if (category) await stockApi.updateCategory(category.id, { name: name.trim() });
      else await stockApi.createCategory({ name: name.trim(), parentId: parent?.id ?? null });
      onSaved();
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось сохранить категорию');
    } finally {
      setSaving(false);
    }
  };

  const title = category ? 'Переименовать категорию' : parent ? `Подкатегория в «${parent.path}»` : 'Новая категория';

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}>
          <Input autoFocus maxLength={100} placeholder="Например: Плёнки" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
