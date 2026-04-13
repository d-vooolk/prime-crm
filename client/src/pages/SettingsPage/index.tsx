import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Switch, message, Divider, Row, Col } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useUiStore } from '@/store/uiStore';
import { CompanySettings } from '@/types';
import styles from './SettingsPage.module.scss';

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useUiStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    servicesApi.getSettings().then(s => { if (s) form.setFieldsValue(s); }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setLoading(true);
    try {
      await servicesApi.updateSettings(values as Partial<CompanySettings>);
      message.success('Настройки сохранены');
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Настройки</h1>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Данные компании">
            <Form form={form} layout="vertical">
              <Form.Item label="Название компании" name="name" rules={[{ required: true }]}>
                <Input placeholder="Prime Auto Service" />
              </Form.Item>
              <Form.Item label="Адрес" name="address">
                <Input placeholder="ул. Примерная, 1" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Телефон" name="phone">
                    <Input placeholder="+375 29 000-00-00" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Email" name="email">
                    <Input placeholder="info@example.com" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="УНП / ИНН" name="taxId">
                <Input placeholder="000000000" />
              </Form.Item>
              <Form.Item label="Банковские реквизиты" name="bankDetails">
                <Input.TextArea rows={3} placeholder="Расчётный счёт, банк..." />
              </Form.Item>
              <Button type="primary" loading={loading} onClick={handleSave}>
                Сохранить
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Оформление">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Тёмная тема</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Переключить между светлой и тёмной темой
                </div>
              </div>
              <Switch checked={theme === 'dark'} onChange={toggleTheme} />
            </div>
          </Card>

          <Card title="О программе" style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 2 }}>
              <div><strong>Prime CRM</strong> — система управления записями автосервиса</div>
              <div>Версия: 1.0.0</div>
              <Divider style={{ margin: '12px 0' }} />
              <div>Для поддержки обращайтесь к разработчику</div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
