import React, { useState } from 'react';
import { Button, Card, Checkbox, Col, Divider, Form, Input, Row, Spin } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useCompanySettings, useInvalidateReference } from '@/hooks/useReferenceData';
import { AuthorizedPerson, CompanySettings } from '@/types';
import { LoadError } from '@/components/Shared/LoadError';
import { AuthorizedPersonModal } from './AuthorizedPersonModal';
import styles from './CompanyTab.module.scss';

const ADDRESS_PLACEHOLDER = '220000, г. Минск, ул. Примерная, д. 1';

interface FieldProps {
  label: string;
  value?: string | null;
  /** На всю ширину: адреса, банковские реквизиты */
  wide?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, wide }) => (
  <div className={cn(styles.field, { [styles.fieldWide]: wide })}>
    <div className={styles.fieldLabel}>{label}</div>
    <div className={cn(styles.fieldValue, { [styles.fieldEmpty]: !value?.trim() })}>{value?.trim() || '—'}</div>
  </div>
);

/** Фактический/почтовый адрес: совпадает с юридическим — так и пишем */
const addressText = (address: string | undefined, legal: string | undefined) =>
  (address && address === legal ? 'Совпадает с юридическим' : address);

/**
 * Реквизиты компании и подписанты — для печатных документов.
 * Показываются текстом; правка — по кнопке «Редактировать».
 */
