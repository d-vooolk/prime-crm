import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Spin, Switch, Typography } from 'antd';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { SmsConnectionInfo, SmsSettings } from '@/types';
import { LoadError } from '@/components/Shared/LoadError';
import styles from './SmsTab.module.scss';

const { Text } = Typography;

const requiredRule = [{ required: true, message: 'Обязательное поле' }];

/** Подключение к sms.by и шаблоны автоматических сообщений */
export const SmsTab: React.FC = () => {
  const [form] = Form.useForm();
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<SmsConnectionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  // Сервер токен не отдаёт — только последние символы, чтобы было видно, что он сохранён
  const [tokenMask, setTokenMask] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await servicesApi.getSmsSettings();
      if (!s) {
        form.setFieldsValue({ enabled: false });
        return;
      }
      form.setFieldsValue(s);
      setTokenMask(s.tokenMask ?? '');
      // Чтобы селект показал сохранённое альфа-имя до проверки подключения
      if (s.alphanameId && s.alphaname) {
        setInfo(prev => prev ?? { balance: 0, currency: '', alphanames: [{ id: s.alphanameId, name: s.alphaname }] });
      }
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const alphanameId = form.getFieldValue('alphanameId');
      const alphaname = info?.alphanames.find(a => a.id === alphanameId)?.name
        ?? form.getFieldValue('alphaname') ?? '';
      const saved = await servicesApi.updateSmsSettings({ ...values, alphaname } as Partial<SmsSettings>);
      setTokenMask(saved.tokenMask ?? '');
      form.setFieldValue('token', '');
      notify.toast.success('SMS настройки сохранены');
    } catch (e) {
      notify.error(e, 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCheck = async () => {
    const token = form.getFieldValue('token');
    // Пустое поле при сохранённом токене — проверяем сохранённый (сервер возьмёт его сам)
    if (!token && !tokenMask) {
      notify.toast.warning('Укажите API-токен sms.by');
      return;
    }
    setChecking(true);
    try {
      const result = await servicesApi.checkSmsConnection(token || undefined);
      setInfo(result);
      notify.toast.success(`Подключение работает. Баланс: ${result.balance} ${result.currency}`);
    } catch (e) {
      setInfo(null);
      notify.error(e, 'Не удалось подключиться к sms.by');
    } finally {
      setChecking(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      notify.toast.warning('Укажите номер для теста');
      return;
    }
    setTesting(true);
    try {
      await servicesApi.sendTestSms(testPhone.trim());
      notify.toast.success('Тестовое сообщение отправлено');
    } catch (e) {
      notify.error(e, 'Не удалось отправить сообщение');
    } finally {
      setTesting(false);
    }
  };

  if (loadError) {
    return <LoadError title="Не удалось загрузить настройки SMS" error={loadError} onRetry={load} />;
  }

  return (
    <Card>
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <div className={styles.enableRow}>
            <div>
              <div className={styles.label}>Отправка SMS</div>
              <div className={styles.hint}>Включить автоматическую отправку сообщений клиентам</div>
            </div>
            <Form.Item name="enabled" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>

          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                label="API-токен sms.by"
                name="token"
                extra={tokenMask
                  ? `Сохранён токен ${tokenMask}. Оставьте поле пустым, чтобы не менять`
                  : 'Личный кабинет app.sms.by → Настройки → API'}
              >
                <Input.Password
                  placeholder={tokenMask ? 'Токен сохранён' : '0e11a2c8810eaec4c20f86b5caa394eb'}
                  autoComplete="off"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label="Альфа-имя (отправитель)" name="alphanameId">
                <Select
                  allowClear
                  placeholder={info ? 'Без альфа-имени' : 'Сначала проверьте подключение'}
                  options={(info?.alphanames || []).map(a => ({ value: a.id, label: a.name }))}
                  notFoundContent="Одобренных альфа-имён нет"
                />
              </Form.Item>
            </Col>
          </Row>

          <Space wrap className={styles.block}>
            <Button onClick={handleCheck} loading={checking}>Проверить подключение</Button>
            <Input
              className={styles.phoneInput}
              placeholder="375291234567"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />
            <Button onClick={handleTest} loading={testing}>Отправить тестовое SMS</Button>
          </Space>

          {info?.currency && (
            <Alert
              type={info.balance > 0 ? 'success' : 'warning'}
              showIcon
              className={styles.block}
              message={`Баланс: ${info.balance} ${info.currency}`}
              description={
                info.alphanames.length
                  ? `Доступные альфа-имена: ${info.alphanames.map(a => a.name).join(', ')}`
                  : 'Одобренных альфа-имён нет — зарегистрируйте его в личном кабинете app.sms.by, иначе отправка может быть отклонена.'
              }
            />
          )}

          <Alert
            type="info"
            showIcon
            className={styles.block}
            message="Доступные переменные в шаблонах"
            description={
              <div className={styles.variables}>
                <Text code>{'{{clientName}}'}</Text> — имя клиента{' · '}
                <Text code>{'{{date}}'}</Text> — дата записи{' · '}
                <Text code>{'{{time}}'}</Text> — время{' · '}
                <Text code>{'{{carBrand}}'}</Text> — марка авто{' · '}
                <Text code>{'{{carModel}}'}</Text> — модель{' · '}
                <Text code>{'{{plateNumber}}'}</Text> — гос. номер{' · '}
                <Text code>{'{{companyName}}'}</Text> — название компании{' · '}
                <Text code>{'{{services}}'}</Text> — список услуг через запятую
              </div>
            }
          />

          <Form.Item label="Шаблон при создании записи" name="onCreateTemplate" rules={requiredRule}>
            <Input.TextArea rows={3} placeholder="Здравствуйте, {{clientName}}! Вы записаны на {{date}} в {{time}}..." />
          </Form.Item>

          <Form.Item label="Шаблон напоминания (за сутки)" name="reminderTemplate" rules={requiredRule}>
            <Input.TextArea rows={3} placeholder="Напоминаем о записи завтра {{date}} в {{time}}..." />
          </Form.Item>

          <Form.Item label="Шаблон «Авто готово»" name="carReadyTemplate" rules={requiredRule}>
            <Input.TextArea rows={3} placeholder="Здравствуйте, {{clientName}}! Ваш {{carBrand}} {{carModel}} готов к выдаче..." />
          </Form.Item>

          <Form.Item label="Шаблон запроса отзыва" name="reviewRequestTemplate" rules={requiredRule}>
            <Input.TextArea rows={3} placeholder="Здравствуйте, {{clientName}}! Будем благодарны за ваш отзыв..." />
          </Form.Item>

          <Button type="primary" loading={saving} onClick={handleSave}>Сохранить</Button>
        </Form>
      </Spin>
    </Card>
  );
};
