import React, { useState, useEffect } from 'react';
import { Button, Card, Table, Modal, Form, Input, InputNumber, Select, Popconfirm, message, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { Category, Service, Equipment, Serviceman } from '@/types';
import { formatPrice, formatDuration } from '@/utils/formatters';
import styles from './ServicesPage.module.scss';

export const ServicesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [serviceModal, setServiceModal] = useState<{ open: boolean; service?: Service; categoryId?: string }>({ open: false });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [equipmentModal, setEquipmentModal] = useState<{ open: boolean; item?: Equipment }>({ open: false });
  const [servicemanModal, setServicemanModal] = useState(false);

  const [form] = Form.useForm();

  const fetchAll = async () => {
    await Promise.all([
      servicesApi.getCategories().then(setCategories),
      servicesApi.getEquipment().then(setEquipment),
      servicesApi.getServicemen().then(setServicemen),
    ]);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSaveService = async () => {
    const values = await form.validateFields();
    if (serviceModal.service) {
      await servicesApi.updateService(serviceModal.service.id, values);
    } else {
      await servicesApi.createService(values);
    }
    message.success('Сохранено');
    setServiceModal({ open: false });
    fetchAll();
  };

  const handleSaveCategory = async () => {
    const values = await form.validateFields();
    if (categoryModal.category) {
      await servicesApi.updateCategory(categoryModal.category.id, values.name);
    } else {
      await servicesApi.createCategory(values.name);
    }
    message.success('Сохранено');
    setCategoryModal({ open: false });
    fetchAll();
  };

  const serviceColumns = [
    { title: 'Название', dataIndex: 'name', key: 'name', render: (n: string) => <span style={{ fontWeight: 500 }}>{n}</span> },
    { title: 'Цена', dataIndex: 'standardPrice', key: 'price', width: 120, render: (v: number) => formatPrice(v) },
    { title: 'Время', dataIndex: 'estimatedTime', key: 'time', width: 100, render: (v: number) => formatDuration(v) },
    {
      title: '', key: 'actions', width: 80,
      render: (_: unknown, row: Service) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            form.setFieldsValue(row);
            setServiceModal({ open: true, service: row });
          }} />
          <Popconfirm title="Удалить услугу?" onConfirm={async () => {
            await servicesApi.deleteService(row.id);
            fetchAll();
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Услуги и справочники</h1>
      </div>

      <Tabs
        items={[
          {
            key: 'services',
            label: 'Услуги',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCategoryModal({ open: true }); }}>
                    Категория
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setServiceModal({ open: true }); }}>
                    Услуга
                  </Button>
                </div>
                {categories.map(cat => (
                  <Card
                    key={cat.id}
                    size="small"
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{cat.name}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button size="small" icon={<PlusOutlined />} onClick={() => {
                            form.setFieldsValue({ categoryId: cat.id });
                            setServiceModal({ open: true, categoryId: cat.id });
                          }}>Добавить</Button>
                          <Popconfirm title="Удалить категорию?" onConfirm={async () => {
                            await servicesApi.deleteCategory(cat.id);
                            fetchAll();
                          }}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </div>
                      </div>
                    }
                  >
                    <Table
                      dataSource={cat.services}
                      columns={serviceColumns}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      locale={{ emptyText: 'Нет услуг' }}
                    />
                  </Card>
                ))}
              </div>
            ),
          },
          {
            key: 'equipment',
            label: 'Оборудование',
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEquipmentModal({ open: true }); }}>
                    Добавить
                  </Button>
                </div>
                <Table
                  dataSource={equipment}
                  rowKey="id"
                  size="middle"
                  pagination={false}
                  columns={[
                    { title: 'Название', dataIndex: 'name', key: 'name' },
                    {
                      title: '', key: 'actions', width: 80,
                      render: (_: unknown, row: Equipment) => (
                        <Popconfirm title="Удалить?" onConfirm={async () => { await servicesApi.deleteEquipment(row.id); fetchAll(); }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'servicemen',
            label: 'Мастера',
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setServicemanModal(true); }}>
                    Добавить мастера
                  </Button>
                </div>
                <Table
                  dataSource={servicemen}
                  rowKey="id"
                  size="middle"
                  pagination={false}
                  columns={[
                    { title: 'ФИО', dataIndex: 'name', key: 'name' },
                    {
                      title: '', key: 'actions', width: 80,
                      render: (_: unknown, row: Serviceman) => (
                        <Popconfirm title="Удалить?" onConfirm={async () => { await servicesApi.deleteServiceman(row.id); fetchAll(); }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />

      {/* Service modal */}
      <Modal open={serviceModal.open} onCancel={() => setServiceModal({ open: false })} onOk={handleSaveService}
        title={serviceModal.service ? 'Редактировать услугу' : 'Новая услуга'} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item label="Категория" name="categoryId" rules={[{ required: true }]}>
            <Select options={categories.map(c => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item label="Название" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Стандартная цена (₽)" name="standardPrice" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Ориентировочное время (мин)" name="estimatedTime" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={15} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Category modal */}
      <Modal open={categoryModal.open} onCancel={() => setCategoryModal({ open: false })} onOk={handleSaveCategory}
        title={categoryModal.category ? 'Редактировать категорию' : 'Новая категория'} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item label="Название" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Equipment modal */}
      <Modal open={equipmentModal.open} onCancel={() => setEquipmentModal({ open: false })}
        onOk={async () => {
          const v = await form.validateFields();
          await servicesApi.createEquipment(v.name);
          setEquipmentModal({ open: false });
          fetchAll();
        }}
        title="Добавить оборудование" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item label="Название" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Serviceman modal */}
      <Modal open={servicemanModal} onCancel={() => setServicemanModal(false)}
        onOk={async () => {
          const v = await form.validateFields();
          await servicesApi.createServiceman(v.name);
          setServicemanModal(false);
          fetchAll();
        }}
        title="Добавить мастера" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item label="ФИО мастера" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
