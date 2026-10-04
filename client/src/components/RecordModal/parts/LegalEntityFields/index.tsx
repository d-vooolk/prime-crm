import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Input, Select, AutoComplete, Row, Col, Checkbox } from 'antd';
import MaskedInput from 'antd-mask-input';
import { recordsApi, CompanySuggestion } from '@/api/records.api';
import { CompanySettings } from '@/types';
import { useCompanySettings } from '@/hooks/useReferenceData';
import { useNotify } from '@/hooks/useNotify';
import { getErrorMessage } from '@/utils/errors';
import { RecordFormData } from '../../types';
import { SectionDivider } from '../SectionDivider';
import styles from './LegalEntityFields.module.scss';

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
}

const ADDRESS_PLACEHOLDER = '220000, г. Минск, ул. Примерная, д. 1';

/** Подписант с нашей стороны: директор или доверенное лицо из настроек компании */
function signatoryFields(key: string, settings: CompanySettings): Partial<RecordFormData> | null {
  if (key === 'director') {
    return {
      executorSignatoryName: settings.directorName || '',
      executorSignatoryNameGenitive: settings.directorNameGenitive || '',
      executorSignatoryPosition: settings.directorPosition || '',
      executorSignatoryPositionGenitive: settings.directorPositionGenitive || '',
      executorSignatoryBasis: settings.directorBasis || '',
    };
  }
  const idx = parseInt(key.replace('person_', ''), 10);
  const person = (settings.authorizedPersons || [])[idx];
  if (!person) return null;
  return {
    executorSignatoryName: person.nameNominative,
    executorSignatoryNameGenitive: person.nameGenitive,
    executorSignatoryPosition: person.positionNominative,
    executorSignatoryPositionGenitive: person.positionGenitive,
    executorSignatoryBasis: person.basis,
  };
}

function companyFields(company: CompanySuggestion): Partial<RecordFormData> {
  return {
    legalCompanyName: company.legalCompanyName,
    legalAddress: company.legalAddress || '',
    legalActualAddress: company.legalActualAddress || '',
    legalPostalAddress: company.legalPostalAddress || '',
    legalBankDetails: company.legalBankDetails || '',
    legalBic: company.legalBic || '',
    legalUnp: company.legalUnp || '',
    legalOkpo: company.legalOkpo || '',
    legalPhone: company.legalPhone || '',
    legalEmail: company.legalEmail || '',
    legalRepresentativePosition: company.legalRepresentativePosition || '',
    legalRepresentativePositionGenitive: company.legalRepresentativePositionGenitive || '',
    legalRepresentative: company.legalRepresentative || '',
    legalRepresentativeGenitive: company.legalRepresentativeGenitive || '',
    legalBasis: company.legalBasis || '',
    executorSignatoryName: company.executorSignatoryName || '',
    executorSignatoryNameGenitive: company.executorSignatoryNameGenitive || '',
    executorSignatoryPosition: company.executorSignatoryPosition || '',
    executorSignatoryPositionGenitive: company.executorSignatoryPositionGenitive || '',
    executorSignatoryBasis: company.executorSignatoryBasis || '',
  };
}

