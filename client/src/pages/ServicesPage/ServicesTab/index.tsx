import React, { useState } from 'react';
import { Button, Collapse, Popconfirm, Spin, Table, Tooltip } from 'antd';
import { BgColorsOutlined, DeleteOutlined, EditOutlined, PercentageOutlined, PlusOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference, useServiceCategories } from '@/hooks/useReferenceData';
import { Category, Service } from '@/types';
import { formatDuration, formatPrice } from '@/utils/formatters';
import { LoadError } from '@/components/Shared/LoadError';
import { ServiceModal } from './ServiceModal';
import { CategoryModal } from './CategoryModal';
import { PercentModal, PercentTarget } from './PercentModal';
import styles from './ServicesTab.module.scss';

/** Категории услуг и услуги в них: добавление, правка, цвет карточек, кастомный процент */
export const ServicesTab: React.FC = () => {
  const { data: categories = [], isLoading, isError, error, refetch } = useServiceCategories();
  const notify = useNotify();
  const invalidate = useInvalidateReference();

  const [serviceModal, setServiceModal] = useState<{ open: boolean; service?: Service; categoryId?: string }>({ open: false });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [percentTarget, setPercentTarget] = useState<PercentTarget | null>(null);

  const handleDeleteService = async (id: string) => {
    try {
      await servicesApi.deleteService(id);
      await invalidate('serviceCategories');
    } catch (e) {
      notify.error(e, 'Ошибка удаления');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await servicesApi.deleteCategory(id);
      await invalidate('serviceCategories');
    } catch (e) {
      notify.error(e, 'Ошибка удаления');
    }
  };

  const percentButton = (type: PercentTarget['type'], id: string, name: string, current: number | null | undefined) => (
    <Tooltip title={current != null ? `Кастомный %: ${current}%` : 'Процент от прибыли'}>
      <Button
        size="small"
        icon={<PercentageOutlined />}
        type={current != null ? 'primary' : 'default'}
        ghost={current != null}
        onClick={() => setPercentTarget({ type, id, name, current })}
      />
    </Tooltip>
  );

  const serviceColumns = [
    { title: 'Название', dataIndex: 'name', key: 'name', render: (n: string) => <span className={styles.strong}>{n}</span> },
    { title: 'Цена', dataIndex: 'standardPrice', key: 'price', width: 120, render: (v: number) => formatPrice(v) },
    { title: 'Время', dataIndex: 'estimatedTime', key: 'time', width: 100, render: (v: number) => formatDuration(v) },
    {
      title: '', key: 'actions', width: 100,
      render: (_: unknown, row: Service) => (
        <div className={styles.rowActions}>
          {percentButton('service', row.id, row.name, row.customPercent)}
          <Button size="small" icon={<EditOutlined />} onClick={() => setServiceModal({ open: true, service: row })} />
          <Popconfirm title="Удалить услугу?" onConfirm={() => handleDeleteService(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button icon={<PlusOutlined />} onClick={() => setCategoryModal({ open: true })}>
          Категория
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setServiceModal({ open: true })}>
          Услуга
        </Button>
      </div>

      {isError && <LoadError title="Не удалось загрузить услуги" error={error} onRetry={() => refetch()} />}

      <Collapse
        defaultActiveKey={[]}
        collapsible="icon"
        items={categories.map(cat => ({
          key: cat.id,
          label: (
            <div className={styles.catLabel}>
              {/* Цвет категории задаётся пользователем — значение из данных */}
              {cat.color && <span className={styles.catDot} style={{ background: cat.color }} />}
              <span className={styles.catName}>{cat.name}</span>
              <span className={styles.catCount}>({cat.services.length})</span>
            </div>
          ),
          extra: (
            <div className={styles.catActions} onClick={e => e.stopPropagation()}>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setServiceModal({ open: true, categoryId: cat.id })}>
                Добавить
              </Button>
              {percentButton('category', cat.id, cat.name, cat.customPercent)}
              <Button size="small" icon={<BgColorsOutlined />} onClick={() => setCategoryModal({ open: true, category: cat })} />
              <Popconfirm title="Удалить категорию?" onConfirm={() => handleDeleteCategory(cat.id)}>
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
      {isLoading && <div className={styles.loading}><Spin /></div>}

      <ServiceModal
        open={serviceModal.open}
        service={serviceModal.service}
        categoryId={serviceModal.categoryId}
        categories={categories}
        onClose={() => setServiceModal({ open: false })}
      />
      <CategoryModal
        open={categoryModal.open}
        category={categoryModal.category}
        onClose={() => setCategoryModal({ open: false })}
      />
      <PercentModal target={percentTarget} onClose={() => setPercentTarget(null)} />
    </div>
  );
};
