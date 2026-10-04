import React, { useEffect } from 'react';
import { Col, Form, Input, Modal, Row } from 'antd';
import { AuthorizedPerson } from '@/types';
import styles from './AuthorizedPersonModal.module.scss';

interface Props {
  open: boolean;
  onAdd: (person: AuthorizedPerson) => void;
  onClose: () => void;
}

const required = [{ required: true, message: 'Обязательное поле' }];

/** Новое доверенное лицо — сохраняется вместе с настройками компании */
export const AuthorizedPersonModal: React.FC<Props> = ({ open, onAdd, onClose }) => {
  const [form] = Form.useForm<AuthorizedPerson>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    onAdd(values);
  };

  return (
    <Modal
      open={open}
      title="Доверенное лицо"
      onCancel={onClose}
      onOk={handleOk}
      okText="Добавить"
      cancelText="Отмена"
    >
      <Form form={form} layout="vertical" className={styles.form}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="ФИО (именит.)" name="nameNominative" rules={required}>
              <Input placeholder="Петрова Анна Сергеевна" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="ФИО (в склонении)" name="nameGenitive" rules={required}>
              <Input placeholder="Петровой Анны Сергеевны" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Должность (именит.)" name="positionNominative" rules={required}>
              <Input placeholder="Менеджер" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Должность (в склонении)" name="positionGenitive" rules={required}>
              <Input placeholder="менеджера" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Основание" name="basis" rules={required}>
          <Input placeholder="доверенности №1 от 01.01.2024" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
