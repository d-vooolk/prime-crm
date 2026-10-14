/**
 * Архив визитов «до CRM»: заявки и акты из старой программы (JSON-файлы) и документы юрлиц.
 * Здесь только чистая логика — разбор файлов, склейка повторов одного визита, сопоставление
 * текстового названия авто со справочником. Подготовка выгрузки — scripts/legacy-visits-prepare.ts,
 * перенос в базу — bootstrap/legacyVisitsImport.ts.
 */

// ---------- Телефоны ----------

/**
 * Номер из старой программы → только цифры в международном виде, null — номера нет.
 * Встречаются «+375», «80291234567», «291234567», два номера подряд.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  let d = (raw ?? '').replace(/\D/g, '');
  if (/^80(25|29|33|44|17)\d{7}/.test(d)) d = `375${d.slice(2)}`;
  if (/^(25|29|33|44)\d{7}$/.test(d)) d = `375${d}`;
  const by = d.match(/^375(25|29|33|44|17)\d{7}/);
  if (by) return by[0];
  if (/^7\d{10}$/.test(d)) return d;
  return null;
}

/** Номер в виде, как его хранит CRM: «+375 (29) 123-45-67». */
export function formatPhone(digits: string): string {
  const m = digits.match(/^(375|7)(\d{2,3})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return `+${digits}`;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}-${m[5]}`;
}

/** Последние 9 цифр — так номер узнаётся при любой записи кода страны. */
export const phoneKey = (digits: string) => digits.replace(/\D/g, '').slice(-9);

// ---------- Даты ----------

/** «16.10.2025» → «2025-10-16», иначе null. */
export function parseRuDate(value: string | null | undefined): string | null {
  // В именах файлов встречается и «12_08_2025»
  const m = (value ?? '').match(/(\d{2})[._](\d{2})[._](\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

const DAY = 24 * 60 * 60 * 1000;
export const daysBetween = (a: string, b: string) =>
  Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / DAY);

// ---------- Файл старой программы ----------

/** Один JSON-файл старой программы, как он лежит в папке «Клиенты». */
export interface LegacyFileJson {
  requestNumber?: string;
  name?: string;
  phone?: string;
  carData?: { name?: string; number?: string; vin?: string; year?: string; km?: string };
  jobReason?: string;
  firstPrice?: string;
  dateRange?: Array<string | null>;
  serviceman?: string;
  customerRepresentative?: string;
  discoveredFlaws?: string;
  valueJustification?: string;
  fullPrice?: string;
  workEnd?: string;
  warranty?: string;
  module?: string;
}

/** Визит в выгрузке для сервера (и одновременно результат разбора одного файла). */
export interface LegacyVisitInput {
  /** Ключ визита (имя первого файла) — по нему импорт узнаёт уже перенесённое */
  key: string;
  files: string[];
  name: string;
  /** Только цифры, null — номера в файле нет */
  phone: string | null;
  date: string;
  endDate: string | null;
  carText: string;
  year: string;
  plate: string;
  vin: string;
  mileage: string;
  jobReason: string;
  serviceman: string;
  representative: string;
  initialPrice: number | null;
  finalPrice: number | null;
  priceJustification: string;
  defects: string;
  warranty: string;
  equipment: string;
  requestNumber: string;
  legal: LegacyLegalInfo | null;
}

export interface LegacyLegalInfo {
  companyName: string;
  unp: string;
  contractNumber: string;
  director: string;
  folder: string;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

export function parsePrice(v: unknown): number | null {
  const s = clean(v).replace(/\s/g, '').replace(',', '.');
  const m = s.match(/^\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Первый правдоподобный год выпуска из строки («2007  2004», «2018 »). */
export function parseYear(v: unknown): string {
  const m = clean(v).match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return m ? m[1] : '';
}

/**
 * Разбор одного файла. Дата визита — начало работ, иначе дата из имени файла,
 * иначе дата окончания. null — пустая заготовка (нет ни работ, ни цены, ни акта) или нет даты.
 */
export function parseLegacyFile(fileName: string, json: LegacyFileJson): LegacyVisitInput | null {
  const jobReason = clean(json.jobReason);
  const initialPrice = parsePrice(json.firstPrice);
  const finalPrice = parsePrice(json.fullPrice);
  const endDate = parseRuDate(json.workEnd);
  if (!jobReason && initialPrice == null && finalPrice == null && !endDate) return null;

  const date =
    parseRuDate(json.dateRange?.[0] ?? null) ?? parseRuDate(fileName) ?? endDate;
  if (!date) return null;

  const phone = normalizePhone(json.phone);
  if (!phone && !clean(json.name)) return null;

  const car = json.carData ?? {};
  return {
    key: fileName,
    files: [fileName],
    name: clean(json.name),
    phone,
    date,
    endDate,
    carText: clean(car.name),
    year: parseYear(car.year),
    plate: clean(car.number),
    vin: clean(car.vin).toUpperCase(),
    mileage: clean(car.km),
    jobReason,
    serviceman: clean(json.serviceman),
    representative: clean(json.customerRepresentative),
    initialPrice,
    finalPrice,
    priceJustification: clean(json.valueJustification),
    defects: clean(json.discoveredFlaws),
    warranty: clean(json.warranty),
    equipment: clean(json.module),
    requestNumber: clean(json.requestNumber),
    legal: null,
  };
}

// ---------- Склейка повторов ----------

const compact = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');

/** Нормализованное ФИО для сравнения. */
export const nameKey = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я]+/g, ' ').trim();

function wordsOf(s: string) {
  return new Set(s.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/).filter(w => w.length > 2));
}

/** Одинаковые ли работы: совпадают, одна пустая или большинство слов общие. */
export function sameJob(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (compact(a) === compact(b)) return true;
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.min(wa.size, wb.size) >= 0.6;
}

/** Насколько файл «законченный»: акт с датой окончания лучше заявки. */
const completeness = (v: LegacyVisitInput) =>
  (v.endDate ? 4 : 0) + (v.finalPrice != null ? 2 : 0) + (v.defects || v.warranty ? 1 : 0);

/** Кому принадлежит визит: телефон, а без него — ФИО. */
const ownerKey = (v: LegacyVisitInput) => (v.phone ? `t:${phoneKey(v.phone)}` : `n:${nameKey(v.name)}`);

/** Через сколько дней повторное сохранение считается тем же визитом. */
const SAME_VISIT_DAYS = 10;

/**
 * Старая программа сохраняла заявку и акт отдельными файлами, плюс копии «(1)», «(2)».
 * Файлы одного владельца и авто с теми же работами в пределах 10 дней — один визит:
 * основа — самый законченный файл, пустые поля добираются из остальных.
 */
export function mergeLegacyFiles(files: LegacyVisitInput[]): LegacyVisitInput[] {
  const groups = new Map<string, LegacyVisitInput[]>();
  for (const f of files) {
    const k = `${ownerKey(f)}|${compact(f.carText)}`;
    const list = groups.get(k) ?? [];
    list.push(f);
    groups.set(k, list);
  }

  const result: LegacyVisitInput[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
    const clusters: LegacyVisitInput[][] = [];
    for (const f of list) {
      const target = clusters.find(c => {
        const last = c[c.length - 1];
        const lastDay = last.endDate && last.endDate > last.date ? last.endDate : last.date;
        return daysBetween(f.date, lastDay) <= SAME_VISIT_DAYS && c.some(x => sameJob(x.jobReason, f.jobReason));
      });
      if (target) target.push(f);
      else clusters.push([f]);
    }
    for (const c of clusters) result.push(mergeCluster(c));
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

function mergeCluster(cluster: LegacyVisitInput[]): LegacyVisitInput {
  const best = [...cluster].sort(
    (a, b) => completeness(b) - completeness(a) || b.date.localeCompare(a.date),
  )[0];
  const merged: LegacyVisitInput = { ...best };
  const textFields = [
    'name', 'carText', 'year', 'plate', 'vin', 'mileage', 'jobReason', 'serviceman', 'representative',
    'priceJustification', 'defects', 'warranty', 'equipment', 'requestNumber',
  ] as const;
  for (const f of cluster) {
    for (const k of textFields) if (!merged[k] && f[k]) merged[k] = f[k];
    if (!merged.phone && f.phone) merged.phone = f.phone;
    if (merged.initialPrice == null && f.initialPrice != null) merged.initialPrice = f.initialPrice;
    if (merged.finalPrice == null && f.finalPrice != null) merged.finalPrice = f.finalPrice;
    if (!merged.endDate && f.endDate) merged.endDate = f.endDate;
  }
  // Первоначальная цена — из самой ранней заявки
  const first = cluster[0];
  if (first.initialPrice != null) merged.initialPrice = first.initialPrice;
  merged.date = cluster.reduce((d, f) => (f.date < d ? f.date : d), cluster[0].date);
  merged.files = cluster.map(f => f.key).sort();
  merged.key = merged.files[0];
  return merged;
}

// ---------- Сопоставление авто со справочником ----------

export interface CatalogGeneration { id: string; name: string; yearFrom?: number | null; yearTo?: number | null }
export interface CatalogModel { id: string; name: string; generations: CatalogGeneration[] }
export interface CatalogMark { id: string; name: string; models: CatalogModel[] }

export interface CarMatch {
  brandId: string;
  brand: string;
  modelId: string;
  model: string;
  generationId: string | null;
  generationName: string | null;
}

/** Как марку пишут в старых файлах → название марки в справочнике. */
const MARK_ALIASES: Record<string, string> = {
  vw: 'Volkswagen', wv: 'Volkswagen', volkswahen: 'Volkswagen', фольксваген: 'Volkswagen',
  mb: 'Mercedes-Benz', mercedes: 'Mercedes-Benz', мерседес: 'Mercedes-Benz',
  hyndai: 'Hyundai', hynday: 'Hyundai', skpda: 'Skoda', renenault: 'Renault', ranault: 'Renault',
  renaultntalisman: 'Renault', рено: 'Renault', мазда: 'Mazda', biuck: 'Buick', cherlet: 'Chevrolet',
  voivo: 'Volvo', fors: 'Ford', geep: 'Jeep', lada: 'Lada (ВАЗ)', li: 'Li Auto (Lixiang)',
  lixiang: 'Li Auto (Lixiang)', bmw: 'BMW', bentley: 'Bentley',
};

/** Модель, которую пишут без марки. */
const MODEL_ONLY: Record<string, string> = {
  rangerover: 'Land Rover',
  passat: 'Volkswagen',
  nexia: 'Daewoo',
  mustang: 'Ford',
};

/** Другие написания моделей (компактный вид → компактное имя в справочнике). */
const MODEL_ALIASES: Record<string, Record<string, string>> = {
  'Toyota': { lcprado: 'landcruiserprado', lc: 'landcruiserprado', rav4: 'rav4' },
  'Hyundai': { santafe: 'santafe', grandsantafe: 'santafe', elanntra: 'elantra' },
  'Skoda': { oktavia: 'octavia' },
  'Volkswagen': { toareg: 'touareg', туран: 'touran', t4: 'transporter', t5: 'transporter', t6: 'transporter' },
  'Renault': { симбол: 'symbol', grandscenic: 'scenic' },
  'Dodge': { grandcaravan: 'caravan' },
  'Jeep': { grandc: 'grandcherokee' },
  'Porsche': { boxter: 'boxster', cayenn: 'cayenne' },
  'Chevrolet': { maliby: 'malibu', cruz: 'cruze', klijcruze: 'cruze', trailblaser: 'trailblazer', trailbllazer: 'trailblazer', tb: 'trailblazer' },
  'Land Rover': { rangeroverevoqe: 'rangeroverevoque', discavery: 'discovery' },
  'Honda': { crv: 'crv', cr: 'crv' },
  'Geely': { okovango: 'okavango' },
};

/** Кузова BMW → модель («серия») справочника. */
const BMW_BODIES: Record<string, string> = {
  e36: '3', e46: '3', e90: '3', e91: '3', e92: '3', e93: '3', f30: '3', f31: '3', f34: '3', f35: '3', g20: '3', g21: '3',
  e34: '5', e39: '5', e60: '5', e61: '5', f10: '5', f11: '5', f07: '5', f18: '5', g30: '5', g31: '5', g38: '5', g60: '5', g61: '5',
  e38: '7', e65: '7', e66: '7', f01: '7', f02: '7', g11: '7', g12: '7', g70: '7',
  e87: '1', e81: '1', e82: '1', f20: '1', f21: '1', f40: '1',
  f22: '2', f23: '2', f44: '2', g42: '2',
  f32: '4', f33: '4', f36: '4', g22: '4', g23: '4', g26: '4',
  e63: '6', e64: '6', f06: '6', f12: '6', f13: '6', g32: '6',
  e53: 'x5', e70: 'x5', f15: 'x5', g05: 'x5', e83: 'x3', f25: 'x3', g01: 'x3', g45: 'x3',
  f26: 'x4', g02: 'x4', e71: 'x6', f16: 'x6', g06: 'x6', e84: 'x1', f48: 'x1', f39: 'x2', g07: 'x7',
};

/** Шасси Mercedes → класс. */
const MERCEDES_BODIES: Record<string, string> = {
  w210: 'e', w211: 'e', w212: 'e', w213: 'e', '213': 'e', w214: 'e',
  w202: 'c', w203: 'c', w204: 'c', w205: 'c', w206: 'c',
  w140: 's', w220: 's', w221: 's', w222: 's', w223: 's', w163: 'm', w164: 'm', w166: 'm',
};

const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];

const norm = (s: string) =>
  ` ${s.toLowerCase().replace(/ё/g, 'е').replace(/[-_.,/()+=]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

/** Ключ модели: без «Класс», «серии», «Series» и всего, кроме букв и цифр. */
const modelKey = (name: string) =>
  // \b в JS не видит границу кириллического слова — граница задаётся явно
  compact(name.replace(/\(.*?\)/g, '').replace(/[-\s]*(класс|серии|series)(?=$|[^a-zа-я])/gi, ''));

/** Коды кузова из названия поколения: «IV (C7) Рестайлинг» → ['c7'], «II (F20/F21)» → ['f20', 'f21']. */
const genCodes = (name: string) => [
  ...[...name.matchAll(/\(([^)]+)\)/g)].flatMap(m => m[1].split(/[/,]/)),
  // Код бывает и без скобок: «B8», «B8 Рестайлинг»
  ...name.split(/\s+/).filter(w => /^[a-z]{1,2}\d{1,3}$/i.test(w)),
].map(compact).filter(Boolean);

function findMark(text: string, catalog: CatalogMark[]): { mark: CatalogMark; rest: string } | null {
  const byName = new Map(catalog.map(m => [m.name, m]));
  const candidates: Array<{ key: string; mark: CatalogMark }> = [];
  for (const m of catalog) candidates.push({ key: norm(m.name).trim(), mark: m });
  for (const [alias, name] of Object.entries(MARK_ALIASES)) {
    const mark = byName.get(name);
    if (mark) candidates.push({ key: alias, mark });
  }
  candidates.sort((a, b) => b.key.length - a.key.length);
  // Сначала марка в начале строки, потом — где угодно («Honda Acura TSX», «Tremblay Chevrolet»)
  for (const atStart of [true, false]) {
    for (const c of candidates) {
      const needle = ` ${c.key} `;
      const idx = text.indexOf(needle);
      if (idx === 0 || (!atStart && idx > 0)) {
        return { mark: c.mark, rest: text.slice(idx + needle.length - 1) };
      }
    }
  }
  return null;
}

function pickGeneration(model: CatalogModel, restCompact: string, year: string): CatalogGeneration | null {
  const y = year ? Number(year) : null;
  const fits = (g: CatalogGeneration) =>
    y == null || ((g.yearFrom == null || g.yearFrom <= y) && (g.yearTo == null || y <= g.yearTo));
  const isRestyle = (g: CatalogGeneration) => /рестайлинг/i.test(g.name);

  // Код кузова (C7, B8, E60) или номер поколения цифрой (Golf 7, Mondeo 5)
  let byCode = model.generations.filter(g => genCodes(g.name).some(code => code.length >= 2 && restCompact.includes(code)));
  if (byCode.length === 0) {
    const digit = restCompact.match(/^(\d{1,2})$/)?.[1];
    const roman = digit ? ROMAN[Number(digit)] : '';
    if (roman) byCode = model.generations.filter(g => g.name.toLowerCase().split(' ')[0] === roman);
  }
  if (byCode.length > 0) {
    const fitting = byCode.filter(fits);
    const pool = fitting.length > 0 ? fitting : byCode;
    if (pool.length === 1) return pool[0];
    return pool.find(g => !isRestyle(g)) ?? pool[0];
  }
  if (y == null) return null;
  const byYear = model.generations.filter(g => g.yearFrom != null && fits(g));
  return byYear.length === 1 ? byYear[0] : null;
}

/** Текст из старой программы («Audi A6 C7», «BMW 530 D», «MB GLC300») → марка/модель/поколение справочника. */
export function matchCar(text: string, year: string, catalog: CatalogMark[]): CarMatch | null {
  const t = norm(text);
  if (t.trim() === '') return null;

  // Написали одну модель («Passat B8», «Range Rover») — вся строка и есть модель.
  // Проверяется до поиска марки: в «Range Rover» иначе нашлась бы марка Rover
  const modelOnly = Object.entries(MODEL_ONLY).find(([k]) => compact(t).startsWith(k));
  const modelOnlyMark = modelOnly && catalog.find(m => m.name === modelOnly[1]);
  const found = modelOnlyMark ? { mark: modelOnlyMark, rest: t } : findMark(t, catalog);
  if (!found) return null;
  const { mark } = found;
  let rest = compact(found.rest);

  if (mark.name === 'BMW') {
    const body = Object.keys(BMW_BODIES).find(code => new RegExp(`(^|[^a-z0-9])${code}([^0-9]|$)`).test(found.rest));
    const series = rest.match(/^m?(\d)\d\d/);
    if (!/^x\d/.test(rest) && !/^z\d/.test(rest) && !/^i\d/.test(rest)) {
      if (series) rest = series[1] + rest;
      else if (body) rest = BMW_BODIES[body] + rest;
    }
  }
  if (mark.name === 'Mercedes-Benz') {
    const body = Object.keys(MERCEDES_BODIES).find(code => rest.includes(code));
    // «W211» → E-класс; в «E300 213» класс уже назван
    if (body && (rest.startsWith(body) || !/^[a-z]{1,3}\d{3}/.test(rest))) rest = MERCEDES_BODIES[body] + rest;
  }

  const aliases = MODEL_ALIASES[mark.name] ?? {};
  for (const [from, to] of Object.entries(aliases).sort((a, b) => b[0].length - a[0].length)) {
    if (rest.startsWith(from)) {
      rest = to + rest.slice(from.length);
      break;
    }
  }

  let best: { model: CatalogModel; key: string } | null = null;
  for (const model of mark.models) {
    const key = modelKey(model.name);
    if (!key || !rest.startsWith(key)) continue;
    // Однобуквенный ключ годится только для классов Mercedes («E220», «S350», «ML»),
    // и то если дальше цифры: «Sprinter» — не S-класс
    if (key.length === 1 && !/^\d$/.test(key)) {
      if (mark.name !== 'Mercedes-Benz') continue;
      const next = rest.slice(1);
      if (next && !/^w?\d/.test(next) && !(key === 'm' && next.startsWith('l'))) continue;
    }
    if (!best || key.length > best.key.length) best = { model, key };
  }
  if (!best) return null;

  const gen = pickGeneration(best.model, rest.slice(best.key.length), year);
  return {
    brandId: mark.id,
    brand: mark.name,
    modelId: best.model.id,
    model: best.model.name,
    generationId: gen?.id ?? null,
    generationName: gen?.name ?? null,
  };
}

// ---------- Сопоставление работ с услугами справочника ----------

/**
 * Правило: если текст работ подходит под `re` (и не подходит под `unless`), в запись добавляется
 * услуга с таким названием. Порядок важен: узкие правила («полировка фонарей») стоят раньше общих
 * и через `group` вытесняют общее правило той же группы.
 */
interface ServiceRule { re: RegExp; service: string; group?: string; unless?: RegExp }

const PTF = /птф|противотум/;

const SERVICE_RULES: ServiceRule[] = [
  { re: /bi[\s-]?led|би[\s-]?лед|билед|двухчип|установк\S*\s+модул/, service: 'Установка Bi-Led модулей' },
  { re: /bi[\s-]?x?[ке]?s[ea]non|би[\s-]?ксенон/, service: 'Установка линзы' },
  { re: /замен\S*\s+(\S+\s+)?модул/, service: 'Замена модуля освещения' },
  { re: /тонир\S*\s+(задн\S*\s+)?полусфер|тонир\S*\s+задн\S*\s+(стек|полус)/, service: 'Тонировка задней полусферы', group: 'тонировка' },
  { re: /тонир\S*\s+передн/, service: 'Тонировка передних боковых стекол', group: 'тонировка', unless: /сн\S*\s+передн\S*\s+тонир/ },
  { re: /тонир\S*[^.;]*фонар/, service: 'Тонировка задних фонарей', group: 'тонировка' },
  { re: /тонир\S*[^.;]*(птф|противотум)/, service: 'Тонировка противотуманок (хамелеон)', group: 'тонировка' },
  { re: /тонир\S*[^.;]*фар|хамелеон/, service: 'Тонировка фар (хамелеон)', group: 'тонировка' },
  { re: /сн\S*\s+(стар\S*\s+|передн\S*\s+|задн\S*\s+)?тонир/, service: 'Снятие старой тонировки' },
  { re: /полиров\S*[^.;]*фонар/, service: 'Полировка задних фонарей', group: 'полировка' },
  { re: /полиров\S*[^.;]*(птф|противотум)/, service: 'Полировка противотуманок', group: 'полировка' },
  { re: /полиров\S*[^.;]*изнутри/, service: 'Полировка стекла изнутри', group: 'полировка' },
  { re: /полиров|шлиф/, service: 'Полировка фар', group: 'полировка' },
  { re: /(оклей|плёнк|пленк|бронь|броне)[^.;]*(птф|противотум)|(птф|противотум)[^.;]*(оклей|плёнк|пленк)/, service: 'Оклейка ПТФ' },
  { re: /(оклей|плёнк|пленк)[^.;]*фонар/, service: 'Оклейка фонаря', group: 'оклейка' },
  { re: /оклей|бронеплен|бронь|полиуретанов\S*\s+пл/, service: 'Оклейка фар', group: 'оклейка', unless: /тонир/ },
  { re: /регулир\S*[^.;]*(птф|противотум)|горизонт\S*\s+(птф|противотум)/, service: 'Регулировка противотуманок' },
  { re: /регулир|юстир\S*\s+свет/, service: 'Регулировка света фар', unless: /^[^.;]*(птф|противотум)[^.;]*$/ },
  { re: /бампер/, service: 'Снятие и установка бампера' },
  // «Снятие и установка фары», «с\у правой фары», «C/у фары»
  { re: /(сн\S*|[сc])[\s\-\\/]*(и\s*)?(у|уст\S*)\s+(\S+\s+)?фар|снятие[^.;]*фар|(^|[^а-я])[сc][\\/]у(?![а-я])/, service: 'Снятие фары', unless: /бампер/ },
  { re: /(сн\S*|[сc])[\s\-\\/]*(и\s*)?(у|уст\S*)\s+(\S+\s+)?фар|установк\S*\s+фар|(^|[^а-я])[сc][\\/]у(?![а-я])/, service: 'Установка фары', unless: /бампер/ },
  // «Расклейка-склейка», «переклейка стекла», «р\с фар» (разборка-сборка)
  { re: /расклей|переклей|вклей|разборк\S*[^.;]*фар|разбор\S*[\s\-\\/]*сбор|склейк|(^|[^а-я])р[\\/]с(?![а-я])/, service: 'Расклейка фары на бутиловом герметике' },
  { re: /замен\S*\s+(\S+\s+)?стек|новое стекло|новые стёкла|новые стекла/, service: 'Новое стекло' },
  { re: /(восстан|ремонт|пересвет|не\s?работ|неисправ|диагност\S*\s+)[^.;]*дхо|дхо[^.;]*(восстан|ремонт|не\s?работ)/, service: 'Восстановление ДХО', unless: /плат/ },
  { re: /плат\S*\s+дхо/, service: 'Замена платы ДХО' },
  { re: /кастом\S*\s+дхо/, service: 'Установка кастомного ДХО' },
  { re: /гибк\S*\s+дхо/, service: 'Установка гибкого дхо' },
  { re: /световод/, service: 'Восстановление световода' },
  { re: /суш/, service: 'Сушка фары и комплектующих' },
  { re: /дренаж/, service: 'Новые дренажи' },
  { re: /запотев|поте[ею]т|конденсат|переуплотн|гермети[зч]|опрес|влаг/, service: 'Устранение запотевания' },
  { re: /диагност|консульт/, service: 'Диагностика/консультация', unless: /дхо/ },
  { re: /ламп[^.;]*(птф|противотум)|(птф|противотум)[^.;]*ламп/, service: 'Замена ламп противотуманок' },
  { re: /установк\S*\s+ламп/, service: 'Установка ламп' },
  { re: /замен\S*\s+(\S+\s+)?ламп|ламп/, service: 'Замена ламп', unless: PTF },
  { re: /проводк|предохран/, service: 'Ремонт проводки' },
  { re: /электрон|блок\S*\s+управ|блок\S*\s+розжиг/, service: 'Ремонт электроники' },
  { re: /корректор/, service: 'Ремонт корректора' },
  // «ушки», «лапа» — но не «сушка»
  { re: /креплен|(^|[^а-я])ушк|лапк|(^|[^а-я])лап[аыу](?![а-я])/, service: 'Ремонт креплений' },
  { re: /адаптив/, service: 'Ремонт адаптива' },
  { re: /антихром[^.;]*(птф|противотум)/, service: 'Антихром противотуманок' },
  { re: /антихром/, service: 'Антихром фар', unless: /^[^.;]*антихром[^.;]*(птф|противотум)[^.;]*$/ },
  { re: /покрас\S*[^.;]*мас/, service: 'Покраска масок' },
  { re: /ангельск|глазк/, service: 'Установка ангельских глазок' },
  { re: /обманк/, service: 'Установка обманок' },
  { re: /кодирован/, service: 'Кодирование блока' },
  { re: /рамк/, service: 'Переходные рамки' },
  { re: /ремонт\S*[^.;]*фонар|фонар\S*[^.;]*ремонт/, service: 'Ремонт заднего фонаря' },
  { re: /установк\S*\s+(птф|противотум)/, service: 'Установка противотуманок' },
  { re: /замен\S*\s+(\S+\s+)?(птф|противотум)/, service: 'Новые ПТФ' },
  { re: /пайк|спайк|паян/, service: 'Пайка корпуса' },
  { re: /отражател/, service: 'Перепайка отражателей стекла' },
  { re: /светодиод/, service: 'Перепайка светодиода', unless: /светодиодн\S*\s+ламп/ },
  { re: /маркер/, service: 'Замена маркеров' },
  { re: /линз/, service: 'Установка линзы', unless: /bi[\s-]?led|би[\s-]?лед|билед/ },
  { re: /маск\S*\s+(с\s+)?дхо/, service: 'Маска ДХО' },
  { re: /пластик/, service: 'Ремонт пластика' },
  { re: /корпус/, service: 'Новый корпус', unless: /поиск\S*\s+корпус/ },
  { re: /донорск|начинк/, service: 'Замена содержимого фары' },
  { re: /поворот|омыват|цокол/, service: 'Электротехнические работы' },
  { re: /чистк\S*[^.;]*фар|чистк\S*\s+изнутри/, service: 'Чистка фары' },
  { re: /фишк/, service: 'Уплотнение фишки' },
  { re: /уборк\S*\s+прайм/, service: 'Уборка Прайм', group: 'уборка' },
  { re: /уборк\S*\s+премиум/, service: 'Уборка Премиум', group: 'уборка' },
  { re: /уборк|химчист/, service: 'Уборка Стандарт', group: 'уборка' },
  { re: /мойк/, service: 'Мойка стёкол передней полусферы' },
];

/** Если ничего не подошло: жалоба без названных работ («не горит фара») — это диагностика. */
const FALLBACK_RULES: ServiceRule[] = [
  { re: /не\s+гор|не\s+работ|неисправ|перебо|выключа|поиск|проверк|перестал/, service: 'Диагностика/консультация' },
  { re: /гаранти/, service: 'Гарантийные обязательства' },
  { re: /дхо/, service: 'Восстановление ДХО' },
  { re: /световол/, service: 'Восстановление световода' },
  { re: /замен\S*\s+(\S+\s+)?фар/, service: 'Новые фары' },
];

/** Работы из старой заявки («Снятие и установка бампера. Полировка фар.») → названия услуг справочника. */
export function matchServices(jobText: string): string[] {
  const text = jobText.toLowerCase().replace(/ё/g, 'е');
  const result: string[] = [];
  const groups = new Set<string>();
  const apply = (rules: ServiceRule[]) => {
    for (const rule of rules) {
      if (!rule.re.test(text) || rule.unless?.test(text)) continue;
      if (rule.group && groups.has(rule.group)) continue;
      if (rule.group) groups.add(rule.group);
      if (!result.includes(rule.service)) result.push(rule.service);
    }
  };
  apply(SERVICE_RULES);
  if (result.length === 0) apply(FALLBACK_RULES);
  return result;
}

/**
 * Сумма визита по услугам — пропорционально стандартным ценам (услуги с нулевой ценой — поровну
 * с остальными, если все нулевые). Копейки, оставшиеся от округления, — в самую дорогую позицию.
 */
export function splitPrice(total: number, standardPrices: number[]): number[] {
  if (standardPrices.length === 0) return [];
  const weights = standardPrices.some(p => p > 0) ? standardPrices.map(p => Math.max(p, 0)) : standardPrices.map(() => 1);
  const sum = weights.reduce((s, w) => s + w, 0);
  const parts = weights.map(w => Math.floor((total * w / sum) * 100) / 100);
  const rest = Math.round((total - parts.reduce((s, p) => s + p, 0)) * 100) / 100;
  const maxIdx = weights.indexOf(Math.max(...weights));
  parts[maxIdx] = Math.round((parts[maxIdx] + rest) * 100) / 100;
  return parts;
}

/** Примечание записи: всё из старой заявки, чему нет отдельного поля в CRM. */
export function importNotes(v: LegacyVisitInput, servicemanUnknown: boolean): string {
  const price = (n: number | null) => (n == null ? null : `${n} BYN`);
  const lines: Array<[string, string | null]> = [
    ['Работы по заявке', v.jobReason],
    ['Первоначальная цена', price(v.initialPrice)],
    ['Итоговая цена', price(v.finalPrice)],
    ['Обоснование цены', v.priceJustification],
    ['Гарантия', v.warranty],
    ['Оборудование', v.equipment],
    ['Мастер', servicemanUnknown ? v.serviceman : null],
    ['Представитель клиента', v.representative && v.representative !== v.name ? v.representative : null],
    ['Авто в заявке', v.carText],
    ['VIN', v.vin],
    ['Окончание работ', v.endDate ? v.endDate.split('-').reverse().join('.') : null],
    ['Юрлицо', v.legal ? [v.legal.companyName, v.legal.unp && `УНП ${v.legal.unp}`, v.legal.contractNumber && `договор № ${v.legal.contractNumber}`].filter(Boolean).join(', ') : null],
  ];
  return [
    'Перенесено из старой программы',
    ...lines.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
}

// ---------- Пересечение с записями CRM ----------

/** Визит уже заведён в CRM, если у клиента есть запись в те же дни (±3 дня от начала/конца работ). */
export function overlapsCrmRecord(visit: { date: string; endDate: string | null }, recordDays: string[]): boolean {
  const from = Date.parse(visit.date) - 3 * DAY;
  const to = Date.parse(visit.endDate && visit.endDate > visit.date ? visit.endDate : visit.date) + 3 * DAY;
  return recordDays.some(d => {
    const t = Date.parse(d);
    return t >= from && t <= to;
  });
}
