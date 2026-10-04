import React, { useEffect, useState } from 'react';
import { Checkbox, Form, Input, InputNumber, Modal, Select } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { Category, Service } from '@/types';
import styles from './ServiceModal.module.scss';

interface Props {
  open: boolean;
  /** Редактируемая услуга; без неё — создание */
  service?: Service;
  /** Категория, в которую добавляют услугу */
  categoryId?: string;
  categories: Category[];
  onClose: () => void;
}

interface ServiceFormValues {
  name: string;
  categoryId: string;
  standardPrice: number;
  estimatedTime: number;
  hasEquipment?: boolean;
  isProduct?: boolean;
}

export const ServiceModal: React.FC<Props> = ({ open, service, categoryId, categories, onClose }) => {
  const [form] = Form.useForm<ServiceFormValues>();
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const invalidate = useInvalidateReference();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (service) {
      form.setFieldsValue({
        name: service.name,
        categoryId: service.categoryId,
        standardPrice: service.standardPrice,
        estimatedTime: service.estimatedTime,
        hasEquipment: service.hasEquipment ?? false,
        isProduct: service.isProduct ?? false,
      });
    } else if (categoryId) {
      form.setFieldsValue({ categoryId });
    }
  }, [open, service, categoryId, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (service) await servicesApi.updateService(service.id, values);
      else await servicesApi.createService(values);
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
      title={service ? 'Редактировать услугу' : 'Новая услуга'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Категория" name="categoryId" rules={[{ required: true }]}>
          <Select options={categories.map(c => ({ value: c.id, label: c.name }))} />
        </Form.Item>
        <Form.Item label="Название" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Стандартная цена (₽)" name="standardPrice" rules={[{ required: true }]}>
          <InputNumber className={styles.fullWidth} min={0} />
        </Form.Item>
        <Form.Item label="Ориентировочное время (мин)" name="estimatedTime" rules={[{ required: true }]}>
          <InputNumber className={styles.fullWidth} min={0} step={15} />
        </Form.Item>
        <Form.Item name="hasEquipment" valuePropName="checked">
          <Checkbox>Услуга с сопутствующим оборудованием (Bi-Led модули)</Checkbox>
        </Form.Item>
        <Form.Item name="isProduct" valuePropName="checked">
          <Checkbox>Товар (не учитывается в зарплате сотрудников)</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};
