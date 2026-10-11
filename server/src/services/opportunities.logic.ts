/**
 * «Открытые возможности» (BETA) — что ещё можно предложить клиенту по прошлым визитам таких же
 * автомобилей. Чистый расчёт без базы.
 *
 * Главное — не перегнуть палку. В каждом прошлом визите самая дорогая работа — причина визита
 * (с ней клиент и приехал), остальное — «попутные» работы. Предлагаем только попутные:
 *   визит 1: Bi-Led модули 1100 + ремонт ДХО 300 + полировка фар 150;
 *   сейчас:  ремонт ДХО → предложим полировку фар, но не Bi-Led модули (это была причина визита).
 * Дополнительно:
 *   - не предлагаем то, что уже есть в записи и что этому же авто уже делали;
 *   - не предлагаем работу дороже всей текущей записи — допродажа не должна быть больше заказа;
 *   - визиты, где делали то же, что сейчас, весят вдвое больше: попутное к той же работе
 *     уместнее, чем попутное к чему-то другому; визиты того же поколения весят больше, чем просто модели.
 */

export interface VisitItem {
  serviceId: string;
  name: string;
  /** Сумма позиции (цена × количество) */
  amount: number;
}

export interface PastVisit {
  recordId: string;
  carId: string;
  sameGeneration: boolean;
  items: VisitItem[];
}

export interface CurrentVisit {
  carId: string;
  items: VisitItem[];
}

export interface Opportunity {
  serviceId: string;
  name: string;
  /** Типичная цена — медиана по визитам, где делали */
  price: number;
  /** В скольких похожих визитах делали попутно */
  count: number;
  /** С какими работами делали (причины тех визитов) */
  togetherWith: string[];
  score: number;
}

export const MAX_OPPORTUNITIES = 5;

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Причина визита — самая дорогая позиция (при равенстве — все самые дорогие) */
export function mainServiceIds(items: VisitItem[]): Set<string> {
  const max = Math.max(...items.map(i => i.amount));
  return new Set(items.filter(i => i.amount === max).map(i => i.serviceId));
}

export function findOpportunities(current: CurrentVisit, visits: PastVisit[]): Opportunity[] {
  const currentIds = new Set(current.items.map(i => i.serviceId));
  const currentTotal = current.items.reduce((s, i) => s + i.amount, 0);
  // Что этому автомобилю уже делали — повторно не предлагаем
  const doneOnThisCar = new Set(visits.filter(v => v.carId === current.carId).flatMap(v => v.items.map(i => i.serviceId)));

  const acc = new Map<string, { name: string; prices: number[]; score: number; together: Set<string> }>();

  for (const visit of visits) {
    if (visit.items.length < 2) continue;
    const main = mainServiceIds(visit.items);
    const overlaps = visit.items.some(i => currentIds.has(i.serviceId));
    const weight = (overlaps ? 2 : 1) * (visit.sameGeneration ? 1 : 0.6);
    const mainNames = visit.items.filter(i => main.has(i.serviceId)).map(i => i.name);

    for (const item of visit.items) {
      if (main.has(item.serviceId)) continue;
      if (currentIds.has(item.serviceId) || doneOnThisCar.has(item.serviceId)) continue;
      const entry = acc.get(item.serviceId) ?? { name: item.name, prices: [], score: 0, together: new Set<string>() };
      entry.prices.push(item.amount);
      entry.score += weight;
      mainNames.forEach(n => entry.together.add(n));
      acc.set(item.serviceId, entry);
    }
  }

  return [...acc.entries()]
    .map(([serviceId, e]) => ({
      serviceId,
      name: e.name,
      price: median(e.prices),
      count: e.prices.length,
      togetherWith: [...e.together].slice(0, 3),
      score: e.score,
    }))
    // Пустая запись — сравнивать не с чем, ограничение по цене не применяем
    .filter(o => currentTotal === 0 || o.price <= currentTotal)
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, MAX_OPPORTUNITIES);
}
