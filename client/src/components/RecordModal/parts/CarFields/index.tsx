import React from 'react';
import { Form, Input, Select, Row, Col } from 'antd';
import { CarBrand } from '@/types';
import { useCarBrands } from '@/hooks/useReferenceData';
import { RecordFormData } from '../../types';
import { formatMileage, formatPlateNumber, generationYears } from '../../calc';
import { useCarCatalog } from './useCarCatalog';
import styles from './CarFields.module.scss';

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
}

const EMPTY_BRANDS: CarBrand[] = [];

const BrandLabel: React.FC<{ brand?: CarBrand; large?: boolean }> = ({ brand, large }) => (
  <span className={styles.brand}>
    {brand?.logo && (
      <img src={`https://${brand.logo}`} alt="" className={large ? styles.logoLarge : styles.logo} />
    )}
    {brand?.name}
  </span>
);

const generationLabel = (g: { name: string; year_from?: number | null; year_to?: number | null }) =>
  // годы могут отсутствовать у записей, заведённых руками
  (g.year_from ? `${g.name} (${g.year_from}–${g.year_to || '...'})` : g.name);

/** Марка, модель, поколение, год, номер и пробег */
export const CarFields: React.FC<Props> = ({ data, onChange }) => {
  const { data: brands = EMPTY_BRANDS } = useCarBrands();
  const { models, generations, loadingModels, loadingGenerations } = useCarCatalog(data.carBrandId, data.carModelId);

  const handleBrandChange = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    onChange({
      carBrandId: brandId, carBrand: brand?.name || '',
      carModelId: '', carModel: '',
      carGenerationId: '', carGenerationName: '',
      carYear: '',
    });
  };

  const handleModelChange = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    onChange({
      carModelId: modelId, carModel: model?.name || '',
      carGenerationId: '', carGenerationName: '',
      carYear: '',
    });
  };

  const handleGenerationChange = (genId: string) => {
    const gen = generations.find(g => g.id === genId);
    onChange({ carGenerationId: genId, carGenerationName: gen?.name || '', carYear: '' });
  };

  const yearOptions = generationYears(generations.find(g => g.id === data.carGenerationId));

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Марка" required>
            <Select
              showSearch
              value={data.carBrandId || undefined}
              onChange={handleBrandChange}
              placeholder="Выберите марку"
              optionFilterProp="label"
              labelRender={({ value }) => <BrandLabel brand={brands.find(b => b.id === value)} />}
            >
              {brands.map(b => (
                <Select.Option key={b.id} value={b.id} label={b.name}>
                  <BrandLabel brand={b} large />
                </Select.Option>
              ))}
            </Select>
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
              options={generations.map(g => ({ value: g.id, label: generationLabel(g) }))}
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
        <Col xs={24} sm={8}>
          <Form.Item label="Гос. номер">
            <Input
              value={data.carPlateNumber || ''}
              onChange={e => onChange({ carPlateNumber: formatPlateNumber(e.target.value) })}
              placeholder="1234 АА-7"
              maxLength={9}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Пробег (км)">
            <Input
              value={data.carMileage || ''}
              onChange={e => onChange({ carMileage: formatMileage(e.target.value) })}
              placeholder="150 000"
              suffix="км"
            />
          </Form.Item>
        </Col>
      </Row>

      {data.isLegalEntity && (
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label="VIN номер">
              <Input
                value={data.legalVin || ''}
                onChange={e => onChange({ legalVin: e.target.value.toUpperCase() })}
                placeholder="WAUZZZ4B7BN012345"
                className={styles.vin}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
    </>
  );
};
