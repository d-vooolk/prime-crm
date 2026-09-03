import React, { useEffect, useState } from 'react';
import {
  Card, Form, Input, Button, Switch, message, Row, Col, Checkbox,
  Modal, Table, Tag, Select, Space, Popconfirm, Tabs, Alert, Typography, Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { servicesApi } from '@/api/services.api';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { CompanySettings, DocumentTemplate, Category, SmsSettings, SmsConnectionInfo, AuthorizedPerson } from '@/types';
import { CarCatalogEditor } from '@/components/CarCatalogEditor';
import styles from './SettingsPage.module.scss';

const { Text } = Typography;

const DEFAULT_WORK_ORDER_CONTENT = `Дополнительные работы, необходимость в которых может возникнуть в процессе исполнения Заказа, их стоимость и сроки выполнения Исполнитель согласовывает с Заказчиком/Представителем устно и/или письменно с последующим отражением в документе, подтверждающий факт выполненных работ.
Исполнитель не несёт ответственность за несоответствие параметрам гос. стандартов при прохождении государственного технического осмотра.
Исполнитель имеет право на совершение фото и видео съёмки автомобиля, а так же на управление ТС для тех. целей.
Клиент обязуется забрать автомобиль в течение 24 часов с момента уведомления о завершении работ (по телефону, SMS, email или иным способом).
В случае, если клиент не забирает автомобиль в указанный срок, взимается плата за парковку в размере 15 белорусских рублей в день.
Мастерская не несёт материальной ответственности за повреждения, произошедшие на парковке (ДТП, угоны, стихийные бедствия и иные внешние воздействия).
Клиент принимает на себя все риски, связанные с дальнейшим хранением автомобиля на территории мастерской.

При наличии дефектов автомобиля, находящихся непосредственно в зоне проведения ремонтных работ, Заказчик обязан описать их ниже.
В случае обнаружения дефектов, влияющих на качественное выполнение работ, не указанных в документе, Исполнитель может взымать дополнительную плату за их исправление, с уведомлением или без уведомления Заказчика.

Заказчик даёт право Исполнителю на обработку персональных данных, отправку смс-рассылки с информацией касающейся текущего или последующих ремонтов.
____________________________________________________________________`;

const DEFAULT_COMPLETION_ACT_CONTENT = `Претензии не принимаются в случае не соблюдения заказчиком правил технической эксплуатации, дорожно-транспортного происшествия, при ремонте установленного агрегата, узла, детали, без предъявления ТС на предприятие автосервиса, а также в случае предъявления претензий после установленного срока. Гарантийный срок начинает исчисляться со дня приёмки потребителем ТС или агрегата. Предприятие не устанавливает гарантии на запчасти предоставленные заказчиком для ремонта, а так же на ремонт корпуса, креплений и стекла фары посредством пайки.
Претензии по качеству и объему выполненных услуг по обслуживанию могут быть предъявлены заказчиком в течение следующих гарантийных сроков:
- при условии разбора фары: на герметичность шва между стеклом и корпусом фары - в течение ____
Для действия гарантии фара должна соответствовать заводским параметрам герметичности.
При любом ДТП необходимо явиться к исполнителю для диагностики повреждений фар.
При несоответствии фары эксплуатационным характеристикам, не связанными с работой Исполнителя, необходимо в срок до 14 дней исправить все имеющиеся недостатки и предоставить доказательства исправления исполнителю.

С объёмом работ согласен(на), перечень работ понятен, претензий к выполненным работам и состоянию ТС (как с внешней, так и с внутренней стороны) не имею, все работы приняты мною в полном объёме, качество мною проверено; само транспортное средство, ключи от него и документы на ТС от Подрядчика получила(а); с правилами оказания услуг по ремонту ТС согласно СТБ 1175-2011 ознакомлен(а), содержание мне понятно. Гарантийные обязательства на работы выполняются исполнителем только при предъявлении ТС, акта выполненных работ на проведённые работы и техпаспорта (доверенности). ТС - транспортное средство, автомобиль.`;

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useUiStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isSotrudnik = user?.role === 'Сотрудник';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [actualSameAsLegal, setActualSameAsLegal] = useState(false);
  const [postalSameAsLegal, setPostalSameAsLegal] = useState(false);

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [currentType, setCurrentType] = useState<'work_order' | 'completion_act'>('work_order');
  const [templateForm] = Form.useForm();
  const [templateSaving, setTemplateSaving] = useState(false);

  const [authorizedPersons, setAuthorizedPersons] = useState<AuthorizedPerson[]>([]);
  const [personModal, setPersonModal] = useState(false);
  const [personForm] = Form.useForm();

  const [smsForm] = Form.useForm();
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsInfo, setSmsInfo] = useState<SmsConnectionInfo | null>(null);
  const [smsChecking, setSmsChecking] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    servicesApi.getSettings().then(s => {
      if (s) {
        const { authorizedPersons: ap, ...rest } = s;
        form.setFieldsValue(rest);
        setAuthorizedPersons(ap || []);
      }
    }).catch(() => {});
    loadTemplates();
    servicesApi.getCategories().then(setCategories).catch(() => {});
    servicesApi.getSmsSettings().then(s => {
      if (!s) {
        smsForm.setFieldsValue({ enabled: false });
        return;
      }
      smsForm.setFieldsValue(s);
      // Чтобы селект показал сохранённое альфа-имя до проверки подключения
      if (s.alphanameId && s.alphaname) {
        setSmsInfo(prev => prev ?? { balance: 0, currency: '', alphanames: [{ id: s.alphanameId, name: s.alphaname }] });
      }
    }).catch(() => {});
  }, [form, smsForm]);

  const loadTemplates = () => {
    setTemplatesLoading(true);
    servicesApi.getDocTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  };

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const data = { ...values, authorizedPersons };
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

  const openCreate = (type: 'work_order' | 'completion_act') => {
    setEditingTemplate(null);
    setCurrentType(type);
    const defaultContent = type === 'completion_act'
      ? DEFAULT_COMPLETION_ACT_CONTENT
      : DEFAULT_WORK_ORDER_CONTENT;
    const sameTypeTemplates = templates.filter(t => t.type === type);
    templateForm.setFieldsValue({
      name: type === 'completion_act' ? 'Акт (базовый)' : 'Заявка (базовый)',
      isDefault: sameTypeTemplates.length === 0,
      categoryId: null,
      content: defaultContent,
    });
    setTemplateModal(true);
  };

  const openEdit = (t: DocumentTemplate) => {
    setEditingTemplate(t);
    setCurrentType(t.type as 'work_order' | 'completion_act');
    templateForm.setFieldsValue({
      name: t.name,
      isDefault: t.isDefault,
      categoryId: t.categoryId || null,
      content: t.content,
    });
    setTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    const values = await templateForm.validateFields().catch(() => null);
    if (!values) return;
    setTemplateSaving(true);
    try {
      const payload = { ...values, type: currentType };
      if (editingTemplate) {
        await servicesApi.updateDocTemplate(editingTemplate.id, payload);
        message.success('Шаблон обновлён');
      } else {
        await servicesApi.createDocTemplate(payload);
        message.success('Шаблон создан');
      }
      setTemplateModal(false);
      loadTemplates();
    } catch {
      message.error('Ошибка сохранения шаблона');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await servicesApi.deleteDocTemplate(id);
      message.success('Шаблон удалён');
      loadTemplates();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const makeColumns = () => [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: DocumentTemplate) => (
        <div>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {row.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>По умолчанию</Tag>}
        </div>
      ),
    },
    {
      title: 'Категория',
      key: 'category',
      width: 200,
      render: (_: unknown, row: DocumentTemplate) =>
        row.category
          ? <Tag>{row.category.name}</Tag>
          : <span style={{ color: 'var(--color-text-secondary)' }}>Все категории</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, row: DocumentTemplate) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Удалить шаблон?" onConfirm={() => handleDelete(row.id)} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleSaveSms = async () => {
    const values = await smsForm.validateFields().catch(() => null);
    if (!values) return;
    setSmsSaving(true);
    try {
      const alphanameId = smsForm.getFieldValue('alphanameId');
      const alphaname = smsInfo?.alphanames.find(a => a.id === alphanameId)?.name
        ?? smsForm.getFieldValue('alphaname') ?? '';
      await servicesApi.updateSmsSettings({ ...values, alphaname } as Partial<SmsSettings>);
      message.success('SMS настройки сохранены');
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSmsSaving(false);
    }
  };

  const handleCheckSms = async () => {
    const token = smsForm.getFieldValue('token');
    if (!token) {
      message.warning('Укажите API-токен sms.by');
      return;
    }
    setSmsChecking(true);
    try {
      const info = await servicesApi.checkSmsConnection(token);
      setSmsInfo(info);
      message.success(`Подключение работает. Баланс: ${info.balance} ${info.currency}`);
    } catch (e) {
      setSmsInfo(null);
      message.error(e instanceof Error ? e.message : 'Не удалось подключиться к sms.by');
    } finally {
      setSmsChecking(false);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      message.warning('Укажите номер для теста');
      return;
    }
    setSmsTesting(true);
    try {
      await servicesApi.sendTestSms(testPhone.trim());
      message.success('Тестовое сообщение отправлено');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось отправить сообщение');
    } finally {
      setSmsTesting(false);
    }
  };

  const workOrderTemplates = templates.filter(t => t.type === 'work_order');
  const completionActTemplates = templates.filter(t => t.type === 'completion_act');

  const tabItems = [
    {
      key: 'basic',
      label: 'Базовые',
      children: (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Тёмная тема</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Переключить между светлой и тёмной темой
              </div>
            </div>
            <Switch checked={theme === 'dark'} onChange={toggleTheme} />
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 16, paddingTop: 16 }}>
            <Popconfirm
              title="Выйти из системы?"
              onConfirm={handleLogout}
              okText="Выйти"
              cancelText="Отмена"
            >
              <Button danger icon={<LogoutOutlined />}>
                Выйти из системы
              </Button>
            </Popconfirm>
          </div>
        </Card>
      ),
    },
    {
      key: 'company',
      label: 'Компания',
      children: (
        <Card>
          <Form form={form} layout="vertical">
            <Form.Item label="Название компании" name="name" rules={[{ required: true }]}>
              <Input placeholder="ООО «Прайм Авто»" />
            </Form.Item>

            <Form.Item label="Юридический адрес" name="legalAddress">
              <Input placeholder="220000, г. Минск, ул. Примерная, д. 1" />
            </Form.Item>

            <Form.Item label="Адрес фактический" name="actualAddress">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Checkbox checked={actualSameAsLegal} onChange={e => setActualSameAsLegal(e.target.checked)}>
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
                <Checkbox checked={postalSameAsLegal} onChange={e => setPostalSameAsLegal(e.target.checked)}>
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
                <Form.Item label="БИК" name="bic"><Input placeholder="BLBBBY2X" /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="УНП" name="taxId"><Input placeholder="000000000" /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="ОКПО" name="okpo"><Input placeholder="00000000" /></Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Префикс документов" name="documentPrefix">
                  <Input placeholder="ПА" maxLength={5} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Телефон" name="phone"><Input placeholder="+375 29 000-00-00" /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Email" name="email"><Input placeholder="info@example.com" /></Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, marginTop: 8 }}>Подписанты</Divider>

            <div style={{ fontWeight: 500, marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Директор
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="ФИО (именит. падеж)" name="directorName">
                  <Input placeholder="Иванов Иван Иванович" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="ФИО (в склонении)" name="directorNameGenitive">
                  <Input placeholder="Иванова Ивана Ивановича" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Должность (именит.)" name="directorPosition">
                  <Input placeholder="Директор" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Должность (в склонении)" name="directorPositionGenitive">
                  <Input placeholder="директора" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Основание" name="directorBasis">
                  <Input placeholder="устава" />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ fontWeight: 500, marginTop: 8, marginBottom: 10, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Доверенные лица
            </div>

            {authorizedPersons.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 6 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{p.nameNominative}</span>
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8, fontSize: 13 }}>
                    {p.positionNominative}
                  </span>
                </div>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setAuthorizedPersons(prev => prev.filter((_, j) => j !== i))}
                />
              </div>
            ))}

            <Button
              icon={<PlusOutlined />}
              size="small"
              style={{ marginBottom: 24 }}
              onClick={() => { personForm.resetFields(); setPersonModal(true); }}
            >
              Добавить доверенное лицо
            </Button>

            <br />
            <Button type="primary" loading={loading} onClick={handleSave}>Сохранить</Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'sms',
      label: 'SMS',
      children: (
        <Card>
          <Form form={smsForm} layout="vertical">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 20px' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Отправка SMS</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Включить автоматическую отправку сообщений клиентам
                </div>
              </div>
              <Form.Item name="enabled" valuePropName="checked" style={{ margin: 0 }}>
                <Switch />
              </Form.Item>
            </div>

            <Row gutter={16}>
              <Col xs={24} sm={14}>
                <Form.Item
                  label="API-токен sms.by"
                  name="token"
                  extra="Личный кабинет app.sms.by → Настройки → API"
                >
                  <Input.Password placeholder="0e11a2c8810eaec4c20f86b5caa394eb" autoComplete="off" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10}>
                <Form.Item label="Альфа-имя (отправитель)" name="alphanameId">
                  <Select
                    allowClear
                    placeholder={smsInfo ? 'Без альфа-имени' : 'Сначала проверьте подключение'}
                    options={(smsInfo?.alphanames || []).map(a => ({ value: a.id, label: a.name }))}
                    notFoundContent="Одобренных альфа-имён нет"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Space wrap style={{ marginBottom: 20 }}>
              <Button onClick={handleCheckSms} loading={smsChecking}>Проверить подключение</Button>
              <Input
                style={{ width: 200 }}
                placeholder="375291234567"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
              />
              <Button onClick={handleTestSms} loading={smsTesting}>Отправить тестовое SMS</Button>
            </Space>

            {smsInfo?.currency && (
              <Alert
                type={smsInfo.balance > 0 ? 'success' : 'warning'}
                showIcon
                style={{ marginBottom: 20 }}
                message={`Баланс: ${smsInfo.balance} ${smsInfo.currency}`}
                description={
                  smsInfo.alphanames.length
                    ? `Доступные альфа-имена: ${smsInfo.alphanames.map(a => a.name).join(', ')}`
                    : 'Одобренных альфа-имён нет — зарегистрируйте его в личном кабинете app.sms.by, иначе отправка может быть отклонена.'
                }
              />
            )}

            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message="Доступные переменные в шаблонах"
              description={
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
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

            <Form.Item
              label="Шаблон при создании записи"
              name="onCreateTemplate"
              rules={[{ required: true, message: 'Обязательное поле' }]}
            >
              <Input.TextArea rows={3} placeholder="Здравствуйте, {{clientName}}! Вы записаны на {{date}} в {{time}}..." />
            </Form.Item>

            <Form.Item
              label="Шаблон напоминания (за сутки)"
              name="reminderTemplate"
              rules={[{ required: true, message: 'Обязательное поле' }]}
            >
              <Input.TextArea rows={3} placeholder="Напоминаем о записи завтра {{date}} в {{time}}..." />
            </Form.Item>

            <Form.Item
              label="Шаблон «Авто готово»"
              name="carReadyTemplate"
              rules={[{ required: true, message: 'Обязательное поле' }]}
            >
              <Input.TextArea rows={3} placeholder="Здравствуйте, {{clientName}}! Ваш {{carBrand}} {{carModel}} готов к выдаче..." />
            </Form.Item>

            <Form.Item
              label="Шаблон запроса отзыва"
              name="reviewRequestTemplate"
              rules={[{ required: true, message: 'Обязательное поле' }]}
            >
              <Input.TextArea rows={3} placeholder="Здравствуйте, {{clientName}}! Будем благодарны за ваш отзыв..." />
            </Form.Item>

            <Button type="primary" loading={smsSaving} onClick={handleSaveSms}>Сохранить</Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'templates',
      label: 'Шаблоны документов',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card
            title="Шаблоны заявок"
            extra={
              <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openCreate('work_order')}>
                Добавить шаблон
              </Button>
            }
          >
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              Юридический текст, который печатается в заявке на проведение работ. Можно создать отдельный шаблон для каждой категории услуг.
            </p>
            <Table
              dataSource={workOrderTemplates}
              columns={makeColumns()}
              rowKey="id"
              loading={templatesLoading}
              pagination={false}
              size="small"
              locale={{ emptyText: 'Нет шаблонов. При печати будет использован текст по умолчанию.' }}
            />
          </Card>

          <Card
            title="Шаблоны актов выполненных работ"
            extra={
              <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openCreate('completion_act')}>
                Добавить шаблон
              </Button>
            }
          >
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              Текст гарантийных обязательств и условий приёмки, который печатается в акте выполненных работ. Можно создать отдельный шаблон для каждой категории услуг.
            </p>
            <Table
              dataSource={completionActTemplates}
              columns={makeColumns()}
              rowKey="id"
              loading={templatesLoading}
              pagination={false}
              size="small"
              locale={{ emptyText: 'Нет шаблонов. При печати будет использован текст по умолчанию.' }}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'carCatalog',
      label: 'Справочник авто',
      children: (
        <Card title="Марки, модели и поколения">
          <CarCatalogEditor />
        </Card>
      ),
    },
  ];

  const visibleTabItems = isSotrudnik ? tabItems.filter(t => t.key === 'basic') : tabItems;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Настройки</h1>

      <Tabs items={visibleTabItems} />

      <Modal
        open={personModal}
        title="Доверенное лицо"
        onCancel={() => setPersonModal(false)}
        onOk={async () => {
          const values = await personForm.validateFields().catch(() => null);
          if (!values) return;
          setAuthorizedPersons(prev => [...prev, values as AuthorizedPerson]);
          setPersonModal(false);
        }}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Form form={personForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="ФИО (именит.)" name="nameNominative" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="Петрова Анна Сергеевна" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="ФИО (в склонении)" name="nameGenitive" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="Петровой Анны Сергеевны" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Должность (именит.)" name="positionNominative" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="Менеджер" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Должность (в склонении)" name="positionGenitive" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input placeholder="менеджера" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Основание" name="basis" rules={[{ required: true, message: 'Обязательное поле' }]}>
            <Input placeholder="доверенности №1 от 01.01.2024" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={templateModal}
        onCancel={() => setTemplateModal(false)}
        title={
          editingTemplate
            ? 'Редактировать шаблон'
            : currentType === 'completion_act' ? 'Новый шаблон акта' : 'Новый шаблон заявки'
        }
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setTemplateModal(false)}>Отмена</Button>,
          <Button key="save" type="primary" loading={templateSaving} onClick={handleSaveTemplate}>
            Сохранить
          </Button>,
        ]}
      >
        <Form form={templateForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Название" name="name" rules={[{ required: true, message: 'Обязательное поле' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Категория услуг" name="categoryId">
                <Select
                  allowClear
                  placeholder="Все категории (по умолчанию)"
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>Использовать как шаблон по умолчанию</Checkbox>
          </Form.Item>

          <Form.Item
            label="Текст"
            name="content"
            rules={[{ required: true, message: 'Обязательное поле' }]}
            extra={currentType === 'completion_act'
              ? 'Прочерк «____» в тексте заменяется на гарантийный срок, выбранный при закрытии сделки.'
              : undefined}
          >
            <Input.TextArea
              rows={16}
              style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
