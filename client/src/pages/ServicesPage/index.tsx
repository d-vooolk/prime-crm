import React, { useState, useEffect } from 'react';
import {
  Button, Table, Modal, Form, Input, InputNumber, Select,
  Popconfirm, message, Tabs, Checkbox, Tag, Space, Collapse, DatePicker, ColorPicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  StopOutlined, UserOutlined, BgColorsOutlined,
} from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useAuthStore } from '@/store/authStore';
import { Category, Service, Equipment, Serviceman } from '@/types';
import { formatPrice, formatDuration } from '@/utils/formatters';
import dayjs from 'dayjs';
import styles from './ServicesPage.module.scss';

const ROLE_LEVEL: Record<string, number> = { 'Создатель': 1, 'Директор': 2, 'Менеджер': 3, 'Сотрудник': 4 };
const ALL_ROLES = ['Создатель', 'Директор', 'Менеджер', 'Сотрудник'];
function getRoleLevel(role?: string | null): number {
  if (!role) return 99;
  return ROLE_LEVEL[role] ?? 99;
}

export const ServicesPage: React.FC = () => {
  const { user } = useAuthStore();
  const myLevel = user?.isMaster ? 0 : getRoleLevel(user?.role);
  const canEditServiceman = (row: Serviceman) => myLevel === 0 || getRoleLevel(row.role) >= myLevel;
  const allowedRoles = myLevel === 0 ? ALL_ROLES : ALL_ROLES.filter(r => ROLE_LEVEL[r] >= myLevel);

  const [categories, setCategories] = useState<Category[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [allServicemen, setAllServicemen] = useState<Serviceman[]>([]);

  const [serviceForm] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [equipmentForm] = Form.useForm();
  const [servicemanForm] = Form.useForm();

  const [serviceModal, setServiceModal] = useState<{ open: boolean; service?: Service; categoryId?: string }>({ open: false });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [categoryColor, setCategoryColor] = useState<string | null>(null);
  const [equipmentModal, setEquipmentModal] = useState<{ open: boolean; item?: Equipment }>({ open: false });
  const [servicemanModal, setServicemanModal] = useState<{ open: boolean; item?: Serviceman; isReceptionist?: boolean }>({ open: false });

  const fetchAll = async () => {
    await Promise.all([
      servicesApi.getCategories().then(setCategories),
      servicesApi.getEquipment().then(setEquipment),
      servicesApi.getAllServicemen().then(setAllServicemen),
    ]);
  };

  useEffect(() => { fetchAll(); }, []);

  // ─── Services ─────────────────────────────────────

  const handleSaveService = async () => {
    const values = await serviceForm.validateFields();
    try {
      if (serviceModal.service) {
        await servicesApi.updateService(serviceModal.service.id, values);
      } else {
        await servicesApi.createService(values);
      }
      message.success('Сохранено');
      setServiceModal({ open: false });
      serviceForm.resetFields();
      fetchAll();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const openAddService = (categoryId?: string) => {
    serviceForm.resetFields();
    if (categoryId) serviceForm.setFieldsValue({ categoryId });
    setServiceModal({ open: true, categoryId });
  };

  const openEditService = (service: Service) => {
    serviceForm.resetFields();
    serviceForm.setFieldsValue({
      name: service.name,
      categoryId: service.categoryId,
      standardPrice: service.standardPrice,
      estimatedTime: service.estimatedTime,
      hasEquipment: service.hasEquipment ?? false,
      isProduct: service.isProduct ?? false,
    });
    setServiceModal({ open: true, service });
  };

  // ─── Categories ────────────────────────────────────

  const handleSaveCategory = async () => {
    const values = await categoryForm.validateFields();
    try {
      if (categoryModal.category) {
        await servicesApi.updateCategory(categoryModal.category.id, { name: values.name, color: categoryColor });
      } else {
        await servicesApi.createCategory(values.name, categoryColor);
      }
      message.success('Сохранено');
      setCategoryModal({ open: false });
      categoryForm.resetFields();
      setCategoryColor(null);
      fetchAll();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const openEditCategory = (cat: Category) => {
    categoryForm.resetFields();
    categoryForm.setFieldsValue({ name: cat.name });
    setCategoryColor(cat.color ?? null);
    setCategoryModal({ open: true, category: cat });
  };

  // ─── Equipment ────────────────────────────────────

  const handleSaveEquipment = async () => {
    const values = await equipmentForm.validateFields();
    try {
      const payload = {
        name: values.name,
        warranty: values.warranty || undefined,
        wholesalePrice: values.wholesalePrice ?? undefined,
        retailPrice: values.retailPrice ?? undefined,
      };
      if (equipmentModal.item) {
        await servicesApi.updateEquipment(equipmentModal.item.id, payload);
      } else {
        await servicesApi.createEquipment(payload);
      }
      message.success('Сохранено');
      setEquipmentModal({ open: false });
      equipmentForm.resetFields();
      fetchAll();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  // ─── Servicemen ────────────────────────────────────

  const handleSaveServiceman = async () => {
    const values = await servicemanForm.validateFields();
    try {
      const birthdayIso = values.birthday ? (values.birthday as import('dayjs').Dayjs).toISOString() : null;
      if (servicemanModal.item) {
        await servicesApi.updateServiceman(servicemanModal.item.id, {
          name: values.name,
          position: values.position,
          role: values.role || undefined,
          email: values.email,
          password: values.password || undefined,
          isReceptionist: servicemanModal.isReceptionist,
          birthday: birthdayIso,
          ...(values.role === 'Сотрудник' && { profitPercent: values.profitPercent ?? 0 }),
        });
      } else {
        await servicesApi.createServiceman({
          name: values.name,
          position: values.position,
          role: values.role || undefined,
          email: values.email,
          password: values.password || undefined,
          isReceptionist: servicemanModal.isReceptionist,
          birthday: birthdayIso,
          ...(values.role === 'Сотрудник' && { profitPercent: values.profitPercent ?? 0 }),
        });
      }
      message.success('Сохранено');
      setServicemanModal({ open: false });
      servicemanForm.resetFields();
      fetchAll();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await servicesApi.dismissServiceman(id);
      message.success('Сотрудник уволен');
      fetchAll();
    } catch {
      message.error('Ошибка');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await servicesApi.setDefaultReceptionist(id);
      message.success('Мастер приёмщик по умолчанию установлен');
      fetchAll();
    } catch {
      message.error('Ошибка');
    }
  };

  const serviceColumns = [
    { title: 'Название', dataIndex: 'name', key: 'name', render: (n: string) => <span style={{ fontWeight: 500 }}>{n}</span> },
    { title: 'Цена', dataIndex: 'standardPrice', key: 'price', width: 120, render: (v: number) => formatPrice(v) },
    { title: 'Время', dataIndex: 'estimatedTime', key: 'time', width: 100, render: (v: number) => formatDuration(v) },
    {
      title: '', key: 'actions', width: 80,
      render: (_: unknown, row: Service) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditService(row)} />
          <Popconfirm title="Удалить услугу?" onConfirm={async () => {
            try {
              await servicesApi.deleteService(row.id);
              fetchAll();
            } catch {
              message.error('Ошибка удаления');
            }
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const activeEmployees = allServicemen.filter(s => !s.isReceptionist && !s.isDismissed);
  const dismissedEmployees = allServicemen.filter(s => !s.isReceptionist && s.isDismissed);
  const activeReceptionists = allServicemen.filter(s => s.isReceptionist && !s.isDismissed);
  const dismissedReceptionists = allServicemen.filter(s => s.isReceptionist && s.isDismissed);

  const servicemanColumns = (isReceptionist: boolean, isDismissedList = false) => [
    {
      title: 'ФИО',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: Serviceman) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 500 }}>{name}</span>
            {row.role && <Tag style={{ margin: 0 }}>{row.role}</Tag>}
          </div>
          {row.position && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{row.position}</div>}
        </div>
      ),
    },
    !isReceptionist ? {
      title: '% прибыли',
      key: 'profitPercent',
      width: 110,
      render: (_: unknown, row: Serviceman) =>
        row.role === 'Сотрудник' && row.profitPercent > 0
          ? <Tag color="green">{row.profitPercent}%</Tag>
          : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>,
    } : { title: '', key: 'emptyProfit', width: 0, render: () => null },
    {
      title: 'День рождения',
      key: 'birthday',
      width: 130,
      render: (_: unknown, row: Serviceman) => {
        if (!row.birthday) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;
        const bd = dayjs(row.birthday);
        const isToday = bd.month() === dayjs().month() && bd.date() === dayjs().date();
        return (
          <span style={isToday ? { color: 'var(--color-success)', fontWeight: 600 } : undefined}>
            {bd.format('DD.MM.YYYY')}
            {isToday && ' (сегодня!)'}
          </span>
        );
      },
    },
    isReceptionist && !isDismissedList ? {
      title: 'По умолчанию',
      key: 'default',
      width: 130,
      render: (_: unknown, row: Serviceman) => (
        <Checkbox
          checked={row.isDefault}
          onChange={() => { if (!row.isDefault) handleSetDefault(row.id); }}
        />
      ),
    } : { title: '', key: 'empty', width: 0, render: () => null },
    {
      title: '', key: 'actions', width: isDismissedList ? 0 : 120,
      render: isDismissedList ? () => null : (_: unknown, row: Serviceman) => {
        if (!canEditServiceman(row)) return null;
        return (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => {
              servicemanForm.resetFields();
              servicemanForm.setFieldsValue({ name: row.name, position: row.position, role: row.role, email: row.email, password: row.plainPassword ?? '', profitPercent: row.profitPercent ?? 0, birthday: row.birthday ? dayjs(row.birthday) : null });
              setServicemanModal({ open: true, item: row, isReceptionist });
            }} />
            <Popconfirm
              title="Уволить сотрудника?"
              description="Сотрудник будет перемещён в список уволенных"
              onConfirm={() => handleDismiss(row.id)}
              okText="Уволить"
              cancelText="Отмена"
            >
              <Button size="small" danger icon={<StopOutlined />} title="Уволить" />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const dismissedSection = (list: Serviceman[], isReceptionist: boolean) =>
    list.length > 0 ? (
      <Collapse
        style={{ marginTop: 16 }}
        items={[{
          key: 'dismissed',
          label: `Уволенные (${list.length})`,
          children: (
            <Table
              dataSource={list}
              rowKey="id"
              size="middle"
              pagination={false}
              columns={servicemanColumns(isReceptionist, true)}
              rowClassName={() => 'ant-table-row-dimmed'}
            />
          ),
        }]}
      />
    ) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Справочник</h1>
      </div>

      <Tabs
        items={[
          {
            key: 'services',
            label: 'Услуги',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button icon={<PlusOutlined />} onClick={() => { categoryForm.resetFields(); setCategoryModal({ open: true }); }}>
                    Категория
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddService()}>
                    Услуга
                  </Button>
                </div>
                <Collapse
                  defaultActiveKey={[]}
                  collapsible="icon"
                  items={categories.map(cat => ({
                    key: cat.id,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {cat.color && (
                          <span style={{
                            width: 12, height: 12, borderRadius: '50%',
                            background: cat.color, display: 'inline-block', flexShrink: 0,
                          }} />
                        )}
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 400 }}>
                          ({cat.services.length})
                        </span>
                      </div>
                    ),
                    extra: (
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <Button size="small" icon={<PlusOutlined />} onClick={() => openAddService(cat.id)}>
                          Добавить
                        </Button>
                        <Button size="small" icon={<BgColorsOutlined />} onClick={() => openEditCategory(cat)} />
                        <Popconfirm title="Удалить категорию?" onConfirm={async () => {
                          try {
                            await servicesApi.deleteCategory(cat.id);
                            fetchAll();
                          } catch {
                            message.error('Ошибка удаления');
                          }
                        }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </div>
                    ),
                    children: (
                      <Table
                        dataSource={cat.services}
                        columns={serviceColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: 'Нет услуг' }}
                      />
                    ),
                  }))}
                />
              </div>
            ),
          },
          {
            key: 'equipment',
            label: 'Bi-Led модули',
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { equipmentForm.resetFields(); setEquipmentModal({ open: true }); }}>
                    Добавить
                  </Button>
                </div>
                <Table
                  dataSource={equipment}
                  rowKey="id"
                  size="middle"
                  pagination={false}
                  columns={[
                    { title: 'Название модулей', dataIndex: 'name', key: 'name', render: (n: string) => <span style={{ fontWeight: 500 }}>{n}</span> },
                    {
                      title: 'Гарантия', dataIndex: 'warranty', key: 'warranty', width: 130,
                      render: (w: string) => w
                        ? <Tag color="green">{w}</Tag>
                        : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>,
                    },
                    {
                      title: 'Опт. цена', dataIndex: 'wholesalePrice', key: 'wholesalePrice', width: 110,
                      render: (v: number) => v != null
                        ? <span>{formatPrice(v)}</span>
                        : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>,
                    },
                    {
                      title: 'Розн. цена', dataIndex: 'retailPrice', key: 'retailPrice', width: 110,
                      render: (v: number) => v != null
                        ? <span>{formatPrice(v)}</span>
                        : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>,
                    },
                    {
                      title: '', key: 'actions', width: 80,
                      render: (_: unknown, row: Equipment) => (
                        <Space size="small">
                          <Button size="small" icon={<EditOutlined />} onClick={() => {
                            equipmentForm.resetFields();
                            equipmentForm.setFieldsValue({
                              name: row.name,
                              warranty: row.warranty || '',
                              wholesalePrice: row.wholesalePrice ?? null,
                              retailPrice: row.retailPrice ?? null,
                            });
                            setEquipmentModal({ open: true, item: row });
                          }} />
                          <Popconfirm title="Удалить?" onConfirm={async () => {
                            try {
                              await servicesApi.deleteEquipment(row.id);
                              fetchAll();
                            } catch {
                              message.error('Невозможно удалить: оборудование используется в сделках');
                            }
                          }}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'employees',
            label: 'Сотрудники',
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    servicemanForm.resetFields();
                    setServicemanModal({ open: true, isReceptionist: false });
                  }}>
                    Добавить сотрудника
                  </Button>
                </div>
                <Table
                  dataSource={activeEmployees}
                  rowKey="id"
                  size="middle"
                  pagination={false}
                  columns={servicemanColumns(false)}
                  locale={{ emptyText: 'Нет сотрудников' }}
                />
                {dismissedSection(dismissedEmployees, false)}
              </div>
            ),
          },
          {
            key: 'receptionists',
            label: 'Мастера приёмщики',
            children: (
              <div>
                <div className={styles.receptionistsHeader}>
                  <Tag color="blue" style={{ lineHeight: '30px', padding: '0 10px' }}>
                    Отмеченный по умолчанию будет автоматически подставляться в новые записи
                  </Tag>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    servicemanForm.resetFields();
                    setServicemanModal({ open: true, isReceptionist: true });
                  }}>
                    Добавить мастера
                  </Button>
                </div>
                <Table
                  dataSource={activeReceptionists}
                  rowKey="id"
                  size="middle"
                  pagination={false}
                  columns={servicemanColumns(true)}
                  locale={{ emptyText: 'Нет мастеров приёмщиков' }}
                  scroll={{ x: 'max-content' }}
                />
                {dismissedSection(dismissedReceptionists, true)}
              </div>
            ),
          },
        ]}
      />

      {/* Service modal */}
      <Modal
        open={serviceModal.open}
        onCancel={() => { setServiceModal({ open: false }); serviceForm.resetFields(); }}
        onOk={handleSaveService}
        title={serviceModal.service ? 'Редактировать услугу' : 'Новая услуга'}
        destroyOnHidden
      >
        <Form form={serviceForm} layout="vertical">
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
          <Form.Item name="hasEquipment" valuePropName="checked">
            <Checkbox>Услуга с сопутствующим оборудованием (Bi-Led модули)</Checkbox>
          </Form.Item>
          <Form.Item name="isProduct" valuePropName="checked">
            <Checkbox>Товар (не учитывается в зарплате сотрудников)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Category modal */}
      <Modal
        open={categoryModal.open}
        onCancel={() => { setCategoryModal({ open: false }); categoryForm.resetFields(); setCategoryColor(null); }}
        onOk={handleSaveCategory}
        title={categoryModal.category ? 'Редактировать категорию' : 'Новая категория'}
        destroyOnHidden
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item label="Название" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Цвет карточек">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ColorPicker
                value={categoryColor ?? undefined}
                onChange={(_, hex) => setCategoryColor(hex)}
                format="hex"
                showText
              />
              {categoryColor && (
                <Button size="small" type="link" style={{ padding: 0 }} onClick={() => setCategoryColor(null)}>
                  Сбросить
                </Button>
              )}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Equipment modal */}
      <Modal
        open={equipmentModal.open}
        onCancel={() => { setEquipmentModal({ open: false }); equipmentForm.resetFields(); }}
        onOk={handleSaveEquipment}
        title={equipmentModal.item ? 'Редактировать Bi-Led модуль' : 'Добавить Bi-Led модуль'}
        width={480}
        destroyOnHidden
      >
        <Form form={equipmentForm} layout="vertical">
          <Form.Item label="Название модулей" name="name" rules={[{ required: true }]}>
            <Input placeholder="Например: Bi-LED модуль GTR Falcon" />
          </Form.Item>
          <Form.Item label="Гарантия от производителей" name="warranty">
            <Input placeholder="Например: 2 года" />
          </Form.Item>
          <Form.Item label="Оптовая цена (р.)" name="wholesalePrice">
            <InputNumber style={{ width: '100%' }} min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} placeholder="0" />
          </Form.Item>
          <Form.Item label="Розничная цена (р.)" name="retailPrice">
            <InputNumber style={{ width: '100%' }} min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Serviceman modal */}
      <Modal
        open={servicemanModal.open}
        onCancel={() => { setServicemanModal({ open: false }); servicemanForm.resetFields(); }}
        onOk={handleSaveServiceman}
        title={servicemanModal.item
          ? 'Редактировать сотрудника'
          : servicemanModal.isReceptionist ? 'Добавить мастера приёмщика' : 'Добавить сотрудника'}
        destroyOnHidden
      >
        <Form form={servicemanForm} layout="vertical">
          <Form.Item label="ФИО" name="name" rules={[{ required: true, message: 'Введите ФИО' }]}>
            <Input prefix={<UserOutlined />} placeholder="Иванов Иван" />
          </Form.Item>
          <Form.Item label="Должность" name="position">
            <Input placeholder="Мастер-установщик" />
          </Form.Item>
          <Form.Item label="Роль" name="role">
            <Select allowClear placeholder="Выберите роль">
              {allowedRoles.map(r => (
                <Select.Option key={r} value={r}>{r}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input type="email" placeholder="example@mail.com" />
          </Form.Item>
          <Form.Item
            label="Пароль"
            name="password"
            extra={servicemanModal.item ? 'Оставьте пустым, чтобы не менять пароль' : undefined}
          >
            <Input.Password
              placeholder={servicemanModal.item ? '••••••••' : 'Пароль для входа в систему'}
              autoComplete="new-password"
              visibilityToggle
            />
          </Form.Item>
          <Form.Item label="Дата рождения" name="birthday">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" placeholder="Выберите дату" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) => getFieldValue('role') === 'Сотрудник' ? (
              <Form.Item
                label="Процент от чистой прибыли (%)"
                name="profitPercent"
                tooltip="Процент, который сотрудник получает от чистой прибыли по каждой услуге"
              >
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
