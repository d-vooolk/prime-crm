import { describe, it, expect } from 'vitest';
import { existingCarUpdate } from './recordCar.logic';

describe('existingCarUpdate', () => {
  it('записывает выбранное поколение машине, у которой его не было', () => {
    expect(existingCarUpdate({ generationId: '123', generation: 'V', generationName: 'V' })).toEqual({
      generationId: '123', generation: 'V', generationName: 'V',
    });
  });

  it('без выбранного поколения сохранённое не трогает', () => {
    expect(existingCarUpdate({ generationId: undefined })).toEqual({});
    expect(existingCarUpdate({ generationId: '' })).toEqual({});
  });

  it('пустые номер и пробег не затирают сохранённые', () => {
    expect(existingCarUpdate({ plateNumber: '', mileage: '' })).toEqual({});
    expect(existingCarUpdate({ plateNumber: '1234 AB-7' })).toEqual({ plateNumber: '1234 AB-7' });
  });

  it('при правке той же машины пустое поле очищает значение', () => {
    expect(existingCarUpdate({ plateNumber: '', mileage: '100' }, { clearEmpty: true }))
      .toEqual({ plateNumber: null, mileage: '100' });
  });
});
