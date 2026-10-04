import React, { useEffect, useState } from 'react';
import { Button, ColorPicker, Form, Input, Modal } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { Category } from '@/types';
import styles from './CategoryModal.module.scss';

interface Props {
  open: boolean;
  /** Редактируемая категория; без неё — создание */
  category?: Category;
  onClose: () => void;
}

export const CategoryModal: React.FC<Props> = ({ open, category, onClose }) => {
  const [form] = Form.useForm<{ name: string }>();
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const invalidate = useInvalidateReference();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (category) form.setFieldsValue({ name: category.name });
    setColor(category?.color ?? null);
  }, [open, category, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (category) await servicesApi.updateCategory(category.id, { name: values.name, color });
      else await servicesApi.createCategory(values.name, color);
      notify.toast.success('Сохранено');
      await invalidate('serviceCategories');
      onClose();
    } catch (e) {
      notify.error(e, 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okButtonProps={{ loading: saving }}
      title={category ? 'Редактировать категорию' : 'Новая категория'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Название" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Цвет карточек">
          <div className={styles.colorRow}>
            <ColorPicker
              value={color ?? undefined}
              onChange={(_, hex) => setColor(hex)}
              format="hex"
              showText
            />
            {color && (
              <Button size="small" type="link" className={styles.resetBtn} onClick={() => setColor(null)}>
                Сбросить
              </Button>
            )}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
