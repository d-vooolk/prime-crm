import React, { useState } from 'react';
import { Alert, Button, Input, Popconfirm, Table, Tooltip } from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined,
} from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { ClientSource } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { useClientSources, useInvalidateReference } from '@/hooks/useReferenceData';
import { getErrorMessage } from '@/utils/errors';
import styles from './ClientSourcesEditor.module.scss';

interface ClientSourcesEditorProps {
  // Сотрудник видит список, но не правит его
  readOnly?: boolean;
}

const NAME_MAX = 60;

/** Справочник источников клиента для поля «Источник клиента» в записи (Настройки → Источники клиентов). */
export const ClientSourcesEditor: React.FC<ClientSourcesEditorProps> = ({ readOnly }) => {
  const { data: sources = [], isLoading, isError, error, refetch } = useClientSources();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = () => invalidate('clientSources');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await servicesApi.createClientSource(name);
      setNewName('');
      await reload();
    } catch (e) { notify.error(e, 'Не удалось добавить источник'); }
    finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await servicesApi.updateClientSource(editingId, name);
      setEditingId(null);
      await reload();
    } catch (e) { notify.error(e, 'Не удалось переименовать источник'); }
    finally { setSaving(false); }
  };

  const handleMove = async (id: string, direction: -1 | 1) => {
    try {
      await servicesApi.moveClientSource(id, direction);
      await reload();
    } catch (e) { notify.error(e, 'Не удалось переместить источник'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await servicesApi.deleteClientSource(id);
      await reload();
    } catch (e) { notify.error(e, 'Не удалось удалить источник'); }
  };

  const columns = [
    {
      title: 'Источник',
      key: 'name',
      render: (_: unknown, s: ClientSource) => editingId === s.id ? (
        <Input
          value={editingName}
          onChange={e => setEditingName(e.target.value)}
          onPressEnter={handleRename}
          maxLength={NAME_MAX}
          autoFocus
        />
      ) : s.name,
    },
    {
      title: 'Записей',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 90,
      align: 'right' as const,
    },
    ...(readOnly ? [] : [{
      title: '',
      key: 'actions',
      width: 150,
      render: (_: unknown, s: ClientSource, index: number) => editingId === s.id ? (
        <div className={styles.actions}>
          <Button size="small" type="text" icon={<CheckOutlined />} loading={saving} onClick={handleRename} />
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setEditingId(null)} />
        </div>
      ) : (
        <div className={styles.actions}>
          <Tooltip title="Выше">
            <Button
              size="small"
              type="text"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => handleMove(s.id, -1)}
            />
          </Tooltip>
          <Tooltip title="Ниже">
            <Button
              size="small"
              type="text"
              icon={<ArrowDownOutlined />}
              disabled={index === sources.length - 1}
              onClick={() => handleMove(s.id, 1)}
            />
          </Tooltip>
          <Tooltip title="Переименовать">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => { setEditingId(s.id); setEditingName(s.name); }}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить источник?"
            description={s.usageCount > 0
              ? `Он указан в ${s.usageCount} зап. — там и в статистике каналов останется, из списка пропадёт`
              : undefined}
            onConfirm={() => handleDelete(s.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    }]),
  ];

  return (
    <div className={styles.wrapper}>
      <p className={styles.hint}>
        Варианты поля «Источник клиента» в записи — в том же порядке, что здесь. По ним считается
        статистика на дашборде (вкладка «Каналы привлечения»).
      </p>
      {!readOnly && (
        <div className={styles.addRow}>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onPressEnter={handleAdd}
            placeholder="Новый источник"
            maxLength={NAME_MAX}
          />
          <Button type="primary" icon={<PlusOutlined />} loading={saving} disabled={!newName.trim()} onClick={handleAdd}>
            Добавить
          </Button>
        </div>
      )}
      {isError && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить источники клиентов"
          description={getErrorMessage(error)}
          action={<Button size="small" onClick={() => refetch()}>Повторить</Button>}
        />
      )}
      <Table<ClientSource>
        dataSource={sources}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={false}
      />
    </div>
  );
};
