import { describe, expect, it } from 'vitest';
import {
  CatalogMark, LegacyVisitInput, formatPhone, matchCar, mergeLegacyFiles, normalizePhone,
  importNotes, matchServices, overlapsCrmRecord, parseLegacyFile, parseRuDate, sameJob, splitPrice,
} from './legacyVisits.logic';

const catalog: CatalogMark[] = [
  {
    id: 'BMW', name: 'BMW', models: [
      { id: '3ER', name: '3 серии', generations: [{ id: 'f30', name: 'VI (F30/F31/F34)', yearFrom: 2011, yearTo: 2016 }] },
      { id: '5ER', name: '5 серии', generations: [
        { id: 'e60', name: 'V (E60/E61)', yearFrom: 2003, yearTo: 2007 },
        { id: 'g30', name: 'VII (G30/G31/G38)', yearFrom: 2016, yearTo: 2020 },
      ] },
      { id: '320', name: '320', generations: [] },
      { id: 'X5', name: 'X5', generations: [{ id: 'e70', name: 'II (E70)', yearFrom: 2006, yearTo: 2010 }] },
    ],
  },
  {
    id: 'MERCEDES', name: 'Mercedes-Benz', models: [
      { id: 'E_KLASSE', name: 'E-Класс', generations: [] },
      { id: 'S_KLASSE', name: 'S-Класс', generations: [] },
      { id: 'GLE_KLASSE', name: 'GLE', generations: [] },
      { id: 'C_KLASSE', name: 'C-Класс', generations: [{ id: 'w205', name: 'IV (W205)', yearFrom: 2014, yearTo: 2018 }] },
    ],
  },
  {
    id: 'AUDI', name: 'Audi', models: [
      { id: 'A6', name: 'A6', generations: [
        { id: 'c7r', name: 'IV (C7) Рестайлинг', yearFrom: 2014, yearTo: 2018 },
        { id: 'c7', name: 'IV (C7)', yearFrom: 2011, yearTo: 2014 },
      ] },
    ],
  },
  {
    id: 'VOLKSWAGEN', name: 'Volkswagen', models: [
      { id: 'PASSAT', name: 'Passat', generations: [{ id: 'b8', name: 'B8', yearFrom: 2014, yearTo: 2019 }] },
      { id: 'GOLF', name: 'Golf', generations: [{ id: 'g7', name: 'VII', yearFrom: 2012, yearTo: 2017 }] },
    ],
  },
  { id: 'VOLVO', name: 'Volvo', models: [{ id: 'XC90', name: 'XC90', generations: [] }] },
  { id: 'ROVER', name: 'Rover', models: [{ id: '75', name: '75', generations: [] }] },
  { id: 'LAND_ROVER', name: 'Land Rover', models: [{ id: 'RANGE_ROVER', name: 'Range Rover', generations: [] }] },
];

const file = (patch: Partial<LegacyVisitInput>): LegacyVisitInput => ({
  key: 'a.json', files: ['a.json'], name: 'Иванов Иван', phone: '375291234567', date: '2025-10-16', endDate: null,
  carText: 'Volvo XC90', year: '2006', plate: '', vin: '', mileage: '', jobReason: 'Замена стекла правой фары',
  serviceman: '', representative: '', initialPrice: 200, finalPrice: null, priceJustification: '', defects: '',
  warranty: '', equipment: '', requestNumber: '', legal: null, ...patch,
});

describe('телефоны', () => {
  it('приводит разные записи номера к международному виду', () => {
    expect(normalizePhone('+375292585500')).toBe('375292585500');
    expect(normalizePhone('80297654321')).toBe('375297654321');
    expect(normalizePhone('+375 44 77 09 20')).toBeNull();
    expect(normalizePhone('+375')).toBeNull();
    expect(normalizePhone('+375291111111+375292222222')).toBe('375291111111');
    expect(normalizePhone('8-017-399-43-28')).toBe('375173994328');
  });

  it('форматирует номер как в CRM', () => {
    expect(formatPhone('375292585500')).toBe('+375 (29) 258-55-00');
  });
});

describe('разбор файла', () => {
  it('берёт дату из имени файла, если нет начала работ', () => {
    const v = parseLegacyFile('Петров-BMW F30-16.10.2025.json', { name: 'Петров', phone: '+375291234567', jobReason: 'Полировка', firstPrice: '100' });
    expect(v?.date).toBe('2025-10-16');
    expect(v?.initialPrice).toBe(100);
  });

  it('понимает дату через подчёркивания', () => {
    expect(parseRuDate('Беляков_Renault_Megane_12_08_2025.json')).toBe('2025-08-12');
  });

  it('пропускает пустые заготовки', () => {
    expect(parseLegacyFile('111.json', { name: '', phone: '+375', jobReason: '', workEnd: '17.06.2025' })).toBeNull();
    expect(parseLegacyFile('x-01.12.2025.json', { name: 'Владимир', phone: '+375293669557', jobReason: '' })).toBeNull();
  });
});

