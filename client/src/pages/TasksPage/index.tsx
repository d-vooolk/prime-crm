import React, { useEffect, useState } from 'react';
import { Button, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Spin } from 'antd';
import { CheckOutlined, DeleteOutlined, PlusOutlined, RollbackOutlined, SendOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { Task, tasksApi, TaskTab } from '@/api/tasks.api';
import { useInvalidateTasks, useTaskAssignees, useTasks, useTasksMineCount } from '@/hooks/useTasks';
import { useNotify } from '@/hooks/useNotify';
import { useAuthStore } from '@/store/authStore';
import { LoadError } from '@/components/Shared/LoadError';
import { formatDateTime } from '@/utils/formatters';
import styles from './TasksPage.module.scss';

interface TaskFormValues {
  text: string;
  assigneeId: string;
}

const EMPTY_TEXT: Record<TaskTab, string> = {
  mine: 'Заданий для вас нет',
  given: 'Вы пока никому не ставили заданий',
  done: 'Выполненных заданий пока нет',
};

/** Задания друг другу карточками (менеджер и выше): кому — любой руководитель, можно себе */
export const TasksPage: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const notify = useNotify();
  const invalidate = useInvalidateTasks();
  const [tab, setTab] = useState<TaskTab>('mine');
  const { data: tasks = [], isLoading, isError, error, refetch } = useTasks(tab);
  const { data: mineCount = 0 } = useTasksMineCount();
  const [formOpen, setFormOpen] = useState(false);
  const { data: assignees = [], isLoading: assigneesLoading } = useTaskAssignees(formOpen);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form] = Form.useForm<TaskFormValues>();

  // Новое задание — по умолчанию себе (если пользователь есть в списке)
  useEffect(() => {
    if (!formOpen) return;
    form.resetFields();
    if (user && assignees.some(a => a.id === user.id)) form.setFieldsValue({ assigneeId: user.id });
  }, [formOpen, assignees, user, form]);

  const handleSend = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSending(true);
    try {
      await tasksApi.create(values);
      notify.toast.success('Задание отправлено');
      setFormOpen(false);
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось отправить задание');
    } finally {
      setSending(false);
    }
  };

  const toggleDone = async (task: Task, done: boolean) => {
    setBusyId(task.id);
    try {
      await tasksApi.setDone(task.id, done);
      notify.toast.success(done ? 'Задание выполнено' : 'Задание возвращено');
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось отметить задание');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      await tasksApi.delete(task.id);
      notify.toast.success('Задание удалено');
      await invalidate();
    } catch (e) {
      notify.error(e, 'Не удалось удалить задание');
    }
  };

  const renderPeople = (task: Task) => {
    const self = task.authorId === task.assigneeId;
    if (self) return <>Себе</>;
    const fromMe = task.authorId === user?.id;
    return fromMe
      ? <>Кому: <b>{task.assignee.name}</b></>
      : <>От: <b>{task.authorName}</b>{tab === 'done' && task.assigneeId !== user?.id && <> → {task.assignee.name}</>}</>;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Задания</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>Новое задание</Button>
      </div>

      <Segmented<TaskTab>
        className={styles.tabs}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mine', label: mineCount > 0 ? `Мне · ${mineCount}` : 'Мне' },
          { value: 'given', label: 'От меня' },
          { value: 'done', label: 'Выполненные' },
        ]}
      />

      {isError && <LoadError title="Не удалось загрузить задания" error={error} onRetry={() => refetch()} />}

      {isLoading ? (
        <div className={styles.loader}><Spin /></div>
      ) : tasks.length === 0 && !isError ? (
        <Empty className={styles.empty} description={EMPTY_TEXT[tab]} />
      ) : (
        <div className={styles.list}>
          {tasks.map(task => (
            <article key={task.id} className={cn(styles.card, { [styles.cardDone]: task.isDone })}>
              <div className={styles.cardTop}>
                <span className={styles.people}>{renderPeople(task)}</span>
                <span className={styles.muted}>{formatDateTime(task.createdAt)}</span>
              </div>

              <p className={styles.text}>{task.text}</p>

              <div className={styles.actions}>
                {task.isDone ? (
                  <>
                    {task.doneAt && <span className={styles.muted}>Выполнено {formatDateTime(task.doneAt)}</span>}
                    <Button size="small" icon={<RollbackOutlined />} loading={busyId === task.id} onClick={() => toggleDone(task, false)}>
                      Вернуть
                    </Button>
                  </>
                ) : (
                  <Button type="primary" size="small" icon={<CheckOutlined />} loading={busyId === task.id} onClick={() => toggleDone(task, true)}>
                    Выполнено
                  </Button>
                )}
                {task.authorId === user?.id && (
                  <Popconfirm title="Удалить задание?" okText="Удалить" cancelText="Отмена" onConfirm={() => handleDelete(task)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Удалить" />
                  </Popconfirm>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        title="Новое задание"
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleSend}
        okText="Отправить"
        cancelText="Отмена"
        okButtonProps={{ loading: sending, icon: <SendOutlined /> }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="text" label="Задание" rules={[{ required: true, whitespace: true, message: 'Напишите задание' }]}>
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 14 }} placeholder="Что нужно сделать..." maxLength={5000} />
          </Form.Item>
          <Form.Item name="assigneeId" label="Кому" rules={[{ required: true, message: 'Выберите, кому задание' }]}>
            <Select
              loading={assigneesLoading}
              placeholder="Выберите сотрудника"
              options={assignees.map(a => ({
                value: a.id,
                label: a.id === user?.id ? `${a.name} (себе)` : `${a.name}${a.role ? ` · ${a.role}` : ''}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
