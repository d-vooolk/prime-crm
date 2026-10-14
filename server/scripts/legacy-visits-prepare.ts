/**
 * Подготовка архива визитов «до CRM» (разовая операция, запускается на своём компьютере):
 *
 *   npx ts-node scripts/legacy-visits-prepare.ts <папка «Клиенты»> <папка с текстами документов юрлиц> <папка для результата>
 *
 * Тексты документов юрлиц (.doc/.docx/.rtf → .txt) выгружаются заранее через Word: имя файла —
 * путь внутри папки «ЮР ЛИЦА» с «__» вместо разделителей. PDF не разбираются.
 *
 * На выходе: legacy-visits.json — выгрузка для сервера (кладётся в UPLOADS_DIR/.legacy-visits.json,
 * переносит bootstrap/legacyVisitsImport.ts) и report.txt — что склеено, что пропущено,
 * какие авто не нашлись в локальном снимке справочника.
 */
import fs from 'fs';
import path from 'path';
import {
  CatalogMark, LegacyFileJson, LegacyLegalInfo, LegacyVisitInput,
  daysBetween, matchCar, mergeLegacyFiles, nameKey, normalizePhone, parseLegacyFile, parsePrice, parseRuDate,
} from '../src/services/legacyVisits.logic';

const [clientsDir, legalDir, outDir] = process.argv.slice(2);
if (!clientsDir || !legalDir || !outDir) {
  console.error('Использование: legacy-visits-prepare.ts <Клиенты> <тексты юрлиц> <результат>');
  process.exit(1);
}

const report: string[] = [];
const section = (title: string) => report.push('', `=== ${title}`);

// ---------- Файлы клиентов ----------

const parsed: LegacyVisitInput[] = [];
section('Файлы без работ и цены или без даты — пропущены');
for (const file of fs.readdirSync(clientsDir).filter(f => f.endsWith('.json')).sort()) {
  const json = JSON.parse(fs.readFileSync(path.join(clientsDir, file), 'utf8').replace(/^﻿/, '')) as LegacyFileJson;
  const visit = parseLegacyFile(file, json);
  if (visit) parsed.push(visit);
  else report.push(file);
}
const visits = mergeLegacyFiles(parsed);

// ---------- Документы юрлиц ----------

/** Наш УНП и телефоны — в документах они есть всегда, к заказчику не относятся */
const OWN_UNP = new Set(['193897412', '291388531']);
const isOwnPhone = (digits: string) => /8206246$|6655449$/.test(digits);

interface LegalUnit {
  folder: string;
  docs: Record<string, string>;
}

/** Тексты по папкам: визит — папка, где есть акт; договор берётся из неё или из родительской. */
function readLegalUnits(): LegalUnit[] {
  const byFolder = new Map<string, Record<string, string>>();
  for (const f of fs.readdirSync(legalDir).filter(n => n.endsWith('.txt'))) {
    const parts = f.replace(/\.txt$/, '').split('__');
    const doc = parts.pop()!;
    const folder = parts.join('/');
    const text = fs.readFileSync(path.join(legalDir, f), 'utf8')
      .replace(/^﻿/, '').replace(/[\r\u0007\u000b]/g, '\n').replace(/[ \t]+/g, ' ');
    byFolder.set(folder, { ...byFolder.get(folder), [doc]: text });
  }
  const units: LegalUnit[] = [];
  for (const [folder, docs] of byFolder) {
    if (!Object.keys(docs).some(d => /^АВР/i.test(d))) continue;
    const parent = folder.includes('/') ? byFolder.get(folder.split('/')[0]) ?? {} : {};
    const inherited = Object.fromEntries(Object.entries(parent).filter(([d]) => /Договор/i.test(d)));
    units.push({ folder, docs: { ...inherited, ...docs } });
  }
  return units.sort((a, b) => a.folder.localeCompare(b.folder, 'ru', { numeric: true }));
}

const pick = (re: RegExp, s: string) => s.match(re)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';

