import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Switch, message, Row, Col, Checkbox } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useUiStore } from '@/store/uiStore';
import { CompanySettings } from '@/types';
import styles from './SettingsPage.module.scss';

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useUiStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [actualSameAsLegal, setActualSameAsLegal] = useState(false);
  const [postalSameAsLegal, setPostalSameAsLegal] = useState(false);

  useEffect(() => {
    servicesApi.getSettings().then(s => {
      if (s) form.setFieldsValue(s);
    }).catch(() => {});
  }, [form]);

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    const data = { ...values };
    if (actualSameAsLegal) data.actualAddress = values.legalAddress;
    if (postalSameAsLegal) data.postalAddress = values.legalAddress;

    setLoading(true);
    try {
      await servicesApi.updateSettings(data as Partial<CompanySettings>);
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
        <Col xs={24} lg={14}>
          <Card title="Данные компании">
            <Form form={form} layout="vertical">
              <Form.Item label="Название компании" name="name" rules={[{ required: true }]}>
                <Input placeholder="ООО «Прайм Авто»" />
              </Form.Item>

              <Form.Item label="Юридический адрес" name="legalAddress">
                <Input placeholder="220000, г. Минск, ул. Примерная, д. 1" />
              </Form.Item>

              <Form.Item label="Адрес фактический" name="actualAddress">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Checkbox
                    checked={actualSameAsLegal}
                    onChange={e => setActualSameAsLegal(e.target.checked)}
                  >
                    Совпадает с юридическим
                  </Checkbox>
                  {!actualSameAsLegal && (
                    <Form.Item name="actualAddress" noStyle>
                      <Input placeholder="220000, г. Минск, ул. Примерная, д. 1" />
                    </Form.Item>
                  )}
                </div>
              </Form.Item>

              <Form.Item label="Адрес почтовый" name="postalAddress">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Checkbox
                    checked={postalSameAsLegal}
                    onChange={e => setPostalSameAsLegal(e.target.checked)}
                  >
                    Совпадает с юридическим
                  </Checkbox>
                  {!postalSameAsLegal && (
                    <Form.Item name="postalAddress" noStyle>
                      <Input placeholder="220000, г. Минск, ул. Примерная, д. 1" />
                    </Form.Item>
                  )}
                </div>
              </Form.Item>

              <Form.Item label="Реквизиты счёта в банке" name="bankDetails">
                <Input.TextArea
                  rows={4}
                  placeholder="р/с 3012000000000&#10;в ОАО «Беларусбанк»&#10;230000, г. Гродно..."
                  style={{ whiteSpace: 'pre-wrap' }}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="БИК" name="bic">
                    <Input placeholder="BLBBBY2X" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="УНП" name="taxId">
                    <Input placeholder="000000000" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="ОКПО" name="okpo">
                    <Input placeholder="00000000" />
                  </Form.Item>
                </Col>
              </Row>

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

              <Button type="primary" loading={loading} onClick={handleSave}>
                Сохранить
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
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
        </Col>
      </Row>
    </div>
  );
};
