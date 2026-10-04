import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Col, Form, Input, Modal, Row, Select } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { Category, DocumentTemplate } from '@/types';
import { DEFAULT_COMPLETION_ACT_CONTENT, DEFAULT_WORK_ORDER_CONTENT } from '../defaultTemplates';
import styles from './TemplateModal.module.scss';

export type TemplateType = 'work_order' | 'completion_act';

interface Props {
  open: boolean;
  type: TemplateType;
  /** Редактируемый шаблон; без него — создание с текстом по умолчанию */
  template: DocumentTemplate | null;
  /** Шаблон по умолчанию предлагается, если других шаблонов этого типа ещё нет */
  isFirstOfType: boolean;
  categories: Category[];
  onClose: () => void;
}

interface TemplateFormValues {
  name: string;
  isDefault: boolean;
  categoryId: string | null;
  content: string;
}

const required = [{ required: true, message: 'Обязательное поле' }];

export const TemplateModal: React.FC<Props> = ({ open, type, template, isFirstOfType, categories, onClose }) => {
  const [form] = Form.useForm<TemplateFormValues>();
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const invalidate = useInvalidateReference();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(template
      ? { name: template.name, isDefault: template.isDefault, categoryId: template.categoryId || null, content: template.content }
      : {
        name: type === 'completion_act' ? 'Акт (базовый)' : 'Заявка (базовый)',
        isDefault: isFirstOfType,
        categoryId: null,
        content: type === 'completion_act' ? DEFAULT_COMPLETION_ACT_CONTENT : DEFAULT_WORK_ORDER_CONTENT,
      });
  }, [open, template, type, isFirstOfType, form]);

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const payload = { ...values, type };
      if (template) {
        await servicesApi.updateDocTemplate(template.id, payload);
        notify.toast.success('Шаблон обновлён');
      } else {
        await servicesApi.createDocTemplate(payload);
        notify.toast.success('Шаблон создан');
      }
      await invalidate('docTemplates');
      onClose();
    } catch (e) {
      notify.error(e, 'Ошибка сохранения шаблона');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={template ? 'Редактировать шаблон' : type === 'completion_act' ? 'Новый шаблон акта' : 'Новый шаблон заявки'}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>Отмена</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>Сохранить</Button>,
      ]}
    >
      <Form form={form} layout="vertical" className={styles.form}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Название" name="name" rules={required}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Категория услуг" name="categoryId">
              <Select
                allowClear
                placeholder="Все категории (по умолчанию)"
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="isDefault" valuePropName="checked">
          <Checkbox>Использовать как шаблон по умолчанию</Checkbox>
        </Form.Item>

        <Form.Item
          label="Текст"
          name="content"
          rules={required}
          extra={type === 'completion_act'
            ? 'Прочерк «____» в тексте заменяется на гарантийный срок, выбранный при закрытии сделки.'
            : undefined}
        >
          <Input.TextArea rows={16} className={styles.content} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
