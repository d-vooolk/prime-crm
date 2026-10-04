import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Checkbox, Col, Divider, Form, Input, Row, Spin } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { servicesApi } from '@/api/services.api';
import { useNotify } from '@/hooks/useNotify';
import { useCompanySettings, useInvalidateReference } from '@/hooks/useReferenceData';
import { AuthorizedPerson, CompanySettings } from '@/types';
import { LoadError } from '@/components/Shared/LoadError';
import { AuthorizedPersonModal } from './AuthorizedPersonModal';
import styles from './CompanyTab.module.scss';

const ADDRESS_PLACEHOLDER = '220000, г. Минск, ул. Примерная, д. 1';

/** Реквизиты компании и подписанты — для печатных документов */
export const CompanyTab: React.FC = () => {
  const [form] = Form.useForm();
  const { data: settings, isLoading, isError, error, refetch } = useCompanySettings();
  const notify = useNotify();
  const invalidate = useInvalidateReference();
  const [saving, setSaving] = useState(false);
  const [actualSameAsLegal, setActualSameAsLegal] = useState(false);
  const [postalSameAsLegal, setPostalSameAsLegal] = useState(false);
  const [authorizedPersons, setAuthorizedPersons] = useState<AuthorizedPerson[]>([]);
  const [personModal, setPersonModal] = useState(false);

  // Форму заполняем один раз: повторная загрузка настроек (после сохранения) не должна затирать ввод
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!settings || initializedRef.current) return;
    initializedRef.current = true;
    const { authorizedPersons: ap, ...rest } = settings;
    form.setFieldsValue(rest);
    setAuthorizedPersons(ap || []);
  }, [settings, form]);

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

  return (
    <Card>
      <Spin spinning={isLoading}>
        <Form form={form} layout="vertical">
          <Form.Item label="Название компании" name="name" rules={[{ required: true }]}>
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

          <Divider orientation="left" className={styles.divider}>Подписанты</Divider>

          <div className={styles.subheading}>Директор</div>

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

          <div className={`${styles.subheading} ${styles.subheadingSpaced}`}>Доверенные лица</div>

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

          <br />
          <Button type="primary" loading={saving} onClick={handleSave}>Сохранить</Button>
        </Form>
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
