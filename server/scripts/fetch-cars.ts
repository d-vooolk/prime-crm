/**
 * Разовый обход стороннего каталога авто (auto-data.api-home.ru).
 *
 * Донор нестабилен: ~20-30% запросов виснут на полный таймаут, поэтому скрипт
 * кэширует каждый успешный ответ на диск и при повторном запуске продолжает
 * с места остановки. Прерывать и перезапускать можно сколько угодно раз.
 *
 *   npm run cars:fetch
 *
 * Результат — снапшот prisma/data/cars-catalog.json, который коммитится в git
 * и заливается в БД через `npm run cars:seed`.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

const BASE_URL = process.env.CARS_API_URL || 'https://auto-data.api-home.ru/api/public/v1';
const TOKEN = process.env.CARS_API_TOKEN;

const DATA_DIR = path.resolve(__dirname, '..', 'prisma', 'data');
const CACHE_DIR = path.join(DATA_DIR, '.cache');
const OUT_FILE = path.join(DATA_DIR, 'cars-catalog.json');

// Донор — слабый shared-хостинг. Обход в 6 потоков он выдержал около часа,
// после чего начал отбивать вообще всё. Поэтому: мало потоков, пауза между
// запросами и предохранитель, который засыпает при серии отказов вместо того,
// чтобы молотить в закрытую дверь.
const CONCURRENCY = 2;
const REQUEST_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

// Предохранитель
const FAILURE_STREAK_LIMIT = 15;
const COOLDOWN_BASE_MS = 5 * 60_000;
const COOLDOWN_MAX_MS = 30 * 60_000;

// Собрать снапшот из кэша, не ходя в сеть: npm run cars:snapshot
const CACHE_ONLY = process.argv.includes('--from-cache');

let failureStreak = 0;
let cooldownMs = COOLDOWN_BASE_MS;
let pausedUntil = 0;

/** Спит, если предохранитель сработал. Вызывается перед каждым запросом. */
async function waitIfPaused() {
  while (Date.now() < pausedUntil) {
    const left = Math.ceil((pausedUntil - Date.now()) / 1000);
    await new Promise(r => setTimeout(r, Math.min(left, 30) * 1000));
  }
}

function noteSuccess() {
  failureStreak = 0;
  cooldownMs = COOLDOWN_BASE_MS;
}

function noteFailure() {
  failureStreak++;
  if (failureStreak >= FAILURE_STREAK_LIMIT && Date.now() >= pausedUntil) {
    pausedUntil = Date.now() + cooldownMs;
    log(`!!! ${failureStreak} отказов подряд — донор нас отбивает. Пауза ${Math.round(cooldownMs / 60000)} мин.`);
    cooldownMs = Math.min(cooldownMs * 2, COOLDOWN_MAX_MS);
    failureStreak = 0;
  }
}

interface RawMark { id: string; name: string; year_from?: number; year_to?: number; logo?: string | null }
interface RawModel { id: string; name: string; year_from?: number; year_to?: number }
interface RawGeneration { id: number | string; name: string; year_from?: number; year_to?: number; photo?: string | null }

let done = 0;
let total = 0;
let failed = 0;
let fromCache = 0;

function log(msg: string) {
  // Локальное время, а не UTC: обход длится часами, и лог сверяют с часами на стене.
  const t = new Date().toLocaleTimeString('ru-RU', { hour12: false });
  console.log(`[${t}] ${msg}`); // eslint-disable-line no-console
}

function safeName(s: string) {
  return encodeURIComponent(s).replace(/[*?"<>|:\\/]/g, '_');
}

function readCache<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Возвращает массив данных или null, если донор так и не ответил за все попытки. */
async function fetchList<T>(url: string, cacheFile: string): Promise<T[] | null> {
  const cached = readCache<T[]>(cacheFile);
  if (cached) {
    fromCache++;
    return cached;
  }
  if (CACHE_ONLY) return null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await waitIfPaused();
    if (REQUEST_DELAY_MS) await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { 'api-token': TOKEN as string }, signal: ac.signal });
      clearTimeout(timer);

      // Донор отдаёт 404 для несуществующих связок — это не ошибка, просто пусто
      if (res.status === 404) {
        noteSuccess(); // сервис ответил — он жив, просто записи нет
        fs.writeFileSync(cacheFile, '[]');
        return [];
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = await res.json() as T[] | { data?: T[]; message?: string };
      const list = Array.isArray(body) ? body : body.data;
      noteSuccess();
      if (!Array.isArray(list)) {
        // {"message":"Нет такой записи."} — тоже пусто
        fs.writeFileSync(cacheFile, '[]');
        return [];
      }
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(list));
      return list;
    } catch {
      clearTimeout(timer);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 15_000)));
      }
    }
  }
  noteFailure();
  return null;
}