/** «120925.9» → «2025-09-12» */
const dateFromNumber = (num: string) => {
  const m = num.match(/^(\d{2})(\d{2})(\d{2})\./);
  return m ? parseRuDate(`${m[1]}.${m[2]}.20${m[3]}`) : null;
};

interface LegalVisit {
  folder: string;
  legal: LegacyLegalInfo;
  date: string;
  endDate: string | null;
  price: number | null;
  /** Суммы акта и договора: в копиях шаблона они иногда расходятся */
  prices: number[];
  services: string;
  carText: string;
  year: string;
  plate: string;
  vin: string;
  phones: string[];
}

function parseLegalUnit(unit: LegalUnit): LegalVisit | null {
  const docOf = (re: RegExp) => Object.entries(unit.docs).filter(([d]) => re.test(d)).map(([, t]) => t).join('\n');
  const contract = docOf(/Договор/i);
  const act = docOf(/^АВР/i);
  const all = Object.values(unit.docs).join('\n');

  const contractNumber = pick(/ДОГОВОР\s*№\s*([\d.]+\d)/i, contract);
  const actNumber = pick(/Акт\s*№\s*([\d.]+\d)/i, act);
  const contractDate = parseRuDate(pick(/от\s+(\d\d\.\d\d\.\d{4})/, contract));
  const range = contract.match(/с\s+(\d\d\.\d\d\.\d{4})\s*(?:г\.?)?\s*(?:до|по)\s*(\d\d\.\d\d\.\d{4})/);
  const date = parseRuDate(range?.[1]) ?? dateFromNumber(actNumber) ?? contractDate ?? dateFromNumber(contractNumber);
  if (!date) return null;

  const services = pick(/следующие услуги:?\s*([\s\S]{0,600}?)(?:именуем|1\.3)/i, contract).replace(/[,;]\s*$/, '')
    || [...act.matchAll(/^\s*\d+\s*\n\s*([^\n]{5,200}?)\s*\n\s*\d+\s*$/gm)].map(m => m[1].trim()).join('; ');
  // Авто — из текста услуг, иначе из имени подпапки («15 BMW G30», «Toyota Land Cruiser 1»)
  const carText = pick(/автомобил[ьеия]\s+([A-Za-z][A-Za-z0-9\- ]{1,40}?)(?:\s+\d{4}\s*г?|,|\s*\(|\s+VIN|$)/im, services)
    || unit.folder.split('/').slice(1).join(' ').replace(/^\d+\s*/, '').replace(/\s+\d$/, '');
  const unp = [...all.matchAll(/УНП:?\s*(\d{9})/g)].map(m => m[1]).find(u => !OWN_UNP.has(u)) ?? '';
  const phones = [...new Set(
    [...all.matchAll(/(?:Тел[^:\d\n]{0,10}:?|Телефон:?)\s*([+\d][\d\s()\-]{6,20})/g)]
      .map(m => normalizePhone(m[1]))
      .filter((p): p is string => !!p && !isOwnPhone(p)),
  )];

  const actPrice = parsePrice(pick(/на сумму\s*([\d\s,.]+)/, act));
  const contractPrice = parsePrice(pick(/составляет:?\s*([\d\s,.]+)/, contract));
  return {
    folder: unit.folder,
    legal: {
      companyName: unit.folder.split('/')[0].replace(/^\d+\s+/, '').trim(),
      unp,
      contractNumber: contractNumber || actNumber,
      director: pick(/в лице\s+([^,]{0,120}?)\s+(?:действующ\w*\s+)?на основании/, contract),
      folder: unit.folder,
    },
    date,
    endDate: parseRuDate(range?.[2]),
    price: actPrice ?? contractPrice,
    prices: [actPrice, contractPrice].filter((p): p is number => p != null),
    services,
    carText,
    year: pick(/автомобил\S*\s+[^,]*?\b((?:19|20)\d\d)\s*г/i, services),
    plate: pick(/(\d{4}\s?[A-ZА-Я]{2}-\d)/, all),
    vin: pick(/\b([A-HJ-NPR-Z0-9]{17})\b/, services || all),
    phones,
  };
}

const legalVisits = readLegalUnits().map(parseLegalUnit);
section('Документы юрлиц без даты — пропущены');
const seenContracts = new Set<string>();
const legalList: LegalVisit[] = [];
for (const lv of legalVisits) {
  if (!lv) continue;
  // Одни и те же документы лежат в двух папках («3 ИП Лойко» и «34 ИП Лойко»)
  const dup = `${lv.legal.contractNumber}|${lv.date}|${lv.price}`;
  if (lv.legal.contractNumber && seenContracts.has(dup)) {
    report.push(`повтор документов: ${lv.folder}`);
    continue;
  }
  seenContracts.add(dup);
  legalList.push(lv);
}

// ---------- Локальный снимок справочника: сопоставление пар и предпросмотр ----------

const snapshot = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'prisma', 'data', 'cars-catalog.json'), 'utf8'),
) as { marks: Array<{ id: string; name: string; models: CatalogMark['models'] }> };
const catalog: CatalogMark[] = snapshot.marks.map(m => ({
  id: m.id,
  name: m.name,
  models: m.models.map(mo => ({ id: mo.id, name: mo.name, generations: mo.generations ?? [] })),
}));

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-zа-я0-9]+/).filter(w => w.length > 2));
const overlap = (a: string, b: string) => {
  const wb = words(b);
  return [...words(a)].some(w => wb.has(w));
};

