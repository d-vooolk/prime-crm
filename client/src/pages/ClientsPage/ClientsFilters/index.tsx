import React, { useEffect, useMemo, useState } from 'react';
import { AutoComplete, Badge, Button, DatePicker, Input, Select } from 'antd';
import {
  SearchOutlined, PhoneOutlined, CarOutlined, FilterOutlined, CloseOutlined,
} from '@ant-design/icons';
import MaskedInput from 'antd-mask-input';
import { clientsApi } from '@/api/clients.api';
import type { Client } from '@/types';
import { useCarBrands, useServiceCategories } from '@/hooks/useReferenceData';
import { getPeriodPresets, yearsLabel } from '../clientsHelpers';
import { useCarModelOptions } from '../useCarModelOptions';
import type { ClientsFilterState } from '../useClientsFilter';
import styles from './ClientsFilters.module.scss';

// Подсказки по имени начинаем показывать с этой длины
const SUGGEST_MIN_LENGTH = 2;

interface Props {
  f: ClientsFilterState;
  isMobile: boolean;
  /** Выбрана подсказка по имени — открыть клиента */
  onSelectClient: (clientId: string) => void;
}

export const ClientsFilters: React.FC<Props> = ({ f, isMobile, onSelectClient }) => {
  // На телефоне фильтр по авто спрятан, чтобы список не уезжал за экран
  const [carFiltersOpen, setCarFiltersOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Client[]>([]);

  const { data: brands = [], isLoading: loadingBrands } = useCarBrands();
  const { data: serviceCategories = [] } = useServiceCategories();
  const { models, generations, loadingModels, loadingGenerations } = useCarModelOptions(f.brandId, f.modelId);
  const periodPresets = useMemo(() => getPeriodPresets(), []);

  // Подсказки по имени
  useEffect(() => {
    if (f.debouncedName.length < SUGGEST_MIN_LENGTH) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    clientsApi.suggest(f.debouncedName, controller.signal)
      .then(setSuggestions)
      .catch(() => {
        // Намеренно молча: подсказки — удобство, таблица всё равно фильтруется по введённому имени
        if (!controller.signal.aborted) setSuggestions([]);
      });
    return () => controller.abort();
  }, [f.debouncedName]);

  const serviceOptions = useMemo(() => serviceCategories
    .filter(c => c.services.length > 0)
    .map(c => ({
      label: c.name,
      title: c.name,
      options: c.services.map(svc => ({ value: svc.id, label: svc.name })),
    })), [serviceCategories]);

  const nameOptions = suggestions.map(c => ({
    value: c.id,
    label: (
      <div className={styles.suggestion}>
        <div className={styles.suggestionTop}>
          <span className={styles.suggestionName}>{c.name}</span>
          <span className={styles.suggestionPhone}>{c.phone}</span>
        </div>
        {c.cars.length > 0 && (
          <div className={styles.suggestionCars}>
            {c.cars.map(car => (
              <span key={car.id} className={styles.suggestionCar}>
                <CarOutlined /> {car.brand} {car.model}
                {car.plateNumber && <span className={styles.plate}>{car.plateNumber}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    ),
  }));

  const serviceFilters = (
    <>
      <Select
        showSearch
        allowClear
        placeholder="Услуга"
        value={f.serviceId}
        onChange={f.setServiceId}
        optionFilterProp="label"
        options={serviceOptions}
        popupMatchSelectWidth={isMobile ? true : 320}
        className={styles.field}
      />
      <DatePicker.RangePicker
        value={f.period}
        onChange={v => f.setPeriod(v && v[0] && v[1] ? [v[0], v[1]] : null)}
        format="DD.MM.YYYY"
        presets={periodPresets}
        placeholder={['Период с', 'по']}
        inputReadOnly={isMobile}
        className={styles.field}
      />
    </>
  );

  const carFilters = (
    <>
      <Select
        showSearch
        allowClear
        placeholder="Марка"
        value={f.brandId}
        onChange={f.setBrandId}
        loading={loadingBrands}
        optionFilterProp="label"
        options={brands.map(b => ({ value: b.id, label: b.name }))}
        notFoundContent={loadingBrands ? 'Загрузка…' : 'Ничего не найдено'}
        className={styles.field}
      />
      <Select
        showSearch
        allowClear
        placeholder="Модель"
        value={f.modelId}
        onChange={f.setModelId}
        disabled={!f.brandId}
        loading={loadingModels}
        optionFilterProp="label"
        options={models.map(m => ({ value: m.id, label: m.name }))}
        notFoundContent={loadingModels ? 'Загрузка…' : 'Ничего не найдено'}
        className={styles.field}
      />
      <Select
        showSearch
        allowClear
        placeholder="Поколение"
        value={f.generationId}
        onChange={f.setGenerationId}
        disabled={!f.modelId}
        loading={loadingGenerations}
        optionFilterProp="label"
        options={generations.map(g => ({
          value: g.id,
          label: `${g.name}${yearsLabel(g.year_from, g.year_to)}`,
        }))}
        notFoundContent={loadingGenerations ? 'Загрузка…' : 'Ничего не найдено'}
        className={styles.field}
      />
      <Input
        prefix={<CarOutlined />}
        placeholder="Госномер"
        value={f.plate}
        onChange={e => f.setPlate(e.target.value)}
        allowClear
        className={styles.field}
      />
    </>
  );

  return (
    <div className={styles.filters}>
      <div className={styles.filtersRow}>
        <AutoComplete
          value={f.name}
          options={nameOptions}
          // Выбор подсказки открывает клиента; текст в поле оставляем как был
          onSelect={(clientId: string) => onSelectClient(clientId)}
          // Ввод текста фильтрует таблицу; id выбранной подсказки сюда не пускаем
          onSearch={v => { if (!suggestions.some(c => c.id === v)) f.setName(v); }}
          filterOption={false}
          onClear={() => f.setName('')}
          allowClear
          popupMatchSelectWidth={isMobile ? true : 420}
          className={styles.field}
        >
          <Input prefix={<SearchOutlined />} placeholder="Имя клиента" />
        </AutoComplete>
        <MaskedInput
          mask="+375 (00) 000-00-00"
          value={f.phone}
          onChange={e => f.setPhone(e.maskedValue)}
          inputMode="tel"
          placeholder="+375 (29) 000-00-00"
          prefix={<PhoneOutlined />}
          allowClear
          className={styles.field}
        />
        {isMobile && (
          <Badge count={f.carFiltersCount} size="small" className={styles.toggleBadge}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setCarFiltersOpen(v => !v)}
              type={carFiltersOpen ? 'primary' : 'default'}
              block
            >
              Авто и услуги
            </Button>
          </Badge>
        )}
        {!isMobile && carFilters}
        {!isMobile && serviceFilters}
        {f.hasFilters && !isMobile && (
          <Button icon={<CloseOutlined />} onClick={f.reset}>
            Сбросить
          </Button>
        )}
      </div>

      {isMobile && carFiltersOpen && (
        <div className={styles.filtersRow}>
          {carFilters}
          {serviceFilters}
        </div>
      )}

      {isMobile && f.hasFilters && (
        <Button icon={<CloseOutlined />} onClick={f.reset} block>
          Сбросить фильтры
        </Button>
      )}
    </div>
  );
};