/** Пул воркеров: держит CONCURRENCY задач в полёте, не создавая тысячи промисов разом. */
async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
      done++;
      if (done % 100 === 0 || done === total) {
        const pct = total ? ((done / total) * 100).toFixed(1) : '0';
        log(`${done}/${total} (${pct}%) | из кэша ${fromCache} | не ответили ${failed}`);
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  if (!TOKEN && !CACHE_ONLY) {
    console.error('CARS_API_TOKEN не задан в окружении (server/.env.development)'); // eslint-disable-line no-console
    process.exit(1);
  }
  if (CACHE_ONLY) log('Режим --from-cache: собираю снапшот из уже скачанного, в сеть не хожу.');
  fs.mkdirSync(path.join(CACHE_DIR, 'models'), { recursive: true });
  fs.mkdirSync(path.join(CACHE_DIR, 'generations'), { recursive: true });

  // 1. Марки
  total = 1;
  const marks = await fetchList<RawMark>(`${BASE_URL}/marks`, path.join(CACHE_DIR, 'marks.json'));
  if (!marks) {
    console.error('Список марок недоступен: донор не отвечает и кэша нет. Запустите позже.'); // eslint-disable-line no-console
    process.exit(1);
  }
  log(`марок: ${marks.length}`);

  // 2. Модели по каждой марке
  done = 0; fromCache = 0; total = marks.length;
  log(`--- модели: ${total} запросов`);
  const modelsByMark = await pool(marks, CONCURRENCY, async (mark) => {
    const file = path.join(CACHE_DIR, 'models', `${safeName(mark.id)}.json`);
    const list = await fetchList<RawModel>(`${BASE_URL}/marks/${encodeURIComponent(mark.id)}/models`, file);
    if (list === null) { failed++; return { mark, models: [] as RawModel[], ok: false }; }
    return { mark, models: list, ok: true };
  });

  const missingModels = modelsByMark.filter(m => !m.ok).map(m => m.mark.id);
  const modelCount = modelsByMark.reduce((s, m) => s + m.models.length, 0);
  log(`моделей собрано: ${modelCount}; марок без ответа: ${missingModels.length}`);

  // 3. Поколения по каждой модели
  const pairs = modelsByMark.flatMap(({ mark, models }) => models.map(model => ({ mark, model })));
  done = 0; fromCache = 0; failed = 0; total = pairs.length;
  log(`--- поколения: ${total} запросов`);
  const generations = await pool(pairs, CONCURRENCY, async ({ mark, model }) => {
    const file = path.join(CACHE_DIR, 'generations', `${safeName(mark.id)}__${safeName(model.id)}.json`);
    const url = `${BASE_URL}/marks/${encodeURIComponent(mark.id)}/models/${encodeURIComponent(model.id)}/generations`;
    const list = await fetchList<RawGeneration>(url, file);
    if (list === null) { failed++; return { markId: mark.id, modelId: model.id, generations: [] as RawGeneration[], ok: false }; }
    return { markId: mark.id, modelId: model.id, generations: list, ok: true };
  });

  const missingGenerations = generations.filter(g => !g.ok).map(g => `${g.markId}/${g.modelId}`);
  const generationCount = generations.reduce((s, g) => s + g.generations.length, 0);

  // 4. Снапшот
  const snapshot = {
    source: BASE_URL,
    fetchedAt: new Date().toISOString(),
    counts: { marks: marks.length, models: modelCount, generations: generationCount },
    incomplete: { marks: missingModels, models: missingGenerations },
    marks: marks.map(mark => ({
      id: String(mark.id),
      name: mark.name,
      yearFrom: mark.year_from ?? null,
      yearTo: mark.year_to ?? null,
      logo: mark.logo ?? null,
      models: (modelsByMark.find(m => m.mark.id === mark.id)?.models ?? []).map(model => ({
        id: String(model.id),
        name: model.name,
        yearFrom: model.year_from ?? null,
        yearTo: model.year_to ?? null,
        generations: (generations.find(g => g.markId === mark.id && g.modelId === model.id)?.generations ?? []).map(gen => ({
          id: String(gen.id),
          name: gen.name,
          yearFrom: gen.year_from ?? null,
          yearTo: gen.year_to ?? null,
          photo: gen.photo ?? null,
        })),
      })),
    })),
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot));
  const sizeMb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);

  log('=== готово ===');
  log(`марок ${marks.length}, моделей ${modelCount}, поколений ${generationCount}`);
  log(`не ответили: ${missingModels.length} марок, ${missingGenerations.length} моделей`);
  log(`снапшот: ${OUT_FILE} (${sizeMb} МБ)`);
  if (missingModels.length || missingGenerations.length) {
    log('Часть данных не добралась. Повторный запуск догрузит только их — успешное лежит в .cache/');
  }
}

main();