export const CompanyTab: React.FC = () => {
  const [form] = Form.useForm();
  const { data: settings, isLoading, isError, error, refetch } = useCompanySettings();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actualSameAsLegal, setActualSameAsLegal] = useState(false);
  const [postalSameAsLegal, setPostalSameAsLegal] = useState(false);
  const [authorizedPersons, setAuthorizedPersons] = useState<AuthorizedPerson[]>([]);
  const [personModal, setPersonModal] = useState(false);

  const [initialValues, setInitialValues] = useState<Omit<CompanySettings, 'authorizedPersons'>>();

  // Форма монтируется заново при каждом входе в редактирование и берёт значения на этот момент:
  // повторная загрузка настроек не затирает ввод
  const startEdit = () => {
    if (!settings) return;
    const { authorizedPersons: ap, ...rest } = settings;
    setInitialValues(rest);
    setAuthorizedPersons(ap || []);
    setActualSameAsLegal(!!rest.legalAddress && rest.actualAddress === rest.legalAddress);
    setPostalSameAsLegal(!!rest.legalAddress && rest.postalAddress === rest.legalAddress);
    setEditing(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const data = { ...values, authorizedPersons };
    if (actualSameAsLegal) data.actualAddress = values.legalAddress;
    if (postalSameAsLegal) data.postalAddress = values.legalAddress;
    setSaving(true);
    try {
      await servicesApi.updateSettings(data as Partial<CompanySettings>);
      notify.toast.success('Настройки сохранены');
      await invalidate('companySettings');
      setEditing(false);
    } catch (e) {
      notify.error(e, 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (isError) {
    return <LoadError title="Не удалось загрузить настройки компании" error={error} onRetry={() => refetch()} />;
  }

  const addressField = (name: string, label: string, same: boolean, setSame: (v: boolean) => void) => (
    <Form.Item label={label} name={name}>
      <div className={styles.addressField}>
        <Checkbox checked={same} onChange={e => setSame(e.target.checked)}>
          Совпадает с юридическим
        </Checkbox>
        {!same && (
          <Form.Item name={name} noStyle>
            <Input placeholder={ADDRESS_PLACEHOLDER} />
          </Form.Item>
        )}
      </div>
    </Form.Item>
  );

  const view = settings && (
    <>
      <div className={styles.fields}>
        <Field label="Название компании" value={settings.name} wide />
        <Field label="Юридический адрес" value={settings.legalAddress} wide />
        <Field label="Адрес фактический" value={addressText(settings.actualAddress, settings.legalAddress)} wide />
        <Field label="Адрес почтовый" value={addressText(settings.postalAddress, settings.legalAddress)} wide />
        <Field label="Реквизиты счёта в банке" value={settings.bankDetails} wide />
        <Field label="БИК" value={settings.bic} />
        <Field label="УНП" value={settings.taxId} />
        <Field label="ОКПО" value={settings.okpo} />
        <Field label="Префикс документов" value={settings.documentPrefix} />
        <Field label="Телефон" value={settings.phone} />
        <Field label="Email" value={settings.email} />
      </div>

      <Divider orientation="left" className={styles.divider}>Подписанты</Divider>

      <div className={styles.subheading}>Директор</div>
      <div className={styles.fields}>
        <Field label="ФИО (именит. падеж)" value={settings.directorName} />
        <Field label="ФИО (в склонении)" value={settings.directorNameGenitive} />
        <Field label="Должность (именит.)" value={settings.directorPosition} />
        <Field label="Должность (в склонении)" value={settings.directorPositionGenitive} />
        <Field label="Основание" value={settings.directorBasis} />
      </div>

      <div className={cn(styles.subheading, styles.subheadingSpaced)}>Доверенные лица</div>
      {(settings.authorizedPersons ?? []).length === 0 && <div className={styles.fieldEmpty}>Нет</div>}
      {(settings.authorizedPersons ?? []).map((p, i) => (
        <div key={i} className={styles.person}>
          <div className={styles.personInfo}>
            <span className={styles.personName}>{p.nameNominative}</span>
            <span className={styles.personPosition}>{p.positionNominative}</span>
          </div>
        </div>
      ))}
    </>
  );

  const edit = (
    <Form form={form} layout="vertical" initialValues={initialValues}>
      <Form.Item label="Название компании" name="name" rules={[{ required: true, message: 'Укажите название' }]}>
        <Input placeholder="ООО «Прайм Авто»" />
      </Form.Item>

      <Form.Item label="Юридический адрес" name="legalAddress">
        <Input placeholder={ADDRESS_PLACEHOLDER} />
      </Form.Item>

      {addressField('actualAddress', 'Адрес фактический', actualSameAsLegal, setActualSameAsLegal)}
      {addressField('postalAddress', 'Адрес почтовый', postalSameAsLegal, setPostalSameAsLegal)}

      <Form.Item label="Реквизиты счёта в банке" name="bankDetails">
        <Input.TextArea
          rows={4}
          placeholder="р/с 3012000000000&#10;в ОАО «Беларусбанк»&#10;230000, г. Гродно..."
          className={styles.preWrap}
        />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="БИК" name="bic"><Input placeholder="BLBBBY2X" /></Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="УНП" name="taxId"><Input placeholder="000000000" /></Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="ОКПО" name="okpo"><Input placeholder="00000000" /></Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="Префикс документов" name="documentPrefix">
            <Input placeholder="ПА" maxLength={5} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Телефон" name="phone"><Input placeholder="+375 29 000-00-00" /></Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Email" name="email"><Input placeholder="info@example.com" /></Form.Item>
        </Col>
      </Row>

      <Divider orientation="left" className={styles.divider}>Подписанты</Divider>

      <div className={styles.subheading}>Директор</div>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="ФИО (именит. падеж)" name="directorName">
            <Input placeholder="Иванов Иван Иванович" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="ФИО (в склонении)" name="directorNameGenitive">
            <Input placeholder="Иванова Ивана Ивановича" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Должность (именит.)" name="directorPosition">
            <Input placeholder="Директор" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Должность (в склонении)" name="directorPositionGenitive">
            <Input placeholder="директора" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Основание" name="directorBasis">
            <Input placeholder="устава" />
          </Form.Item>
        </Col>
      </Row>

      <div className={cn(styles.subheading, styles.subheadingSpaced)}>Доверенные лица</div>

      {authorizedPersons.map((p, i) => (
        <div key={i} className={styles.person}>
          <div className={styles.personInfo}>
            <span className={styles.personName}>{p.nameNominative}</span>
            <span className={styles.personPosition}>{p.positionNominative}</span>
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
        className={styles.addPerson}
        onClick={() => setPersonModal(true)}
      >
        Добавить доверенное лицо
      </Button>

      <div className={styles.editActions}>
        <Button onClick={() => setEditing(false)} disabled={saving}>Отмена</Button>
        <Button type="primary" loading={saving} onClick={handleSave}>Сохранить</Button>
      </div>
    </Form>
  );

  return (
    <Card
      title="Компания"
      extra={!editing && settings && (
        <Button icon={<EditOutlined />} onClick={startEdit}>Редактировать</Button>
      )}
    >
      <Spin spinning={isLoading}>
        {editing ? edit : view}
      </Spin>

      <AuthorizedPersonModal
        open={personModal}
        onClose={() => setPersonModal(false)}
        onAdd={person => {
          setAuthorizedPersons(prev => [...prev, person]);
          setPersonModal(false);
        }}
      />
    </Card>
  );
};
