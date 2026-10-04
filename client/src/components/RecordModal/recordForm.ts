import dayjs from 'dayjs';
import type { Record as CrmRecord } from '@/types';
import type { CreateRecordDto } from '@/api/records.api';
import type { RecordFormData, SelectedService } from './types';
import { isPhoneValid } from './calc';

export function recordToFormData(record: CrmRecord): RecordFormData {
  return {
    clientId: record.clientId,
    clientName: record.client.name,
    clientPhone: record.client.phone,
    clientNotes: record.notes || '',
    carId: record.carId,
    carBrandId: record.car.brandId,
    carBrand: record.car.brand,
    carModelId: record.car.modelId,
    carModel: record.car.model,
    carGenerationId: record.car.generationId || '',
    carGenerationName: record.car.generationName || '',
    carYear: record.car.year,
    carPlateNumber: record.car.plateNumber || '',
    carMileage: record.car.mileage || '',
    date: dayjs(record.scheduledAt).startOf('day').toISOString(),
    time: dayjs(record.scheduledAt).format('HH:mm'),
    serviceman: record.serviceman || '',
    receptionist: record.receptionist || '',
    clientSource: record.clientSource ?? null,
    isLegalEntity: record.isLegalEntity || false,
    legalCompanyName: record.legalCompanyName || '',
    legalAddress: record.legalAddress || '',
    legalActualAddress: record.legalActualAddress || '',
    legalPostalAddress: record.legalPostalAddress || '',
    legalBankDetails: record.legalBankDetails || '',
    legalBic: record.legalBic || '',
    legalUnp: record.legalUnp || '',
    legalOkpo: record.legalOkpo || '',
    legalPhone: record.legalPhone || '',
    legalEmail: record.legalEmail || '',
    legalRepresentativePosition: record.legalRepresentativePosition || '',
    legalRepresentativePositionGenitive: record.legalRepresentativePositionGenitive || '',
    legalRepresentative: record.legalRepresentative || '',
    legalRepresentativeGenitive: record.legalRepresentativeGenitive || '',
    legalBasis: record.legalBasis || '',
    legalVin: record.legalVin || '',
    legalEndDate: record.legalEndDate || '',
    executorSignatoryName: record.executorSignatoryName || '',
    executorSignatoryNameGenitive: record.executorSignatoryNameGenitive || '',
    executorSignatoryPosition: record.executorSignatoryPosition || '',
    executorSignatoryPositionGenitive: record.executorSignatoryPositionGenitive || '',
    executorSignatoryBasis: record.executorSignatoryBasis || '',
    services: record.items.map(item => ({
      serviceId: item.serviceId,
      serviceName: item.service.name,
      categoryName: item.service.category?.name || '',
      price: item.price,
      quantity: item.quantity,
      estimatedTime: item.service.estimatedTime,
      hasEquipment: item.service.hasEquipment ?? false,
      equipmentId: item.equipmentId ?? undefined,
      prepaidAmount: item.prepaidAmount ?? 0,
      prepaidByCard: item.prepaidByCard ?? false,
      prepaidCurrency: item.prepaidCurrency ?? null,
      prepaidCurrencyAmount: item.prepaidCurrencyAmount ?? null,
      prepaidRate: item.prepaidRate ?? null,
      isProduct: item.service.isProduct ?? false,
      servicemanName: item.servicemanName ?? undefined,
      servicemanSplit: item.servicemanSplit?.length ? item.servicemanSplit : undefined,
    })),
  };
}

/** Каких обязательных полей шага «Клиент и авто» не хватает — подписи для предупреждения */
export function missingClientFields(data: RecordFormData): string[] {
  const missing: string[] = [];
  if (!data.clientName) missing.push('ФИО клиента');
  if (!isPhoneValid(data.clientPhone)) missing.push('номер телефона');
  if (!data.carBrandId) missing.push('марка автомобиля');
  if (!data.carModelId) missing.push('модель автомобиля');
  if (!data.carYear) missing.push('год автомобиля');
  if (!data.date) missing.push('дата');
  if (!data.time) missing.push('время');
  return missing;
}

/**
 * Назначения сотрудников отправляем только если они заданы: если оба поля
 * опустить, сервер сохранит то, что было у позиции раньше, а при закрытии
 * сделки подставится основной мастер записи (шаг 1).
 */
export function servicemanAssignment(s: SelectedService): Pick<CreateRecordDto['items'][number], 'servicemanName' | 'servicemanSplit'> {
  if (s.servicemanSplit?.length) {
    return { servicemanName: null, servicemanSplit: s.servicemanSplit };
  }
  if (s.servicemanName !== undefined || s.servicemanSplit !== undefined) {
    return { servicemanName: s.servicemanName ?? null, servicemanSplit: null };
  }
  return {};
}

/** Дата (ISO начала дня) + время «HH:mm» → ISO момента записи в локальной зоне */
export function scheduledAtIso(date: string, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduledAt = new Date(date);
  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt.toISOString();
}

export function buildRecordPayload(data: RecordFormData, clientId: string): CreateRecordDto {
  return {
    clientId,
    car: {
      brand: data.carBrand,
      brandId: data.carBrandId,
      model: data.carModel,
      modelId: data.carModelId,
      generation: data.carGenerationName,
      generationId: data.carGenerationId,
      generationName: data.carGenerationName,
      year: data.carYear,
      plateNumber: data.carPlateNumber,
      mileage: data.carMileage,
    },
    scheduledAt: scheduledAtIso(data.date, data.time),
    serviceman: data.serviceman,
    receptionist: data.receptionist,
    notes: data.clientNotes,
    clientSource: data.clientSource ?? null,
    isLegalEntity: data.isLegalEntity,
    legalCompanyName: data.legalCompanyName,
    legalAddress: data.legalAddress,
    legalActualAddress: data.legalActualAddress,
    legalPostalAddress: data.legalPostalAddress,
    legalBankDetails: data.legalBankDetails,
    legalBic: data.legalBic,
    legalUnp: data.legalUnp,
    legalOkpo: data.legalOkpo,
    legalPhone: data.legalPhone,
    legalEmail: data.legalEmail,
    legalRepresentativePosition: data.legalRepresentativePosition,
    legalRepresentativePositionGenitive: data.legalRepresentativePositionGenitive,
    legalRepresentative: data.legalRepresentative,
    legalRepresentativeGenitive: data.legalRepresentativeGenitive,
    legalBasis: data.legalBasis,
    legalVin: data.legalVin,
    legalEndDate: data.legalEndDate,
    executorSignatoryName: data.executorSignatoryName,
    executorSignatoryNameGenitive: data.executorSignatoryNameGenitive,
    executorSignatoryPosition: data.executorSignatoryPosition,
    executorSignatoryPositionGenitive: data.executorSignatoryPositionGenitive,
    executorSignatoryBasis: data.executorSignatoryBasis,
    items: data.services.map(s => ({
      serviceId: s.serviceId,
      price: s.price,
      quantity: s.quantity,
      equipmentId: s.equipmentId,
      prepaidAmount: s.prepaidAmount || 0,
      prepaidByCard: s.prepaidByCard || false,
      prepaidCurrency: s.prepaidCurrency ?? null,
      prepaidCurrencyAmount: s.prepaidCurrencyAmount ?? null,
      prepaidRate: s.prepaidRate ?? null,
      ...servicemanAssignment(s),
    })),
  };
}