/** Реквизиты юр. лица, его представитель и наш подписант */
export const LegalEntityFields: React.FC<Props> = ({ data, onChange }) => {
  const notify = useNotify();
  const { data: companySettings } = useCompanySettings();
  const [actualSameAsLegal, setActualSameAsLegal] = useState(false);
  const [postalSameAsLegal, setPostalSameAsLegal] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState<CompanySuggestion[]>([]);
  const [signatoryKey, setSignatoryKey] = useState<string | undefined>(undefined);
  const searchSeq = useRef(0);

  const handleCompanySearch = useCallback(async (value: string) => {
    onChange({ legalCompanyName: value });
    const seq = ++searchSeq.current;
    if (value.length < 2) {
      setCompanySuggestions([]);
      return;
    }
    try {
      const results = await recordsApi.searchCompanies(value);
      if (seq === searchSeq.current) setCompanySuggestions(results);
    } catch (e) {
      if (seq !== searchSeq.current) return;
      setCompanySuggestions([]);
      notify.toast.error({ content: `Поиск организации не удался: ${getErrorMessage(e)}`, key: 'company-search' });
    }
  }, [onChange, notify]);

  const handleSelectCompany = (value: string) => {
    const company = companySuggestions.find(c => c.legalCompanyName === value);
    if (company) onChange(companyFields(company));
  };

  const applySignatory = useCallback((key: string, settings: CompanySettings) => {
    setSignatoryKey(key);
    const fields = signatoryFields(key, settings);
    if (fields) onChange(fields);
  }, [onChange]);

  // Узнаём выбранного подписанта по ФИО, сохранённому в записи
  useEffect(() => {
    if (!companySettings || signatoryKey !== undefined) return;
    if (data.executorSignatoryName) {
      if (data.executorSignatoryName === companySettings.directorName) {
        setSignatoryKey('director');
      } else {
        const idx = (companySettings.authorizedPersons || []).findIndex(
          p => p.nameNominative === data.executorSignatoryName
        );
        setSignatoryKey(idx >= 0 ? `person_${idx}` : 'director');
      }
    }
  }, [companySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Подписант не выбран — по умолчанию директор
  useEffect(() => {
    if (!data.isLegalEntity || !companySettings || data.executorSignatoryName) return;
    applySignatory('director', companySettings);
  }, [data.isLegalEntity, companySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const signatoryOptions = companySettings
    ? [
        { value: 'director', label: companySettings.directorName || 'Директор' },
        ...(companySettings.authorizedPersons || []).map((p, i) => ({
          value: `person_${i}`,
          label: p.nameNominative,
        })),
      ]
    : [];

  const field = (key: keyof RecordFormData) => ({
    value: (data[key] as string | undefined),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ [key]: e.target.value }),
  });

  return (
    <>
      <SectionDivider>Данные юридического лица</SectionDivider>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Название организации">
            <AutoComplete
              value={data.legalCompanyName}
              onSearch={handleCompanySearch}
              onSelect={handleSelectCompany}
              options={companySuggestions.map(c => ({
                value: c.legalCompanyName,
                label: (
                  <div>
                    <div className={styles.optionTitle}>{c.legalCompanyName}</div>
                    {c.legalUnp && <div className={styles.optionMeta}>УНП: {c.legalUnp}</div>}
                  </div>
                ),
              }))}
              className={styles.fullWidth}
            >
              <Input placeholder="ООО «Название»" />
            </AutoComplete>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Телефон организации">
            <MaskedInput
              mask="+375 (00) 000-00-00"
              value={data.legalPhone}
              onChange={e => onChange({ legalPhone: e.target.value })}
              inputMode="tel"
              placeholder="+375 (17) 000-00-00"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Юридический адрес">
        <Input {...field('legalAddress')} placeholder={ADDRESS_PLACEHOLDER} />
      </Form.Item>

      <Form.Item label="Фактический адрес">
        <div className={styles.addressBlock}>
          <Checkbox
            checked={actualSameAsLegal}
            onChange={e => {
              setActualSameAsLegal(e.target.checked);
              if (e.target.checked) onChange({ legalActualAddress: data.legalAddress });
            }}
          >
            Совпадает с юридическим
          </Checkbox>
          {!actualSameAsLegal && <Input {...field('legalActualAddress')} placeholder={ADDRESS_PLACEHOLDER} />}
        </div>
      </Form.Item>

      <Form.Item label="Почтовый адрес">
        <div className={styles.addressBlock}>
          <Checkbox
            checked={postalSameAsLegal}
            onChange={e => {
              setPostalSameAsLegal(e.target.checked);
              if (e.target.checked) onChange({ legalPostalAddress: data.legalAddress });
            }}
          >
            Совпадает с юридическим
          </Checkbox>
          {!postalSameAsLegal && <Input {...field('legalPostalAddress')} placeholder={ADDRESS_PLACEHOLDER} />}
        </div>
      </Form.Item>

      <Form.Item label="Реквизиты банка">
        <Input.TextArea
          {...field('legalBankDetails')}
          rows={3}
          placeholder="р/с 3012000000000&#10;в ОАО «Беларусбанк»"
          className={styles.preWrap}
        />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="БИК">
            <Input {...field('legalBic')} placeholder="BLBBBY2X" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="УНП">
            <Input {...field('legalUnp')} placeholder="000000000" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="ОКПО">
            <Input {...field('legalOkpo')} placeholder="00000000" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Email организации">
            <Input type="email" {...field('legalEmail')} placeholder="info@company.by" />
          </Form.Item>
        </Col>
      </Row>

      <SectionDivider>Представитель заказчика</SectionDivider>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="ФИО (именительный падеж)">
            <Input {...field('legalRepresentative')} placeholder="Иванов Иван Иванович" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="ФИО (в склонении)">
            <Input {...field('legalRepresentativeGenitive')} placeholder="Иванова Ивана Ивановича" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Должность (именительный)">
            <Input {...field('legalRepresentativePosition')} placeholder="Директор" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Должность (в склонении)">
            <Input {...field('legalRepresentativePositionGenitive')} placeholder="директора" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Основание">
            <Input {...field('legalBasis')} placeholder="устава" />
          </Form.Item>
        </Col>
      </Row>

      <SectionDivider>Подписант с нашей стороны</SectionDivider>

      <Form.Item label="Подписант (исполнитель)">
        <Select
          value={signatoryKey}
          onChange={key => companySettings && applySignatory(key, companySettings)}
          placeholder="Выберите подписанта"
          options={signatoryOptions}
        />
      </Form.Item>
    </>
  );
};
