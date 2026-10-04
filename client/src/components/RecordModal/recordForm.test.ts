import { describe, expect, it } from 'vitest';
import { emptyFormData, RecordFormData, SelectedService } from './types';
import { buildRecordPayload, missingClientFields, scheduledAtIso, servicemanAssignment } from './recordForm';

const item = (over: Partial<SelectedService> = {}): SelectedService => ({
  serviceId: 's1', serviceName: 'Услуга', categoryName: 'Кат', price: 100, quantity: 1, estimatedTime: 30, ...over,
});

const filled: RecordFormData = {
  ...emptyFormData,
  clientName: 'Иван',
  clientPhone: '+375 (29) 123-45-67',
  carBrandId: 'b', carBrand: 'BMW', carModelId: 'm', carModel: 'X5', carYear: '2020',
  date: new Date(2025, 4, 10).toISOString(),
  time: '14:30',
  serviceman: 'Вася',
};

describe('missingClientFields', () => {
  it('всё заполнено', () => {
    expect(missingClientFields(filled)).toEqual([]);
  });
  it('пустая форма — все обязательные поля по порядку', () => {
    expect(missingClientFields({ ...emptyFormData, time: '' })).toEqual([
      'ФИО клиента', 'номер телефона', 'марка автомобиля', 'модель автомобиля', 'год автомобиля', 'дата', 'время',
    ]);
  });
});

describe('servicemanAssignment', () => {
  it('не задано — поля не отправляются (сервер сохранит прежнее)', () => {
    expect(servicemanAssignment(item())).toEqual({});
  });
  it('разделение отправляется без одиночного исполнителя', () => {
    const split = [{ name: 'A', amount: 1 }, { name: 'B', amount: 2 }];
    expect(servicemanAssignment(item({ servicemanSplit: split, servicemanName: 'X' })))
      .toEqual({ servicemanName: null, servicemanSplit: split });
  });
  it('выбран исполнитель или назначение снято', () => {
    expect(servicemanAssignment(item({ servicemanName: 'Петя' }))).toEqual({ servicemanName: 'Петя', servicemanSplit: null });
    expect(servicemanAssignment(item({ servicemanName: null }))).toEqual({ servicemanName: null, servicemanSplit: null });
  });
});

describe('scheduledAtIso', () => {
  it('ставит время записи на выбранную дату (локальная зона)', () => {
    const iso = scheduledAtIso(new Date(2025, 4, 10).toISOString(), '09:05');
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2025, 4, 10, 9, 5]);
  });
});

describe('buildRecordPayload', () => {
  it('собирает авто, время и позиции с предоплатой по умолчанию', () => {
    const payload = buildRecordPayload({ ...filled, services: [item({ quantity: 2 })] }, 'client-1');
    expect(payload.clientId).toBe('client-1');
    expect(payload.car).toMatchObject({ brand: 'BMW', brandId: 'b', model: 'X5', modelId: 'm', year: '2020' });
    expect(payload.serviceman).toBe('Вася');
    expect(new Date(payload.scheduledAt).getHours()).toBe(14);
    expect(payload.items).toEqual([{
      serviceId: 's1', price: 100, quantity: 2, equipmentId: undefined,
      prepaidAmount: 0, prepaidByCard: false, prepaidCurrency: null, prepaidCurrencyAmount: null, prepaidRate: null,
    }]);
  });
});
