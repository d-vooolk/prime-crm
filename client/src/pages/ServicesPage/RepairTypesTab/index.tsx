import React, { useState } from 'react';
import { Button, Popconfirm, Space, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference, useRepairTypes } from '@/hooks/useReferenceData';
import { LoadError } from '@/components/Shared/LoadError';
import { RepairType } from '@/types';
import { RepairTypeModal } from './RepairTypeModal';
import styles from './RepairTypesTab.module.scss';

/**
 * Типы ремонта: услуг много, типов мало. Тип назначается услуге, и на странице записи
 * для клиента (zapis.prime-auto.by) по каждому типу из записи показывается блок
 * с описанием, фото предстоящей работы, вопросами-ответами и ссылками.
 */
export const RepairTypesTab: React.FC = () => {
  const { data: types = [], isLoading, isError, error, refetch } = useRepairTypes();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  // id редактируемого типа; 'new' — создание. Данные берутся из свежего списка
  const [editing, setEditing] = useState<string | null>(null);
  const editingType = editing && editing !== 'new' ? types.find(t => t.id === editing) : undefined;

  const handleDelete = async (id: string) => {
    try {
      await servicesApi.deleteRepairType(id);
      await invalidate('repairTypes', 'serviceCategories');
    } catch (e) {
      notify.error(e, 'Не удалось удалить тип ремонта');
    }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <Typography.Text type="secondary" className={styles.hint}>
          Назначьте тип услугам (в карточке услуги) — клиент увидит блок этого типа на странице своей записи.
        </Typography.Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
          Добавить
        </Button>
      </div>
      {isError && <LoadError title="Не удалось загрузить типы ремонта" error={error} onRetry={() => refetch()} />}
      <Table
        dataSource={types}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={isLoading}
        onRow={row => ({ onClick: () => setEditing(row.id), className: styles.row })}
        columns={[
          { title: 'Тип ремонта', dataIndex: 'name', key: 'name', render: (n: string) => <span className={styles.strong}>{n}</span> },
          { title: 'Услуг', dataIndex: 'servicesCount', key: 'servicesCount', width: 80 },
          { title: 'Фото', key: 'photos', width: 70, render: (_: unknown, row: RepairType) => row.photos.length },
          { title: 'Вопросов', key: 'faq', width: 90, responsive: ['sm'], render: (_: unknown, row: RepairType) => row.faq.length },
          {
            title: '', key: 'actions', width: 80,
            render: (_: unknown, row: RepairType) => (
              // Клик по кнопкам не должен открывать карточку строки
              <Space size="small" onClick={e => e.stopPropagation()}>
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(row.id)} />
                <Popconfirm
                  title="Удалить тип ремонта?"
                  description={row.servicesCount ? `У ${row.servicesCount} услуг тип будет снят` : undefined}
                  onConfirm={() => handleDelete(row.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <RepairTypeModal
        open={editing !== null}
        repairType={editingType}
        onCreated={id => setEditing(id)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
};
