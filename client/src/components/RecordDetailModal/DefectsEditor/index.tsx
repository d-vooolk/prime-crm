import React, { useEffect, useState } from 'react';
import { Button, Divider, Input } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { Record } from '@/types';
import { recordsApi } from '@/api/records.api';
import { useNotify } from '@/hooks/useNotify';
import styles from './DefectsEditor.module.scss';

interface Props {
  record: Record;
  onSaved: (record: Record) => void;
}

/**
 * Обнаруженные недостатки. В активной записи пишет и правит любая роль;
 * в завершённой и отменённой — только текст, пустой блок не показывается.
 * Текст печатается в акте выполненных работ.
 */
export const DefectsEditor: React.FC<Props> = ({ record, onSaved }) => {
  const notify = useNotify();
  const saved = record.defects ?? '';
  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);

  // Другая запись или текст обновился с сервера — показываем сохранённое
  useEffect(() => {
    setDraft(saved);
    setEditing(!saved);
  }, [record.id, saved]);

  const isEditable = record.status === 'ACTIVE';
  if (!isEditable && !saved) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const fresh = await recordsApi.setDefects(record.id, draft.trim() || null);
      notify.toast.success('Недостатки сохранены');
      onSaved(fresh);
    } catch (e) {
      notify.error(e, 'Не удалось сохранить недостатки');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(saved);
    setEditing(false);
  };

  return (
    <>
      <Divider orientation="left" className={styles.divider}>Обнаруженные недостатки</Divider>
      {editing && isEditable ? (
        <>
          <Input.TextArea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 10 }}
            maxLength={10000}
            placeholder="Что обнаружено в процессе работы: сколы, трещины, неисправности и т.п."
          />
          <div className={styles.actions}>
            {saved && <Button onClick={handleCancel} disabled={saving}>Отмена</Button>}
            <Button type="primary" onClick={handleSave} loading={saving} disabled={draft.trim() === saved}>
              Сохранить
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.view}>
          <div className={styles.text}>{saved}</div>
          {isEditable && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              className={styles.editButton}
              onClick={() => setEditing(true)}
            >
              Изменить
            </Button>
          )}
        </div>
      )}
    </>
  );
};