describe('склейка повторов', () => {
  it('заявка и акт одного визита — один визит с данными акта и ценой заявки', () => {
    const merged = mergeLegacyFiles([
      file({ key: 'a-16.10.2025.json', date: '2025-10-16' }),
      file({ key: 'a-17.10.2025 (1).json', date: '2025-10-17', endDate: '2025-10-17', finalPrice: 250, defects: 'нет дренажей', warranty: '1 год' }),
      file({ key: 'a-17.10.2025.json', date: '2025-10-17', endDate: '2025-10-17', finalPrice: 250, warranty: '1 год' }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      date: '2025-10-16', endDate: '2025-10-17', initialPrice: 200, finalPrice: 250, defects: 'нет дренажей', warranty: '1 год',
    });
    expect(merged[0].files).toHaveLength(3);
  });

  it('другие работы или визит через месяц — отдельные визиты', () => {
    expect(mergeLegacyFiles([
      file({ key: '1', date: '2025-10-16' }),
      file({ key: '2', date: '2025-10-18', jobReason: 'Регулировка света фар' }),
      file({ key: '3', date: '2025-11-20' }),
    ])).toHaveLength(3);
  });

  it('похожие формулировки работ считаются одной работой', () => {
    expect(sameJob('Установка Bi-Led, шлифовка, полировка, оклейка', 'установка bi led шлифовка полировка')).toBe(true);
    expect(sameJob('Полировка фар', 'Ремонт ДХО')).toBe(false);
  });
});

describe('сопоставление авто', () => {
  const m = (text: string, year = '') => {
    const r = matchCar(text, year, catalog);
    return r && [r.brand, r.model, r.generationName].filter(Boolean).join(' / ');
  };

  it('BMW: кузов и цифровой индекс дают серию', () => {
    expect(m('BMW F30')).toBe('BMW / 3 серии / VI (F30/F31/F34)');
    expect(m('BMW 320 I')).toBe('BMW / 3 серии');
    expect(m('BMW g30')).toBe('BMW / 5 серии / VII (G30/G31/G38)');
    expect(m('BMW e60 520')).toBe('BMW / 5 серии / V (E60/E61)');
    expect(m('BMW X5 E70')).toBe('BMW / X5 / II (E70)');
  });

  it('Mercedes: класс по индексу и шасси, но Sprinter — не S-класс', () => {
    expect(m('Mercedes Benz E220')).toBe('Mercedes-Benz / E-Класс');
    expect(m('MB W 205', '2016')).toBe('Mercedes-Benz / C-Класс / IV (W205)');
    expect(m('Mercedes-Benz GLE 350')).toBe('Mercedes-Benz / GLE');
    expect(m('Mercedes-benz sprinter')).toBeNull();
  });

  it('поколение по коду кузова и году, по цифре поколения', () => {
    expect(m('Audi A6C7', '2013')).toBe('Audi / A6 / IV (C7)');
    expect(m('Audi A6 C7', '2016')).toBe('Audi / A6 / IV (C7) Рестайлинг');
    expect(m('VW Passat B8')).toBe('Volkswagen / Passat / B8');
    expect(m('VW Golf 7')).toBe('Volkswagen / Golf / VII');
  });

  it('опечатки и модель без марки', () => {
    expect(m('Volvo xc 90')).toBe('Volvo / XC90');
    expect(m('Passat B8')).toBe('Volkswagen / Passat / B8');
    expect(m('Range Rover')).toBe('Land Rover / Range Rover');
    expect(m('Квадроцикл')).toBeNull();
    expect(m('')).toBeNull();
  });
});

describe('пересечение с записями CRM', () => {
  it('запись в те же дни — визит уже в CRM', () => {
    expect(overlapsCrmRecord({ date: '2026-04-20', endDate: '2026-04-22' }, ['2026-04-23'])).toBe(true);
    expect(overlapsCrmRecord({ date: '2026-04-20', endDate: null }, ['2026-04-30'])).toBe(false);
  });
});

describe('услуги по тексту работ', () => {
  it('раскладывает типовую заявку на услуги справочника', () => {
    expect(matchServices('Установка билед модулей, полировка-шлифовка стекол, оклейка стекол бронепленкой'))
      .toEqual(['Установка Bi-Led модулей', 'Полировка фар', 'Оклейка фар']);
    expect(matchServices('Снятие и установка бампера. Регулировка фар.'))
      .toEqual(['Регулировка света фар', 'Снятие и установка бампера']);
    expect(matchServices('Тонировка задней полусферы 5%, уборка салона "Стандарт"'))
      .toEqual(['Тонировка задней полусферы', 'Уборка Стандарт']);
  });

  it('узкое правило вытесняет общее, без ложных срабатываний', () => {
    expect(matchServices('Полировка противотуманок')).toEqual(['Полировка противотуманок']);
    expect(matchServices('сушка блока ДХО')).not.toContain('Ремонт креплений');
    expect(matchServices('Замена светодиодных ламп')).toEqual(['Замена ламп']);
    expect(matchServices('Снятие передней тонировки')).toEqual(['Снятие старой тонировки']);
  });

  it('жалоба без названных работ — диагностика, пустой текст — без услуг', () => {
    expect(matchServices('Не горит правая фара')).toEqual(['Диагностика/консультация']);
    expect(matchServices('')).toEqual([]);
  });
});

describe('деление цены по услугам', () => {
  it('пропорционально стандартным ценам, сумма сходится до копейки', () => {
    const parts = splitPrice(1650, [1200, 150, 150]);
    expect(parts).toEqual([1320, 165, 165]);
    const odd = splitPrice(100, [50, 50, 50]);
    expect(odd.reduce((s, p) => s + p, 0)).toBeCloseTo(100, 2);
  });

  it('нулевые стандартные цены — поровну, одна услуга — вся сумма', () => {
    expect(splitPrice(300, [0, 0])).toEqual([150, 150]);
    expect(splitPrice(250, [0])).toEqual([250]);
    expect(splitPrice(0, [100, 50])).toEqual([0, 0]);
  });

  it('примечание хранит всё, чему нет поля в CRM', () => {
    const notes = importNotes(file({ finalPrice: 250, warranty: '1 год', serviceman: 'Петров П.П.' }), true);
    expect(notes).toContain('Перенесено из старой программы');
    expect(notes).toContain('Итоговая цена: 250 BYN');
    expect(notes).toContain('Гарантия: 1 год');
    expect(notes).toContain('Мастер: Петров П.П.');
  });
});
