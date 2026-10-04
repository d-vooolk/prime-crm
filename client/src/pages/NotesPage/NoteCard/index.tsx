import React from 'react';
import { Button, Popconfirm, Space, Tag } from 'antd';
import {
  EditOutlined, DeleteOutlined, CheckCircleOutlined, CheckCircleFilled,
  CalendarOutlined, ClockCircleOutlined, RetweetOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import cn from 'classnames';
import type { Note, NoteRepeat } from '@/types';
import { PRIORITY_LABEL, REPEAT_LABEL } from '../notesHelpers';
import styles from './NoteCard.module.scss';

interface Props {
  note: Note;
  canManage: boolean;
  onToggleDone: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<Props> = ({ note, canManage, onToggleDone, onEdit, onDelete }) => (
  <div
    className={cn(styles.card, {
      [styles.priorityLow]: note.priority === 'LOW',
      [styles.priorityMedium]: note.priority === 'MEDIUM',
      [styles.priorityHigh]: note.priority === 'HIGH',
      [styles.done]: note.isDone,
    })}
  >
    <button
      className={cn(styles.checkBtn, { [styles.checkBtnDone]: note.isDone })}
      onClick={() => onToggleDone(note)}
      title={note.isDone ? 'Восстановить' : 'Отметить выполненным'}
    >
      {note.isDone ? <CheckCircleFilled className={styles.doneIcon} /> : <CheckCircleOutlined />}
    </button>

    <div className={styles.cardBody}>
      <div className={styles.cardText}>{note.text}</div>
      {(note.date || note.time) && (
        <div className={styles.cardMeta}>
          {note.date && (
            <span className={styles.metaItem}>
              <CalendarOutlined />
              {dayjs(note.date).format('DD.MM.YYYY')}
            </span>
          )}
          {note.allDay && note.date && (
            <span className={styles.metaItem}>Весь день</span>
          )}
          {!note.allDay && note.time && (
            <span className={styles.metaItem}>
              <ClockCircleOutlined />
              {note.time}
            </span>
          )}
          {note.repeat && (
            <span className={styles.metaItem}>
              <RetweetOutlined />
              {REPEAT_LABEL[note.repeat as NoteRepeat]}
            </span>
          )}
        </div>
      )}
    </div>

    <div className={styles.cardRight}>
      <Tag className={styles.priorityTag}>{PRIORITY_LABEL[note.priority]}</Tag>
      {canManage && (
        <Space size={2} className={styles.cardActions}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(note)} />
          <Popconfirm
            title="Удалить заметку?"
            onConfirm={() => onDelete(note.id)}
            okText="Да"
            cancelText="Нет"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )}
    </div>
  </div>
);
