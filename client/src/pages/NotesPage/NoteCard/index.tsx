import React from 'react';
import { Button, Popconfirm } from 'antd';
import {
  EditOutlined, DeleteOutlined, CheckOutlined, UndoOutlined,
  CalendarOutlined, ClockCircleOutlined, RetweetOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import cn from 'classnames';
import type { Note, NoteRepeat } from '@/types';
import { PROJECT_LABEL, REPEAT_LABEL } from '../notesHelpers';
import styles from './NoteCard.module.scss';

interface Props {
  note: Note;
  canManage: boolean;
  onToggleDone: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<Props> = ({ note, canManage, onToggleDone, onEdit, onDelete }) => {
  const hasMeta = !!(note.date || note.time);

  return (
    <div
      className={cn(styles.card, {
        [styles.projectCrm]: note.project === 'CRM',
        [styles.projectPrime]: note.project === 'PRIME',
        [styles.projectVdf]: note.project === 'VDF',
        [styles.done]: note.isDone,
      })}
    >
      <span className={styles.projectBar} />

      <div className={styles.head}>
        <span className={styles.projectPill}>
          <span className={styles.projectDot} />
          {PROJECT_LABEL[note.project]}
        </span>
        {canManage && (
          <div className={styles.actions}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(note)} title="Изменить" />
            <Popconfirm
              title="Удалить заметку?"
              onConfirm={() => onDelete(note.id)}
              okText="Да"
              cancelText="Нет"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Удалить" />
            </Popconfirm>
          </div>
        )}
      </div>

      {/* Переносы строк из формы сохраняются (white-space: pre-wrap) */}
      <div className={styles.text}>{note.text}</div>

      <div className={styles.footer}>
        {hasMeta && (
          <div className={styles.meta}>
            {note.date && (
              <span className={styles.chip}>
                <CalendarOutlined />
                {dayjs(note.date).format('DD.MM.YYYY')}
              </span>
            )}
            {note.allDay && note.date && (
              <span className={styles.chip}>Весь день</span>
            )}
            {!note.allDay && note.time && (
              <span className={styles.chip}>
                <ClockCircleOutlined />
                {note.time}
              </span>
            )}
            {note.repeat && (
              <span className={styles.chip}>
                <RetweetOutlined />
                {REPEAT_LABEL[note.repeat as NoteRepeat]}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          className={cn(styles.checkBtn, { [styles.checkBtnDone]: note.isDone })}
          onClick={() => onToggleDone(note)}
        >
          {note.isDone ? <><UndoOutlined /> Вернуть</> : <><CheckOutlined /> Выполнено</>}
        </button>
      </div>
    </div>
  );
};
