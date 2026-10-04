import React, { useEffect, useState } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { Serviceman } from '@/types';
import { buildServicemanPayload, ServicemanFormValues, servicemanToFormValues } from '../servicesPage.utils';
import styles from './ServicemanModal.module.scss';

interface Props {
  open: boolean;
  /** Редактируемый сотрудник; без него — создание */
  item?: Serviceman;
  /** Роли, которые текущий пользователь может назначать */
  allowedRoles: string[];
  onClose: () => void;
}

export const ServicemanModal: React.FC<Props> = ({ open, item, allowedRoles, onClose }) => {
  const [form] = Form.useForm<ServicemanFormValues>();
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const invalidate = useInvalidateReference();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (item) form.setFieldsValue(servicemanToFormValues(item));
  }, [open, item, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = buildServicemanPayload(values);
      if (item) await servicesApi.updateServiceman(item.id, payload);
      else await servicesApi.createServiceman(payload);
      notify.toast.success('Сохранено');
      await invalidate('servicemen');
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
      title={item ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item label="ФИО" name="name" rules={[{ required: true, message: 'Введите ФИО' }]}>
          <Input prefix={<UserOutlined />} placeholder="Иванов Иван" />
        </Form.Item>
        <Form.Item label="Должность" name="position">
          <Input placeholder="Мастер-установщик" />
        </Form.Item>
        <Form.Item label="Роль" name="role">
          <Select
            allowClear
            placeholder="Выберите роль"
            options={allowedRoles.map(r => ({ value: r, label: r }))}
          />
        </Form.Item>
        <Form.Item label="Email" name="email">
          <Input type="email" placeholder="example@mail.com" />
        </Form.Item>
        {/* Сервер пароль не отдаёт: при редактировании поле пустое и необязательное */}
        <Form.Item
          label="Пароль"
          name="password"
          extra={item ? 'Оставьте пустым, чтобы не менять пароль' : undefined}
        >
          <Input.Password
            placeholder={item ? '••••••••' : 'Пароль для входа в систему'}
            autoComplete="new-password"
            visibilityToggle
          />
        </Form.Item>
        <Form.Item label="Дата рождения" name="birthday">
          <DatePicker className={styles.fullWidth} format="DD.MM.YYYY" placeholder="Выберите дату" />
        </Form.Item>
        <Form.Item
          label="Оклад за месяц (р.)"
          name="baseSalary"
          tooltip="Начисляется каждый расчётный период (с 25-го по 24-е). Новый оклад действует с текущего периода, прошлые месяцы не пересчитываются"
        >
          <InputNumber min={0} step={50} precision={2} className={styles.fullWidth} placeholder="0" />
        </Form.Item>
        <Form.Item
          label="Процент от чистой прибыли (%)"
          name="profitPercent"
          tooltip="Процент, который сотрудник получает от чистой прибыли по каждой услуге"
        >
          <InputNumber min={0} max={100} step={0.5} className={styles.fullWidth} placeholder="0" />
        </Form.Item>
        <div className={styles.switchRow}>
          <Form.Item name="isPerformer" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
          <span>Выполняет работы — показывать в списке исполнителей</span>
        </div>
        <div className={styles.switchRow}>
          <Form.Item name="isReceptionist" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
          <span>Мастер приёмщик</span>
        </div>
      </Form>
    </Modal>
  );
};
