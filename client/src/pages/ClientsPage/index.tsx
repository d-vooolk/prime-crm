import React, { useState, useEffect, useMemo } from 'react';
import { AutoComplete, Badge, Button, DatePicker, Input, Select, Table, Tag, Grid, List } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import {
  SearchOutlined, UserOutlined, PhoneOutlined, CarOutlined, FilterOutlined, CloseOutlined,
} from '@ant-design/icons';
import MaskedInput from 'antd-mask-input';
import { clientsApi, ClientsFilter } from '@/api/clients.api';
import { carsApi } from '@/api/cars.api';
import { recordsApi } from '@/api/records.api';
import { servicesApi } from '@/api/services.api';
import { Car, CarBrand, CarGeneration, CarModel, Category, Client, Record } from '@/types';
import { formatDate } from '@/utils/formatters';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import { ClientHistoryDrawer } from '@/components/ClientHistoryDrawer';
import styles from './ClientsPage.module.scss';

// Пауза после ввода, прежде чем идти на сервер
const DEBOUNCE_MS = 350;
// Подсказки по имени начинаем показывать с этой длины
const SUGGEST_MIN_LENGTH = 2;
// Меньше цифр телефона искать бессмысленно — совпадёт почти вся база
const PHONE_MIN_DIGITS = 2;

/** Значение, которое «догоняет» исходное после паузы во вводе. */
function useDebounced<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Цифры номера после кода страны. Маска всегда подставляет «+375»,
 * поэтому код отрезаем — иначе он совпадал бы с любым номером.
 */
function phoneDigits(masked: string): string {
  return masked.replace(/^\s*\+?375/, '').replace(/\D/g, '');
}

const carLabel = (car: Car) =>
  [car.brand, car.model, car.year].filter(Boolean).join(' ');

const yearsLabel = (from?: number | null, to?: number | null) =>
  from ? ` (${from}–${to ?? 'н.в.'})` : '';

const DAY_FORMAT = 'YYYY-MM-DD';