/** Одна и та же модель: по справочнику, а если не нашлась — по общим словам названия. */
function sameCarModel(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ma = matchCar(a, '', catalog);
  const mb = matchCar(b, '', catalog);
  if (ma && mb) {
    // Разные поколения (BMW G30 и E60) — разные машины
    if (ma.generationId && mb.generationId && ma.generationId !== mb.generationId) return false;
    return ma.modelId === mb.modelId && ma.brandId === mb.brandId;
  }
  // Одна нашлась, другая нет — общие слова тут обманчивы («Grand», «Mercedes»)
  if (ma || mb) return false;
  return overlap(a, b);
}

/** Похожие работы: хотя бы два общих слова по основе («оклейка», «полировку» → «окле», «поли»). */
function similarJob(a: string, b: string): boolean {
  const stems = (s: string) => new Set(
    s.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я]+/).filter(w => w.length >= 5).map(w => w.slice(0, 5)),
  );
  const sb = stems(b);
  return [...stems(a)].filter(w => sb.has(w)).length >= 2;
}

/** Для документа юрлица — файл того же визита из папки «Клиенты» (контактное лицо). */
function pairWithVisit(lv: LegalVisit, used: Set<LegacyVisitInput>): LegacyVisitInput | null {
  let best: { v: LegacyVisitInput; score: number } | null = null;
  for (const v of visits) {
    if (used.has(v)) continue;
    const dist = Math.min(daysBetween(v.date, lv.date), v.endDate ? daysBetween(v.endDate, lv.date) : 99);
    if (dist > 7) continue;
    const samePrice = lv.prices.some(p => v.finalPrice === p || v.initialPrice === p);
    const sameCar = sameCarModel(v.carText, lv.carText);
    // Обе машины названы, и это разные модели — точно не тот визит
    if (v.carText && lv.carText && !sameCar && !(lv.vin && v.vin === lv.vin)) continue;
    const sameVin = !!lv.vin && v.vin === lv.vin;
    // Файл назван по фирме или по её директору («Кунцевич Сергей Викторович» — директор «МСА Аренда»)
    const sameName = overlap(v.name, lv.legal.companyName.replace(/ООО|ОАО|ОДО|ЧУП|ИЧП|ИП/g, ''))
      || (!!lv.legal.director && !/Волк/.test(lv.legal.director) && overlap(v.name.replace(/[её]/gi, 'е'), lv.legal.director.replace(/[её]/gi, 'е').replace(/директора?|заместител\S*/gi, '')));
    const sameJob = similarJob(v.jobReason, lv.services);
    const score = (samePrice ? 3 : 0) + (sameCar ? 2 : 0) + (sameVin ? 5 : 0) + (sameName ? 3 : 0) + (sameJob ? 2 : 0) - dist * 0.3;
    // Одной модели и даты мало: та же машина бывает у разных людей в одну неделю
    const enough = sameVin
      || (sameName && (sameCar || samePrice || dist <= 1))
      || (samePrice && (sameCar || sameJob))
      || (sameCar && sameJob && dist <= 3);
    if (enough) {
      if (!best || score > best.score) best = { v, score };
    }
  }
  return best?.v ?? null;
}

