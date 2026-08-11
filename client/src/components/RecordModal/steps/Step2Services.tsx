import React, { useState, useEffect } from 'react';
import { Select, InputNumber, Button, Table, Empty, Tag, Space, Grid, Modal, Form, Input, Switch, Tooltip } from 'antd';
import { DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { Category, Equipment } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { RecordFormData, SelectedService } from '../types';
import styles from './Step2Services.module.scss';
const { useBreakpoint } = Grid;

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
  prepaymentLocked?: boolean;
}

export const Step2Services: React.FC<Props> = ({ data, onChange, prepaymentLocked }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [categories, setCategories] = useState<Category[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  // Prepayment modal state
  const [prepayServiceId, setPrepayServiceId] = useState<string | null>(null);
  const [prepayAmount, setPrepayAmount] = useState(0);
  const [prepayByCard, setPrepayByCard] = useState(false);

  useEffect(() => {
    servicesApi.getCategories().then(setCategories).catch(() => {});
    servicesApi.getEquipment().then(setEquipment).catch(() => {});
  }, []);

  const allServices = categories.flatMap(c =>
    c.services.map(s => ({ ...s, category: c }))
  );

  const handleServiceSelect = (serviceId: string) => {
    const service = allServices.find(s => s.id === serviceId);
    if (!service) return;
    const existing = data.services.find(s => s.serviceId === serviceId);
    if (existing) {
      onChange({
        services: data.services.map(s =>
          s.serviceId === serviceId ? { ...s, quantity: s.quantity + 1 } : s
        ),
      });
    } else {
      onChange({
        services: [
          ...data.services,
          {
            serviceId: service.id,
            serviceName: service.name,
            categoryName: service.category.name,
            price: service.standardPrice,
            quantity: 1,
            estimatedTime: service.estimatedTime,
            hasEquipment: service.hasEquipment ?? false,
            prepaidAmount: 0,
            prepaidByCard: false,
          },
        ],
      });
    }
  };

  const removeService = (serviceId: string) => {
    onChange({ services: data.services.filter(s => s.serviceId !== serviceId) });
  };

  const updatePrice = (serviceId: string, price: number) => {
    onChange({
      services: data.services.map(s =>
        s.serviceId === serviceId ? { ...s, price } : s
      ),
    });
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    onChange({
      services: data.services.map(s =>
        s.serviceId === serviceId ? { ...s, quantity } : s
      ),
    });
  };

  const updateEquipment = (serviceId: string, equipmentId: string | undefined) => {
    onChange({
      services: data.services.map(s =>
        s.serviceId === serviceId ? { ...s, equipmentId } : s
      ),
    });
  };

  const openPrepayModal = (row: SelectedService) => {
    setPrepayServiceId(row.serviceId);
    setPrepayAmount(row.prepaidAmount || 0);
    setPrepayByCard(row.prepaidByCard || false);
  };

  const savePrepayment = () => {
    if (!prepayServiceId) return;
    onChange({
      services: data.services.map(s =>
        s.serviceId === prepayServiceId
          ? { ...s, prepaidAmount: prepayAmount, prepaidByCard: prepayByCard }
          : s
      ),
    });
    setPrepayServiceId(null);
  };

  const total = data.services.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const totalTime = data.services.reduce((sum, s) => sum + s.estimatedTime * s.quantity, 0);
  const totalPrepaid = data.services.reduce((sum, s) => sum + (s.prepaidAmount || 0), 0);
  const remaining = total - totalPrepaid;

  const prepayService = prepayServiceId ? data.services.find(s => s.serviceId === prepayServiceId) : null;
  const prepayMax = prepayService ? prepayService.price * prepayService.quantity : 0;

  const serviceOptions = categories.map(cat => ({
    label: cat.name,
    options: cat.services.map(s => ({
      value: s.id,
      label: `${s.name} — ${formatPrice(s.standardPrice)}`,
    })),
  }));

  const equipmentOptions = equipment.map(e => ({ value: e.id, label: e.name }));

  const getPrepayTag = (row: SelectedService) => {
    const paid = row.prepaidAmount || 0;
    if (paid <= 0) return null;
    const rowTotal = row.price * row.quantity;
    if (paid >= rowTotal) {
      return <Tag color="success" style={{ fontSize: 10, marginTop: 2 }}>Оплачено полностью</Tag>;
    }
    return <Tag color="processing" style={{ fontSize: 10, marginTop: 2 }}>Предоплата {formatPrice(paid)}</Tag>;
  };

  const columns = [
    {
      title: 'Услуга',
      dataIndex: 'serviceName',
      key: 'name',
      render: (name: string, row: SelectedService) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <Tag style={{ fontSize: 11, marginTop: 2 }}>{row.categoryName}</Tag>
          {getPrepayTag(row)}
          {row.hasEquipment && (
            <Select
              size="small"
              style={{ width: '100%', marginTop: 6 }}
              placeholder="Выберите Bi-Led модуль..."
              value={row.equipmentId || undefined}
              onChange={v => updateEquipment(row.serviceId, v)}
              allowClear
              onClear={() => updateEquipment(row.serviceId, undefined)}
              options={equipmentOptions}
              optionFilterProp="label"
              showSearch
            />
          )}
        </div>
      ),
    },
    {
      title: 'Кол-во',
      key: 'quantity',
      width: 100,
      render: (_: unknown, row: SelectedService) => (
        <InputNumber
          min={1}
          max={99}
          value={row.quantity}
          onChange={v => updateQuantity(row.serviceId, v || 1)}
          size="small"
          controls
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: 'Цена',
      key: 'price',
      width: 140,
      render: (_: unknown, row: SelectedService) => (
        <Space.Compact size="small">
          <InputNumber
            min={0}
            value={row.price}
            onChange={v => updatePrice(row.serviceId, v || 0)}
            style={{ width: 90 }}
            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          />
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '0 8px',
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            borderLeft: 'none', borderRadius: '0 6px 6px 0', fontSize: 13,
            color: 'var(--color-text-secondary)',
          }}>р.</span>
        </Space.Compact>
      ),
    },
    {
      title: 'Итого',
      key: 'total',
      width: 110,
      render: (_: unknown, row: SelectedService) => (
        <span style={{ fontWeight: 600 }}>{formatPrice(row.price * row.quantity)}</span>
      ),
    },
    {
      title: '',
      key: 'prepay',
      width: 36,
      render: (_: unknown, row: SelectedService) => (
        <Tooltip title={prepaymentLocked ? 'Предоплата недоступна для закрытых записей' : 'Предоплата'}>
          <Button
            type="text"
            icon={<DollarOutlined />}
            size="small"
            disabled={prepaymentLocked}
            onClick={() => openPrepayModal(row)}
            style={{ color: (row.prepaidAmount || 0) > 0 ? 'var(--color-accent)' : undefined }}
          />
        </Tooltip>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 36,
      render: (_: unknown, row: SelectedService) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          size="small"
          onClick={() => removeService(row.serviceId)}
        />
      ),
    },
  ];

  const footerTotals = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {totalPrepaid > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            <span>Предоплата:</span>
            <span style={{ color: 'var(--color-status-closed)', fontWeight: 600 }}>− {formatPrice(totalPrepaid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            <span>Остаток к оплате:</span>
            <span style={{ fontWeight: 600 }}>{formatPrice(remaining)}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Ориентировочное время: {Math.floor(totalTime / 60)}ч {totalTime % 60}м
            </span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{formatPrice(total)}</span>
          </div>
        </>
      )}
      {totalPrepaid === 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Ориентировочное время: {Math.floor(totalTime / 60)}ч {totalTime % 60}м
          </span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{formatPrice(total)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Select
          showSearch
          style={{ width: '100%' }}
          value={undefined}
          onChange={handleServiceSelect}
          placeholder="Выберите услугу для добавления..."
          optionFilterProp="label"
          options={serviceOptions}
        />
      </div>

      {data.services.length === 0 ? (
        <Empty description="Услуги не выбраны" style={{ margin: '32px 0' }} />
      ) : isMobile ? (
        <>
          <div className={styles.mobileList}>
            {data.services.map(row => (
              <div key={row.serviceId} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <div className={styles.mobileCardInfo}>
                    <div className={styles.mobileCardName}>{row.serviceName}</div>
                    <div className={styles.mobileCardCategory}>{row.categoryName}</div>
                    {getPrepayTag(row)}
                  </div>
                  <Space size={4}>
                    {!prepaymentLocked && (
                      <Button
                        type="text"
                        icon={<DollarOutlined />}
                        size="small"
                        onClick={() => openPrepayModal(row)}
                        style={{ color: (row.prepaidAmount || 0) > 0 ? 'var(--color-accent)' : undefined }}
                      />
                    )}
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => removeService(row.serviceId)}
                    />
                  </Space>
                </div>
                {row.hasEquipment && (
                  <Select
                    size="small"
                    style={{ width: '100%', marginBottom: 8 }}
                    placeholder="Выберите Bi-Led модуль..."
                    value={row.equipmentId || undefined}
                    onChange={v => updateEquipment(row.serviceId, v)}
                    allowClear
                    onClear={() => updateEquipment(row.serviceId, undefined)}
                    options={equipmentOptions}
                    showSearch
                  />
                )}
                <div className={styles.mobileCardControls}>
                  <span className={styles.mobileCardLabel}>Кол-во:</span>
                  <InputNumber
                    min={1} max={99}
                    value={row.quantity}
                    onChange={v => updateQuantity(row.serviceId, v || 1)}
                    size="small"
                    controls
                    style={{ width: 72 }}
                  />
                  <span className={styles.mobileCardLabel}>Цена:</span>
                  <InputNumber
                    min={0}
                    value={row.price}
                    onChange={v => updatePrice(row.serviceId, v || 0)}
                    size="small"
                    style={{ width: 82 }}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  />
                  <span className={styles.mobileCardLabel}>р.</span>
                  <span className={styles.mobileCardTotal}>{formatPrice(row.price * row.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
            {totalPrepaid > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                  <span>Предоплата:</span>
                  <span style={{ color: 'var(--color-status-closed)', fontWeight: 600 }}>− {formatPrice(totalPrepaid)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  <span>Остаток:</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(remaining)}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                ~{Math.floor(totalTime / 60)}ч {totalTime % 60}м
              </span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{formatPrice(total)}</span>
            </div>
          </div>
        </>
      ) : (
        <Table
          dataSource={data.services}
          columns={columns}
          rowKey="serviceId"
          pagination={false}
          size="small"
          footer={() => footerTotals}
        />
      )}

      <Modal
        title="Предоплата"
        open={!!prepayServiceId}
        onOk={savePrepayment}
        onCancel={() => setPrepayServiceId(null)}
        okText="Сохранить"
        cancelText="Отмена"
        width={400}
      >
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Услуга">
            <Input value={prepayService?.serviceName} disabled />
          </Form.Item>
          <Form.Item label="Полная сумма">
            <Input value={prepayService ? formatPrice(prepayService.price * prepayService.quantity) : ''} disabled />
          </Form.Item>
          <Form.Item label="Сумма предоплаты">
            <InputNumber
              min={0}
              max={prepayMax}
              value={prepayAmount}
              onChange={v => setPrepayAmount(v || 0)}
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              suffix="р."
            />
          </Form.Item>
          <Form.Item label="Способ оплаты">
            <Switch
              checked={prepayByCard}
              onChange={setPrepayByCard}
              checkedChildren="Безнал (РС)"
              unCheckedChildren="Наличные"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
