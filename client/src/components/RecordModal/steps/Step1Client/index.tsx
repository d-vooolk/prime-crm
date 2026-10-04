import React, { useState } from 'react';
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