section('Юрлица: привязаны к файлу контактного лица');
const used = new Set<LegacyVisitInput>();
const standalone: LegacyVisitInput[] = [];
for (const lv of legalList) {
  const v = pairWithVisit(lv, used);
  if (v) {
    used.add(v);
    v.legal = lv.legal;
    if (!v.vin && lv.vin) v.vin = lv.vin;
    if (!v.plate && lv.plate) v.plate = lv.plate;
    report.push(`${lv.folder} → ${v.key}`);
    continue;
  }
  standalone.push({
    key: `ЮР ЛИЦА/${lv.folder}`,
    files: [`ЮР ЛИЦА/${lv.folder}`],
    name: lv.legal.companyName,
    phone: lv.phones[0] ?? null,
    date: lv.date,
    endDate: lv.endDate,
    carText: lv.carText,
    year: lv.year,
    plate: lv.plate,
    vin: lv.vin,
    mileage: '',
    jobReason: lv.services,
    serviceman: '',
    representative: '',
    initialPrice: null,
    finalPrice: lv.price,
    priceJustification: '',
    defects: '',
    warranty: '',
    equipment: '',
    requestNumber: '',
    legal: lv.legal,
  });
}
section('Юрлица без файла контактного лица — отдельный визит (телефон из документов, иначе поиск в CRM по УНП)');
for (const s of standalone) report.push(`${s.key} | тел. ${s.phone ?? '—'} | УНП ${s.legal?.unp || '—'} | ${s.carText} | ${s.finalPrice}`);

const all = [...visits, ...standalone].sort((a, b) => a.date.localeCompare(b.date));

section('Авто не найдены в снимке справочника (на сервере есть ещё ручные записи; не нашлось — визит без привязки к авто)');
const unmatched = new Map<string, number>();
let matched = 0;
for (const v of all) {
  if (matchCar(v.carText, v.year, catalog)) matched++;
  else unmatched.set(v.carText || '(пусто)', (unmatched.get(v.carText || '(пусто)') ?? 0) + 1);
}
for (const [car, n] of [...unmatched].sort((a, b) => b[1] - a[1])) report.push(`${car} — ${n}`);

section('Без телефона (на сервере ищутся среди клиентов CRM по ФИО/УНП, иначе пропуск)');
for (const v of all.filter(x => !x.phone)) report.push(`${v.key} | ${v.name || '—'} | ${v.carText}`);

const owners = new Set(all.map(v => (v.phone ? v.phone.slice(-9) : `n:${nameKey(v.name)}`)));
report.unshift(
  `Файлов клиентов: ${parsed.length} разобрано из ${fs.readdirSync(clientsDir).filter(f => f.endsWith('.json')).length}`,
  `После склейки повторов: ${visits.length} визитов`,
  `Документов юрлиц: ${legalList.length} (привязано к файлам: ${legalList.length - standalone.length}, отдельно: ${standalone.length})`,
  `Всего визитов в выгрузке: ${all.length}, владельцев: ${owners.size}`,
  `Авто найдено в снимке справочника: ${matched} из ${all.length}`,
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'legacy-visits.json'), JSON.stringify(all, null, 1));
fs.writeFileSync(path.join(outDir, 'report.txt'), report.join('\n'));
console.log(report.slice(0, 5).join('\n'));
