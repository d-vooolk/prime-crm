import React, { useEffect, useState } from 'react';
import { clientsApi } from '@/api/clients.api';
import { Car, Client } from '@/types';
import { RecordFormData } from '../../types';
import { SectionDivider } from '../../parts/SectionDivider';
import { ClientFields } from '../../parts/ClientFields';
import { LegalEntityFields } from '../../parts/LegalEntityFields';
import { ClientCars } from '../../parts/ClientCars';
import { CarFields } from '../../parts/CarFields';
import { ScheduleFields } from '../../parts/ScheduleFields';

interface Props {
  data: RecordFormData;
  onChange: (data: Partial<RecordFormData>) => void;
}

/** Шаг 1: клиент, юр. лицо, автомобиль и время записи */
export const Step1Client: React.FC<Props> = ({ data, onChange }) => {
  const [selectedClientCars, setSelectedClientCars] = useState<Car[]>([]);

  const handleSelectClient = (client: Client) => {
    onChange({
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientNotes: client.notes,
    });
    setSelectedClientCars(client.cars || []);
  };

  // Окно открыли с готовым номером (заявка с сайта): клиент с таким номером уже есть —
  // выбираем его, чтобы были видны его машины и не завёлся дубль. Молча: это подсказка
  useEffect(() => {
    const digits = data.clientPhone.replace(/\D/g, '');
    if (data.clientId || digits.length < 12) return;
    let cancelled = false;
    clientsApi.searchByPhone(data.clientPhone)
      .then(found => {
        const match = found.find(c => c.phone.replace(/\D/g, '') === digits);
        if (match && !cancelled) handleSelectClient(match);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Модели и поколения подгрузит CarFields по выбранным id
  const handleSelectExistingCar = (car: Car) => {
    onChange({
      carId: car.id,
      carBrandId: car.brandId,
      carBrand: car.brand,
      carModelId: car.modelId,
      carModel: car.model,
      carGenerationId: car.generationId || '',
      carGenerationName: car.generationName || '',
      carYear: car.year,
      carPlateNumber: car.plateNumber || '',
      carMileage: car.mileage || '',
    });
  };

  const isCarSelected = (car: Car) =>
    data.carBrandId === car.brandId &&
    data.carModelId === car.modelId &&
    data.carYear === car.year;

  return (
    <div>
      <SectionDivider>Данные клиента</SectionDivider>
      <ClientFields data={data} onChange={onChange} onSelectClient={handleSelectClient} />

      {data.isLegalEntity && <LegalEntityFields data={data} onChange={onChange} />}

      {selectedClientCars.length > 0 && (
        <>
          <SectionDivider>Автомобили клиента</SectionDivider>
          <ClientCars cars={selectedClientCars} isSelected={isCarSelected} onSelect={handleSelectExistingCar} />
        </>
      )}

      <SectionDivider>Автомобиль</SectionDivider>
      <CarFields data={data} onChange={onChange} />

      <SectionDivider>Запись</SectionDivider>
      <ScheduleFields data={data} onChange={onChange} />
    </div>
  );
};
