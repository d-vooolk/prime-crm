import React, { useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useEquipment, useInvalidateReference } from '@/hooks/useReferenceData';
import { Equipment } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { formatThousands } from '../servicesPage.utils';
import { LoadError } from '@/components/Shared/LoadError';
import styles from './EquipmentTab.module.scss';

interface EquipmentFormValues {
  name: string;
  warranty?: string;
  wholesalePrice?: number | null;
  retailPrice?: number | null;
}

const dash = (className: string) => <span className={className}>—</span>;

/** Справочник Bi-Led модулей (оборудование, устанавливаемое в сделках) */
export const EquipmentTab: React.FC = () => {
  const { data: equipment = [], isLoading, isError, error, refetch } = useEquipment();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const [form] = Form.useForm<EquipmentFormValues>();
  const [modal, setModal] = useState<{ open: boolean; item?: Equipment }>({ open: false });
  const [saving, setSaving] = useState(false);

  const openModal = (item?: Equipment) => {
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        name: item.name,
        warranty: item.warranty || '',
        wholesalePrice: item.wholesalePrice ?? null,
        retailPrice: item.retailPrice ?? null,
      });
    }
    setModal({ open: true, item });
  };

  const closeModal = () => {
    setModal({ open: false });
    form.resetFields();
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = {
      name: values.name,
      warranty: values.warranty || undefined,
      wholesalePrice: values.wholesalePrice ?? undefined,
      retailPrice: values.retailPrice ?? undefined,
    };
    setSaving(true);
    try {
      if (modal.item) await servicesApi.updateEquipment(modal.item.id, payload);
      else await servicesApi.createEquipment(payload);
      notify.toast.success('Сохранено');
      await invalidate('equipment');
      closeModal();
    } catch (e) {
      notify.error(e, 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await servicesApi.deleteEquipment(id);
      await invalidate('equipment');
    } catch (e) {
      notify.error(e, 'Невозможно удалить: оборудование используется в сделках');
    }
  };

  const priceCell = (v: number) => (v != null ? <span>{formatPrice(v)}</span> : dash(styles.muted));

  return (
    <div>
      <div className={styles.toolbar}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Добавить
        </Button>
      </div>
      {isError && <LoadError title="Не удалось загрузить оборудование" error={error} onRetry={() => refetch()} />}
      <Table
        dataSource={equipment}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={isLoading}
        columns={[
          { title: 'Название модулей', dataIndex: 'name', key: 'name', render: (n: string) => <span className={styles.strong}>{n}</span> },
          {
            title: 'Гарантия', dataIndex: 'warranty', key: 'warranty', width: 130,
            render: (w: string) => (w ? <Tag color="green">{w}</Tag> : dash(styles.muted)),
          },
          { title: 'Опт. цена', dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 110, render: priceCell },
          { title: 'Розн. цена', dataIndex: 'retailPrice', key: 'retailPrice', width: 110, render: priceCell },
          {
            title: '', key: 'actions', width: 80,
            render: (_: unknown, row: Equipment) => (
              <Space size="small">
                <Button size="small" icon={<EditOutlined />} onClick={() => openModal(row)} />
                <Popconfirm title="Удалить?" onConfirm={() => handleDelete(row.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={modal.open}
        onCancel={closeModal}
        onOk={handleSave}
        okButtonProps={{ loading: saving }}
        title={modal.item ? 'Редактировать Bi-Led модуль' : 'Добавить Bi-Led модуль'}
        width={480}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Название модулей" name="name" rules={[{ required: true }]}>
            <Input placeholder="Например: Bi-LED модуль GTR Falcon" />
          </Form.Item>
          <Form.Item label="Гарантия от производителей" name="warranty">
            <Input placeholder="Например: 2 года" />
          </Form.Item>
          <Form.Item label="Оптовая цена (р.)" name="wholesalePrice">
            <InputNumber className={styles.fullWidth} min={0} formatter={formatThousands} placeholder="0" />
          </Form.Item>
          <Form.Item label="Розничная цена (р.)" name="retailPrice">
            <InputNumber className={styles.fullWidth} min={0} formatter={formatThousands} placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
