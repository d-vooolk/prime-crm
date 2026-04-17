import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Form, Input, Select, DatePicker, TimePicker, AutoComplete,
  Row, Col, Divider, Card, Checkbox,
} from 'antd';
import { CarOutlined } from '@ant-design/icons';
import MaskedInput from 'antd-mask-input';
import dayjs from 'dayjs';
import { clientsApi } from '@/api/clients.api';
import { servicesApi } from '@/api/services.api';
import { carsApi } from '@/api/cars.api';
import { Client, Car, CarBrand, CarModel, CarGeneration, Serviceman } from '@/types';
import { RecordFormData } from '../types';

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
}

export const Step1Client: React.FC<Props> = ({ data, onChange }) => {
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [selectedClientCars, setSelectedClientCars] = useState<Car[]>([]);
  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [generations, setGenerations] = useState<CarGeneration[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);
  const [legalActualSameAsLegal, setLegalActualSameAsLegal] = useState(false);
  const [legalPostalSameAsLegal, setLegalPostalSameAsLegal] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const timeClickCount = useRef(0);

  useEffect(() => {
    servicesApi.getServicemen().then(setServicemen).catch(() => {});
    carsApi.getBrands().then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    if (!data.receptionist) {
      const def = servicemen.find(s => s.isReceptionist && s.isDefault && !s.isDismissed);
      if (def) onChange({ receptionist: def.name });
    }
  }, [servicemen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhoneSearch = useCallback(async (phone: string) => {
    onChange({ clientPhone: phone });
    if (phone.replace(/\D/g, '').length >= 7) {
      const results = await clientsApi.searchByPhone(phone).catch(() => []);
      setClientSuggestions(results);
    } else {
      setClientSuggestions([]);
    }
  }, [onChange]);

  const handleSelectClient = (clientId: string) => {
    const client = clientSuggestions.find(c => c.id === clientId);
    if (client) {
      onChange({
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientNotes: client.notes,
      });
      setSelectedClientCars(client.cars || []);
    }
  };

  const handleSelectExistingCar = async (car: Car) => {
    onChange({
      carId: car.id,
      carBrandId: car.brandId,
      carBrand: car.brand,
      carModelId: car.modelId,
      carModel: car.model,
      carGenerationId: car.generationId || '',
      carGenerationName: car.generationName || '',
      carYear: car.year,
    });
    setModels([]);
    setGenerations([]);
    setLoadingModels(true);
    const ms = await carsApi.getModels(car.brandId).catch(() => []);
    setModels(ms);
    setLoadingModels(false);
    if (car.brandId && car.modelId) {
      setLoadingGenerations(true);
      const gs = await carsApi.getGenerations(car.brandId, car.modelId).catch(() => []);
      setGenerations(gs);
      setLoadingGenerations(false);
    }
  };

  const handleBrandChange = async (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    onChange({
      carBrandId: brandId, carBrand: brand?.name || '',
      carModelId: '', carModel: '',
      carGenerationId: '', carGenerationName: '',
      carYear: '',
    });
    setModels([]);
    setGenerations([]);
    if (brandId) {
      setLoadingModels(true);
      carsApi.getModels(brandId).then(setModels).finally(() => setLoadingModels(false));
    }
  };

  const handleModelChange = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    onChange({
      carModelId: modelId, carModel: model?.name || '',
      carGenerationId: '', carGenerationName: '',
      carYear: '',
    });
    setGenerations([]);
    if (data.carBrandId && modelId) {
      setLoadingGenerations(true);
      carsApi.getGenerations(data.carBrandId, modelId).then(setGenerations).finally(() => setLoadingGenerations(false));
    }
  };

  const handleGenerationChange = (genId: string) => {
    const gen = generations.find(g => g.id === genId);
    onChange({ carGenerationId: genId, carGenerationName: gen?.name || '', carYear: '' });
  };

  const selectedGeneration = generations.find(g => g.id === data.carGenerationId);
  const yearOptions = selectedGeneration
    ? Array.from(
        { length: (selectedGeneration.year_to || new Date().getFullYear()) - selectedGeneration.year_from + 1 },
        (_, i) => String((selectedGeneration.year_to || new Date().getFullYear()) - i)
      )
    : [];

  const employees = servicemen.filter(s => !s.isReceptionist && !s.isDismissed);
  const receptionists = servicemen.filter(s => s.isReceptionist && !s.isDismissed);

  const isCarSelected = (car: Car) =>
    data.carBrandId === car.brandId &&
    data.carModelId === car.modelId &&
    data.carYear === car.year;

  const phoneOptions = clientSuggestions.map(c => ({
    value: c.id,
    label: (
      <div>
        <div style={{ fontWeight: 600 }}>{c.name}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {c.phone} · {c.cars?.map(car => `${car.brand} ${car.model}`).join(', ')}
        </div>
      </div>
    ),
  }));

  return (
    <div>
      <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Данные клиента
      </Divider>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Телефон" required>
            <AutoComplete
              options={phoneOptions}
              onSelect={handleSelectClient}
              onSearch={handlePhoneSearch}
              style={{ width: '100%' }}
            >
              <MaskedInput
                mask="+375 (00) 000-00-00"
                value={data.clientPhone}
                placeholder="+375 (29) 000-00-00"
              />
            </AutoComplete>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label={data.isLegalEntity ? 'ФИО представителя' : 'ФИО клиента'} required>
            <Input
              value={data.clientName}
              onChange={e => onChange({ clientName: e.target.value })}
              placeholder="Иванов Иван Иванович"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Примечание (только для вас)">
            <Input.TextArea
              value={data.clientNotes}
              onChange={e => onChange({ clientNotes: e.target.value })}
              rows={2}
              placeholder="Внутреннее примечание, не будет в документах"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 30 }}>
          <Checkbox
            checked={!!data.isLegalEntity}
            onChange={e => onChange({ isLegalEntity: e.target.checked })}
          >
            Юридическое лицо
          </Checkbox>
        </Col>
      </Row>

      {data.isLegalEntity && (
        <>
          <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Данные юридического лица
          </Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Название организации">
                <Input
                  value={data.legalCompanyName}
                  onChange={e => onChange({ legalCompanyName: e.target.value })}
                  placeholder="ООО «Название»"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Телефон организации">
                <MaskedInput
                  mask="+375 (00) 000-00-00"
                  value={data.legalPhone}
                  onChange={e => onChange({ legalPhone: e.target.value })}
                  placeholder="+375 (17) 000-00-00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Юридический адрес">
            <Input
              value={data.legalAddress}
              onChange={e => onChange({ legalAddress: e.target.value })}
              placeholder="220000, г. Минск, ул. Примерная, д. 1"
            />
          </Form.Item>

          <Form.Item label="Фактический адрес">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Checkbox
                checked={legalActualSameAsLegal}
                onChange={e => {
                  setLegalActualSameAsLegal(e.target.checked);
                  if (e.target.checked) onChange({ legalActualAddress: data.legalAddress });
                }}
              >
                Совпадает с юридическим
              </Checkbox>
              {!legalActualSameAsLegal && (
                <Input
                  value={data.legalActualAddress}
                  onChange={e => onChange({ legalActualAddress: e.target.value })}
                  placeholder="220000, г. Минск, ул. Примерная, д. 1"
                />
              )}
            </div>
          </Form.Item>

          <Form.Item label="Почтовый адрес">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Checkbox
                checked={legalPostalSameAsLegal}
                onChange={e => {
                  setLegalPostalSameAsLegal(e.target.checked);
                  if (e.target.checked) onChange({ legalPostalAddress: data.legalAddress });
                }}
              >
                Совпадает с юридическим
              </Checkbox>
              {!legalPostalSameAsLegal && (
                <Input
                  value={data.legalPostalAddress}
                  onChange={e => onChange({ legalPostalAddress: e.target.value })}
                  placeholder="220000, г. Минск, ул. Примерная, д. 1"
                />
              )}
            </div>
          </Form.Item>

          <Form.Item label="Реквизиты банка">
            <Input.TextArea
              value={data.legalBankDetails}
              onChange={e => onChange({ legalBankDetails: e.target.value })}
              rows={3}
              placeholder="р/с 3012000000000&#10;в ОАО «Беларусбанк»"
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="БИК">
                <Input
                  value={data.legalBic}
                  onChange={e => onChange({ legalBic: e.target.value })}
                  placeholder="BLBBBY2X"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="УНП">
                <Input
                  value={data.legalUnp}
                  onChange={e => onChange({ legalUnp: e.target.value })}
                  placeholder="000000000"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="ОКПО">
                <Input
                  value={data.legalOkpo}
                  onChange={e => onChange({ legalOkpo: e.target.value })}
                  placeholder="00000000"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Email организации">
                <Input
                  type="email"
                  value={data.legalEmail}
                  onChange={e => onChange({ legalEmail: e.target.value })}
                  placeholder="info@company.by"
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {selectedClientCars.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Автомобили клиента
          </Divider>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {selectedClientCars.map(car => (
              <Card
                key={car.id}
                size="small"
                hoverable
                onClick={() => handleSelectExistingCar(car)}
                style={{
                  cursor: 'pointer',
                  border: isCarSelected(car)
                    ? '2px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                  borderRadius: 8,
                  minWidth: 140,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CarOutlined style={{ color: 'var(--color-accent)', fontSize: 18 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {car.brand} {car.model}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {car.year}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Автомобиль
      </Divider>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Марка" required>
            <Select
              showSearch
              value={data.carBrandId || undefined}
              onChange={handleBrandChange}
              placeholder="Выберите марку"
              optionFilterProp="label"
              options={brands.map(b => ({ value: b.id, label: b.name }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Модель" required>
            <Select
              showSearch
              value={data.carModelId || undefined}
              onChange={handleModelChange}
              placeholder="Выберите модель"
              disabled={!data.carBrandId}
              loading={loadingModels}
              optionFilterProp="label"
              options={models.map(m => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Поколение">
            <Select
              showSearch
              value={data.carGenerationId || undefined}
              onChange={handleGenerationChange}
              placeholder="Поколение"
              disabled={!data.carModelId}
              loading={loadingGenerations}
              allowClear
              optionFilterProp="label"
              options={generations.map(g => ({
                value: g.id,
                label: `${g.name} (${g.year_from}–${g.year_to || '...'})`,
              }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Год выпуска" required>
            <Select
              value={data.carYear || undefined}
              onChange={v => onChange({ carYear: v })}
              placeholder="Выберите год"
              disabled={!data.carGenerationId}
              options={yearOptions.map(y => ({ value: y, label: y }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Запись
      </Divider>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Дата" required>
            <DatePicker
              style={{ width: '100%' }}
              value={data.date ? dayjs(data.date) : null}
              onChange={d => onChange({ date: d?.toISOString() || '' })}
              format="DD.MM.YYYY"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Время" required>
            <TimePicker
              style={{ width: '100%' }}
              open={timePickerOpen}
              onOpenChange={(open) => {
                setTimePickerOpen(open);
                if (!open) timeClickCount.current = 0;
              }}
              value={data.time ? dayjs(data.time, 'HH:mm') : null}
              onChange={t => {
                onChange({ time: t?.format('HH:mm') || '' });
                timeClickCount.current += 1;
                if (timeClickCount.current >= 2) {
                  setTimePickerOpen(false);
                  timeClickCount.current = 0;
                }
              }}
              format="HH:mm"
              minuteStep={5}
              needConfirm={false}
              disabledTime={() => ({ disabledHours: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23] })}
              hideDisabledOptions
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Сотрудник">
            <Select
              value={data.serviceman || undefined}
              onChange={v => onChange({ serviceman: v ?? '' })}
              placeholder="Выберите сотрудника"
              allowClear
              options={employees.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Мастер приёмщик">
            <Select
              value={data.receptionist || undefined}
              onChange={v => onChange({ receptionist: v ?? '' })}
              placeholder="Выберите мастера"
              allowClear
              options={receptionists.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};
