import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Select, DatePicker, TimePicker, AutoComplete, Row, Col, Divider } from 'antd';
import dayjs from 'dayjs';
import { clientsApi } from '@/api/clients.api';
import { servicesApi } from '@/api/services.api';
import { carsApi } from '@/api/cars.api';
import { Client, CarBrand, CarModel, CarGeneration, Serviceman } from '@/types';
import { RecordFormData } from '../types';

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
}

export const Step1Client: React.FC<Props> = ({ data, onChange }) => {
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [generations, setGenerations] = useState<CarGeneration[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);

  useEffect(() => {
    servicesApi.getServicemen().then(setServicemen).catch(() => {});
    carsApi.getBrands().then(setBrands).catch(() => {});
  }, []);

  // Поиск клиента по телефону
  const handlePhoneSearch = useCallback(async (phone: string) => {
    onChange({ clientPhone: phone });
    if (phone.length >= 3) {
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
    }
  };

  const handleBrandChange = async (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    onChange({ carBrandId: brandId, carBrand: brand?.name || '', carModelId: '', carModel: '', carGenerationId: '', carGenerationName: '' });
    setModels([]);
    setGenerations([]);
    if (brandId) {
      setLoadingModels(true);
      carsApi.getModels(brandId).then(setModels).finally(() => setLoadingModels(false));
    }
  };

  const handleModelChange = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    onChange({ carModelId: modelId, carModel: model?.name || '', carGenerationId: '', carGenerationName: '' });

    setGenerations([]);
    if (data.carBrandId && modelId) {
      setLoadingGenerations(true);
      carsApi.getGenerations(data.carBrandId, modelId).then(setGenerations).finally(() => setLoadingGenerations(false));
    }
  };

  const handleGenerationChange = (genId: string) => {
    const gen = generations.find(g => g.id === genId);
    onChange({ carGenerationId: genId, carGenerationName: gen?.name || '' });
  };

  const phoneOptions = clientSuggestions.map(c => ({
    value: c.id,
    label: (
      <div>
        <div style={{ fontWeight: 600 }}>{c.name}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {c.phone} · {c.cars.map(car => `${car.brand} ${car.model}`).join(', ')}
        </div>
      </div>
    ),
  }));

  return (
    <div>
      <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Данные клиента</Divider>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Телефон" required>
            <AutoComplete
              value={data.clientPhone}
              options={phoneOptions}
              onSearch={handlePhoneSearch}
              onSelect={handleSelectClient}
              placeholder="+375 (29) 000-00-00"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="ФИО клиента" required>
            <Input
              value={data.clientName}
              onChange={e => onChange({ clientName: e.target.value })}
              placeholder="Иванов Иван Иванович"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Примечание (только для вас)">
        <Input.TextArea
          value={data.clientNotes}
          onChange={e => onChange({ clientNotes: e.target.value })}
          rows={2}
          placeholder="Внутреннее примечание, не будет в документах"
        />
      </Form.Item>

      <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Автомобиль</Divider>

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
            <Input
              value={data.carYear}
              onChange={e => onChange({ carYear: e.target.value })}
              placeholder="2020"
              maxLength={4}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Запись</Divider>

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
              value={data.time ? dayjs(data.time, 'HH:mm') : null}
              onChange={t => onChange({ time: t?.format('HH:mm') || '' })}
              format="HH:mm"
              minuteStep={5}
              disabledTime={() => ({ disabledHours: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23] })}
              hideDisabledOptions
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Мастер-приёмщик" required>
            <Select
              value={data.serviceman || undefined}
              onChange={v => onChange({ serviceman: v })}
              placeholder="Выберите мастера"
              options={servicemen.map(s => ({ value: s.name, label: s.name }))}
            />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};
