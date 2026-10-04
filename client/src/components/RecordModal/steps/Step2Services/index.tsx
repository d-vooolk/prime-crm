import React, { useMemo, useState } from 'react';
import { Select, Empty, Grid } from 'antd';
import { Category, Equipment, Serviceman, ServicemanSplitEntry } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useAllServicemen, useEquipment, useServiceCategories } from '@/hooks/useReferenceData';
import { RecordFormData, SelectedService, ServiceRowContext } from '../../types';
import { PrepaidFields, addService, itemNetProfit, servicesTotals, sortCategoriesByUsage } from '../../calc';
import { ServicesTable } from '../../parts/ServicesTable';
import { ServicesMobileList } from '../../parts/ServicesMobileList';
import { SplitModal } from '../../parts/SplitModal';
import { PrepayModal } from '../../parts/PrepayModal';
import styles from './Step2Services.module.scss';

const { useBreakpoint } = Grid;

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
  prepaymentLocked?: boolean;
}

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_EQUIPMENT: Equipment[] = [];
const EMPTY_SERVICEMEN: Serviceman[] = [];

/** Шаг 2: выбор услуг, цены, исполнители и предоплата */
export const Step2Services: React.FC<Props> = ({ data, onChange, prepaymentLocked }) => {
  const isMobile = !useBreakpoint().md;
  const { data: categories = EMPTY_CATEGORIES } = useServiceCategories();
  const { data: equipment = EMPTY_EQUIPMENT } = useEquipment();
  const { data: allServicemen = EMPTY_SERVICEMEN } = useAllServicemen();

  const [prepayServiceId, setPrepayServiceId] = useState<string | null>(null);
  const [splitServiceId, setSplitServiceId] = useState<string | null>(null);

  const employeeOptions = useMemo(
    () => allServicemen.filter(e => e.isPerformer && !e.isDismissed).map(e => ({ value: e.name, label: e.name })),
    [allServicemen],
  );

  const serviceOptions = useMemo(() => sortCategoriesByUsage(categories).map(cat => ({
    label: cat.name,
    options: cat.services.map(s => ({ value: s.id, label: `${s.name} — ${formatPrice(s.standardPrice)}` })),
  })), [categories]);

  const handleServiceSelect = (serviceId: string) => {
    for (const cat of categories) {
      const service = cat.services.find(s => s.id === serviceId);
      if (service) {
        onChange({ services: addService(data.services, service, cat.name) });
        return;
      }
    }
  };

  const updateServices = (serviceId: string, patch: Partial<SelectedService>) => {
    onChange({ services: data.services.map(s => (s.serviceId === serviceId ? { ...s, ...patch } : s)) });
  };

  const ctx: ServiceRowContext = {
    update: updateServices,
    remove: serviceId => onChange({ services: data.services.filter(s => s.serviceId !== serviceId) }),
    openPrepay: row => setPrepayServiceId(row.serviceId),
    openSplit: row => setSplitServiceId(row.serviceId),
    // Снимаем разделение — позиция снова наследует основного мастера записи
    cancelSplit: serviceId => updateServices(serviceId, { servicemanSplit: null, servicemanName: null }),
    equipmentOptions: equipment.map(e => ({ value: e.id, label: e.name })),
    employeeOptions,
    defaultServiceman: data.serviceman,
    prepaymentLocked,
  };

  const saveSplit = (serviceId: string, entries: ServicemanSplitEntry[]) => {
    updateServices(serviceId, { servicemanSplit: entries, servicemanName: null });
    setSplitServiceId(null);
  };

  const savePrepayment = (serviceId: string, prepaid: PrepaidFields) => {
    updateServices(serviceId, prepaid);
    setPrepayServiceId(null);
  };

  const totals = servicesTotals(data.services);
  const splitService = splitServiceId ? data.services.find(s => s.serviceId === splitServiceId) ?? null : null;
  const prepayService = prepayServiceId ? data.services.find(s => s.serviceId === prepayServiceId) ?? null : null;

  return (
    <div>
      <div className={styles.picker}>
        <Select
          showSearch
          className={styles.fullWidth}
          value={undefined}
          onChange={handleServiceSelect}
          placeholder="Выберите услугу для добавления..."
          optionFilterProp="label"
          options={serviceOptions}
        />
      </div>

      {data.services.length === 0 ? (
        <Empty description="Услуги не выбраны" className={styles.empty} />
      ) : isMobile ? (
        <ServicesMobileList services={data.services} totals={totals} ctx={ctx} />
      ) : (
        <ServicesTable services={data.services} totals={totals} ctx={ctx} />
      )}

      <SplitModal
        item={splitService}
        netProfit={splitService ? itemNetProfit(splitService, equipment) : 0}
        defaultServiceman={data.serviceman}
        employeeOptions={employeeOptions}
        onSave={saveSplit}
        onCancel={() => setSplitServiceId(null)}
      />

      <PrepayModal
        item={prepayService}
        onSave={savePrepayment}
        onCancel={() => setPrepayServiceId(null)}
      />
    </div>
  );
};
