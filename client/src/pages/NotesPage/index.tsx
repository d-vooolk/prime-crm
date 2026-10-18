import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Button, Select, Empty, Spin } from 'antd';
import { PlusOutlined, InboxOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Note, NoteProject } from '@/types';
import { notesApi } from '@/api/notes.api';
import { useAuthStore } from '@/store/authStore';
import { useAllServicemen } from '@/hooks/useReferenceData';
import { useNotify } from '@/hooks/useNotify';
import { useOnAppResume } from '@/hooks/useAppResume';
import { getErrorMessage } from '@/utils/errors';
import { canEditNote, isNotesCreator } from '@/utils/roles';
import cn from 'classnames';
import { buildNotePayload, NOTE_PROJECTS, NoteFormValues, PROJECT_LABEL } from './notesHelpers';
import { NoteCard } from './NoteCard';
import { NoteFormModal } from './NoteFormModal';
import styles from './NotesPage.module.scss';

const PROJECT_COLUMN_CLASS: Record<NoteProject, string> = {
  CRM: styles.columnCrm,
  PRIME: styles.columnPrime,
  VDF: styles.columnVdf,
};

export const NotesPage: React.FC = () => {
  const { user } = useAuthStore();
  const notify = useNotify();
  const isCreator = isNotesCreator(user);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  // Номер последнего запроса: при быстром переключении сотрудника/архива старый ответ игнорируем
  const requestIdRef = useRef(0);

  // Список сотрудников нужен только Создателю — выбирать, чьи заметки смотреть
  const { data: allServicemen = [] } = useAllServicemen({ enabled: isCreator });
  const servicemen = isCreator ? allServicemen.filter(s => !s.isDismissed) : [];

  const loadNotes = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const target = isCreator && viewingId ? viewingId : undefined;
      const data = await notesApi.getAll(target, showArchive);
      if (requestId !== requestIdRef.current) return;
      setNotes(data);
      setLoadError(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(getErrorMessage(e));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [isCreator, viewingId, showArchive]);

  useEffect(() => { loadNotes(); }, [loadNotes]);
  useOnAppResume(loadNotes);

  const handleToggleDone = async (note: Note) => {
    try {
      await notesApi.update(note.id, { isDone: !note.isDone });
      loadNotes();
    } catch (e) { notify.error(e, 'Не удалось обновить заметку'); }
  };

  const openCreate = () => {
    setEditingNote(null);
    setModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setModalOpen(true);
  };

  const handleSave = async (values: NoteFormValues) => {
    setSaving(true);
    try {
      const payload = buildNotePayload(values, isCreator ? viewingId : null);
      if (editingNote) {
        await notesApi.update(editingNote.id, payload);
        notify.toast.success('Заметка обновлена');
      } else {
        await notesApi.create(payload);
        notify.toast.success('Заметка добавлена');
      }
      setModalOpen(false);
      loadNotes();
    } catch (e) { notify.error(e, 'Ошибка при сохранении'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await notesApi.delete(id);
      loadNotes();
    } catch (e) { notify.error(e, 'Ошибка при удалении'); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Заметки</h1>
        <div className={styles.headerActions}>
          <Button
            icon={showArchive ? <UnorderedListOutlined /> : <InboxOutlined />}
            onClick={() => setShowArchive(v => !v)}
          >
            {showArchive ? 'Активные' : 'Архив'}
          </Button>
          {!showArchive && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Добавить
            </Button>
          )}
        </div>
      </div>

      {isCreator && (
        <div className={styles.employeeRow}>
          <Select
            placeholder="Мои заметки"
            value={viewingId ?? undefined}
            onChange={v => setViewingId(v ?? null)}
            allowClear
            onClear={() => setViewingId(null)}
            className={styles.employeeSelect}
            options={servicemen.map(s => ({ value: s.id, label: s.name }))}
          />
        </div>
      )}

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить заметки"
          description={loadError}
          action={<Button size="small" onClick={loadNotes}>Повторить</Button>}
        />
      ) : (
        <Spin spinning={loading}>
          {notes.length === 0 && !loading ? (
            <Empty description={showArchive ? 'Архив пуст' : 'Заметок нет'} className={styles.empty} />
          ) : (
            <>
              <div className={styles.sectionLabel}>
                {showArchive ? 'Архив' : 'Активные'}
                <span className={styles.sectionCount}>{notes.length}</span>
              </div>
              <div className={styles.board}>
                {NOTE_PROJECTS.map(project => {
                  const projectNotes = notes.filter(note => note.project === project);
                  return (
                    <section key={project} className={cn(styles.column, PROJECT_COLUMN_CLASS[project])}>
                      <div className={styles.columnHead}>
                        <span className={styles.columnDot} />
                        {PROJECT_LABEL[project]}
                        <span className={styles.columnCount}>{projectNotes.length}</span>
                      </div>
                      {projectNotes.length === 0 ? (
                        <div className={styles.columnEmpty}>Нет заметок</div>
                      ) : (
                        <div className={styles.columnList}>
                          {projectNotes.map(note => (
                            <NoteCard
                              key={note.id}
                              note={note}
                              canManage={canEditNote(user, note.servicemanId)}
                              onToggleDone={handleToggleDone}
                              onEdit={openEdit}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </Spin>
      )}

      <NoteFormModal
        open={modalOpen}
        note={editingNote}
        saving={saving}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSave}
      />
    </div>
  );
};