const PERIOD_PRESETS: Array<{ label: string; value: [Dayjs, Dayjs] }> = [
  { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Прошлый месяц', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { label: '3 месяца', value: [dayjs().subtract(3, 'month'), dayjs()] },
  { label: 'Полгода', value: [dayjs().subtract(6, 'month'), dayjs()] },
  { label: 'Этот год', value: [dayjs().startOf('year'), dayjs().endOf('year')] },
  { label: 'Год', value: [dayjs().subtract(1, 'year'), dayjs()] },
];

/** Машины из подошедших записей — без повторов, в порядке от свежей записи */
const matchedCars = (client: Client): Car[] => {
  const cars = new Map<string, Car>();
  for (const r of client.matchedRecords ?? []) {
    if (!cars.has(r.car.id)) cars.set(r.car.id, r.car);
  }
  return [...cars.values()];
};

export const ClientsPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  // Инкремент заставляет панель перечитать клиента после правки записи
  const [historyRefresh, setHistoryRefresh] = useState(0);

  // ─── Фильтры ─────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [brandId, setBrandId] = useState<string | undefined>();
  const [modelId, setModelId] = useState<string | undefined>();
  const [generationId, setGenerationId] = useState<string | undefined>();
  // Услуга и период: клиенты, которым делали услугу в эти даты
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [period, setPeriod] = useState<[Dayjs, Dayjs] | null>(null);
  const [serviceCategories, setServiceCategories] = useState<Category[]>([]);
  // На телефоне фильтр по авто спрятан, чтобы список не уезжал за экран
  const [carFiltersOpen, setCarFiltersOpen] = useState(false);

  const [suggestions, setSuggestions] = useState<Client[]>([]);

  // ─── Справочник авто ─────────────────────────────
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [generations, setGenerations] = useState<CarGeneration[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);

  const debouncedName = useDebounced(name.trim());
  const debouncedPlate = useDebounced(plate.trim());
  const debouncedPhone = useDebounced(phoneDigits(phone));

  useEffect(() => {
    servicesApi.getCategories().then(setServiceCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingBrands(true);
    carsApi.getBrands().then(setBrands).catch(() => {}).finally(() => setLoadingBrands(false));
  }, []);

  useEffect(() => {
    setModels([]);
    if (!brandId) return;
    let cancelled = false;
    setLoadingModels(true);
    carsApi.getModels(brandId)
      .then(ms => { if (!cancelled) setModels(ms); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingModels(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  useEffect(() => {
    setGenerations([]);
    if (!brandId || !modelId) return;
    let cancelled = false;
    setLoadingGenerations(true);
    carsApi.getGenerations(brandId, modelId)
      .then(gs => { if (!cancelled) setGenerations(gs); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingGenerations(false); });
    return () => { cancelled = true; };
  }, [brandId, modelId]);

  const filter = useMemo<ClientsFilter>(() => ({
    name: debouncedName || undefined,
    phone: debouncedPhone.length >= PHONE_MIN_DIGITS ? debouncedPhone : undefined,
    plate: debouncedPlate || undefined,
    brandId,
    modelId,
    generationId,
    serviceId,
    from: period?.[0].format(DAY_FORMAT),
    to: period?.[1].format(DAY_FORMAT),
  }), [debouncedName, debouncedPhone, debouncedPlate, brandId, modelId, generationId, serviceId, period]);

  // Список клиентов: предыдущий запрос отменяем, чтобы поздний ответ не перетёр свежий
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    clientsApi.getAll(filter, controller.signal)
      .then(setClients)
      .catch(() => { if (!controller.signal.aborted) setClients([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter]);

  // Подсказки по имени
  useEffect(() => {
    if (debouncedName.length < SUGGEST_MIN_LENGTH) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    clientsApi.suggest(debouncedName, controller.signal)
      .then(setSuggestions)
      .catch(() => { if (!controller.signal.aborted) setSuggestions([]); });
    return () => controller.abort();
  }, [debouncedName]);

  const handleBrandChange = (value?: string) => {
    setBrandId(value);
    setModelId(undefined);
    setGenerationId(undefined);
  };

  const handleModelChange = (value?: string) => {
    setModelId(value);
    setGenerationId(undefined);
  };

  const resetFilters = () => {
    setPhone('');
    setName('');
    setPlate('');
    handleBrandChange(undefined);
    setServiceId(undefined);
    setPeriod(null);
  };

  const recordFilterActive = !!serviceId || !!period;
  const carFiltersCount = [brandId, modelId, generationId, plate.trim(), serviceId, period].filter(Boolean).length;
  const hasFilters = carFiltersCount > 0 || !!name.trim() || phoneDigits(phone).length > 0;

  const serviceOptions = useMemo(() => serviceCategories
    .filter(c => c.services.length > 0)
    .map(c => ({
      label: c.name,
      title: c.name,
      options: c.services.map(svc => ({
        value: svc.id,
        label: svc.name,
      })),
    })), [serviceCategories]);

  const handleRecordClick = async (recordId: string) => {
    try {
      const record = await recordsApi.getById(recordId);
      setSelectedRecord(record);
      setRecordModalOpen(true);
    } catch {
      /* silent */
    }
  };

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

  const renderCarTag = (car: Car, className?: string) => (
    <Tag key={car.id} className={className}>
      {carLabel(car)}
      {car.plateNumber && <span className={styles.plate}>{car.plateNumber}</span>}
    </Tag>
  );

  /** Подошедшие под фильтр визиты: дата и машина, клик открывает запись */
  const renderMatchedRecords = (client: Client) => (
    <div className={styles.matched}>
      {(client.matchedRecords ?? []).map(r => (
        <button
          key={r.id}
          type="button"
          className={styles.matchedRecord}
          onClick={e => { e.stopPropagation(); handleRecordClick(r.id); }}
        >
          <span className={styles.matchedDate}>{formatDate(r.scheduledAt)}</span>
          {carLabel(r.car)}
          {r.car.plateNumber && <span className={styles.plate}>{r.car.plateNumber}</span>}
        </button>
      ))}
    </div>
  );

  const columns = [
    {
      title: 'ФИО',
      dataIndex: 'name',
      key: 'name',
      render: (clientName: string) => (
        <span className={styles.name}>
          <UserOutlined className={styles.nameIcon} />
          {clientName}
        </span>
      ),
    },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Автомобили',
      key: 'cars',
      render: (_: unknown, row: Client) => (
        <div className={styles.cars}>
          {(recordFilterActive ? matchedCars(row) : row.cars).map(car => renderCarTag(car))}
        </div>
      ),
    },
    ...(recordFilterActive ? [{
      title: serviceId ? 'Когда делали услугу' : 'Записи за период',
      key: 'matched',
      render: (_: unknown, row: Client) => renderMatchedRecords(row),
    }] : []),
    {
      title: 'Записей',
      key: 'visits',
      width: 100,
      render: (_: unknown, row: Client) => row._count?.records || 0,
    },
  ];

  const serviceFilters = (
    <>
      <Select
        showSearch
        allowClear
        placeholder="Услуга"
        value={serviceId}
        onChange={setServiceId}
        optionFilterProp="label"
        options={serviceOptions}
        popupMatchSelectWidth={isMobile ? true : 320}
        className={styles.field}
      />
      <DatePicker.RangePicker
        value={period}
        onChange={v => setPeriod(v && v[0] && v[1] ? [v[0], v[1]] : null)}
        format="DD.MM.YYYY"
        presets={PERIOD_PRESETS}
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
        value={brandId}
        onChange={handleBrandChange}
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
        value={modelId}
        onChange={handleModelChange}
        disabled={!brandId}
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
        value={generationId}
        onChange={setGenerationId}
        disabled={!modelId}
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
        value={plate}
        onChange={e => setPlate(e.target.value)}
        allowClear
        className={styles.field}
      />
    </>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Клиенты</h1>
        {!loading && hasFilters && (
          <span className={styles.found}>Найдено: {clients.length}</span>
        )}
      </div>

      <div className={styles.filters}>
        <div className={styles.filtersRow}>
          <AutoComplete
            value={name}
            options={nameOptions}
            // Выбор подсказки открывает клиента; текст в поле оставляем как был
            onSelect={(clientId: string) => setSelectedClientId(clientId)}
            // Ввод текста фильтрует таблицу; id выбранной подсказки сюда не пускаем
            onSearch={v => { if (!suggestions.some(c => c.id === v)) setName(v); }}
            filterOption={false}
            onClear={() => setName('')}
            allowClear
            popupMatchSelectWidth={isMobile ? true : 420}
            className={styles.field}
          >
            <Input prefix={<SearchOutlined />} placeholder="Имя клиента" />
          </AutoComplete>
          <MaskedInput
            mask="+375 (00) 000-00-00"
            value={phone}
            onChange={e => setPhone(e.maskedValue)}
            inputMode="tel"
            placeholder="+375 (29) 000-00-00"
            prefix={<PhoneOutlined />}
            allowClear
            className={styles.field}
          />
          {isMobile && (
            <Badge count={carFiltersCount} size="small" className={styles.toggleBadge}>
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
          {hasFilters && !isMobile && (
            <Button icon={<CloseOutlined />} onClick={resetFilters}>
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

        {isMobile && hasFilters && (
          <Button icon={<CloseOutlined />} onClick={resetFilters} block>
            Сбросить фильтры
          </Button>
        )}
      </div>

      {isMobile ? (
        <List
          dataSource={clients}
          loading={loading}
          locale={{ emptyText: 'Клиенты не найдены' }}
          pagination={clients.length > 20 ? { pageSize: 20, align: 'center', size: 'small' } : false}
          renderItem={(client: Client) => (
            <List.Item className={styles.mobileItem} onClick={() => setSelectedClientId(client.id)}>
              <div className={styles.mobileCard}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.mobileName}>
                    <UserOutlined className={styles.mobileNameIcon} />
                    {client.name}
                  </span>
                  <span className={styles.mobileVisits}>
                    {client._count?.records || 0} зап.
                  </span>
                </div>
                {/* Тап по номеру звонит, тап по остальной карточке открывает историю */}
                <a
                  href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}
                  className={styles.mobilePhone}
                  onClick={e => e.stopPropagation()}
                >
                  <PhoneOutlined />
                  {client.phone}
                </a>
                {recordFilterActive ? renderMatchedRecords(client) : client.cars.length > 0 && (
                  <div className={styles.mobileCars}>
                    {client.cars.map(car => renderCarTag(car, styles.mobileCarTag))}
                  </div>
                )}
              </div>
            </List.Item>
          )}
        />
      ) : (
        <Table
          dataSource={clients}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          locale={{ emptyText: 'Клиенты не найдены' }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          rowClassName={styles.row}
          onRow={(row) => ({
            onClick: () => setSelectedClientId(row.id),
          })}
        />
      )}

      <ClientHistoryDrawer
        clientId={selectedClientId}
        open={!!selectedClientId}
        onClose={() => setSelectedClientId(null)}
        onSelectRecord={handleRecordClick}
        refreshKey={historyRefresh}
      />

      <RecordDetailModal
        record={selectedRecord}
        open={recordModalOpen}
        onClose={() => { setRecordModalOpen(false); setSelectedRecord(null); }}
        onRefresh={() => setHistoryRefresh(n => n + 1)}
      />
    </div>
  );
};
