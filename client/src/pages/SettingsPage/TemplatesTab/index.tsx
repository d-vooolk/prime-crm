import React, { useState } from 'react';
import { Button, Card, Popconfirm, Space, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useDocTemplates, useInvalidateReference, useServiceCategories } from '@/hooks/useReferenceData';
import { DocumentTemplate } from '@/types';
import { ActMemoEditor } from '@/components/ActMemoEditor';
import { LoadError } from '@/components/Shared/LoadError';
import { TemplateModal, TemplateType } from './TemplateModal';
import styles from './TemplatesTab.module.scss';

interface ModalState {
  open: boolean;
  type: TemplateType;
  template: DocumentTemplate | null;
  isFirstOfType: boolean;
}

const SECTIONS: Array<{ type: TemplateType; title: string; description: string }> = [
  {
    type: 'work_order',
    title: 'Шаблоны заявок',
    description: 'Юридический текст, который печатается в заявке на проведение работ. Можно создать отдельный шаблон для каждой категории услуг.',
  },
  {
    type: 'completion_act',
    title: 'Шаблоны актов выполненных работ',
    description: 'Текст гарантийных обязательств и условий приёмки, который печатается в акте выполненных работ. Можно создать отдельный шаблон для каждой категории услуг.',
  },
];

/** Шаблоны печатных документов (заявка, акт) и памятка клиенту в акте */
export const TemplatesTab: React.FC = () => {
  const { data: templates = [], isLoading, isError, error, refetch } = useDocTemplates();
  const { data: categories = [] } = useServiceCategories();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const [modal, setModal] = useState<ModalState>({ open: false, type: 'work_order', template: null, isFirstOfType: false });

  const openCreate = (type: TemplateType) => setModal({
    open: true, type, template: null, isFirstOfType: !templates.some(t => t.type === type),
  });

  const openEdit = (template: DocumentTemplate) => setModal({
    open: true, type: template.type as TemplateType, template, isFirstOfType: false,
  });

  const handleDelete = async (id: string) => {
    try {
      await servicesApi.deleteDocTemplate(id);
      notify.toast.success('Шаблон удалён');
      await invalidate('docTemplates');
    } catch (e) {
      notify.error(e, 'Ошибка удаления');
    }
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: DocumentTemplate) => (
        <div>
          <span className={styles.strong}>{name}</span>
          {row.isDefault && <Tag color="blue" className={styles.defaultTag}>По умолчанию</Tag>}
        </div>
      ),
    },
    {
      title: 'Категория',
      key: 'category',
      width: 200,
      render: (_: unknown, row: DocumentTemplate) =>
        row.category
          ? <Tag>{row.category.name}</Tag>
          : <span className={styles.muted}>Все категории</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, row: DocumentTemplate) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Удалить шаблон?" onConfirm={() => handleDelete(row.id)} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.root}>
      {isError && <LoadError title="Не удалось загрузить шаблоны документов" error={error} onRetry={() => refetch()} />}

      {SECTIONS.map(section => (
        <Card
          key={section.type}
          title={section.title}
          extra={
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openCreate(section.type)}>
              Добавить шаблон
            </Button>
          }
        >
          <p className={styles.description}>{section.description}</p>
          <Table
            dataSource={templates.filter(t => t.type === section.type)}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: 'Нет шаблонов. При печати будет использован текст по умолчанию.' }}
          />
        </Card>
      ))}

      <ActMemoEditor categories={categories} />

      <TemplateModal
        open={modal.open}
        type={modal.type}
        template={modal.template}
        isFirstOfType={modal.isFirstOfType}
        categories={categories}
        onClose={() => setModal(m => ({ ...m, open: false }))}
      />
    </div>
  );
};
