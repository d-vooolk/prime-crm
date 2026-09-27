import { ActMemoBlock, Category, CompanySettings, Record } from '@/types';

/**
 * Памятка клиенту по умолчанию — пока в настройках её не меняли (actMemo === null).
 * Строка, оканчивающаяся на «:», — заголовок блока, строка с «- » — пункт списка.
 */
export const DEFAULT_ACT_MEMO = `Фары (разбор, замена линз, установка модулей, восстановление герметичности):
- После разбора и сборки фары допускается появление конденсата на внутренней стороне стекла после мойки, в дождливую или туманную погоду, при резком перепаде температур. Это нормальное явление: фара вентилируется через клапаны, и конденсат уходит сам после включения света или во время поездки.
- Обратитесь к нам, если внутри фары скапливаются капли или вода, которые не уходят в течение 1–2 дней.
- Мойку высокого давления держите не ближе 30 см от фары и не направляйте струю на стык стекла и корпуса.
- Не очищайте стекло фары абразивными средствами и растворителями, не счищайте лёд скребком.
- После ДТП или удара по фаре приезжайте на диагностику, даже если повреждений не видно.

Оклейка плёнкой:
- Не мойте автомобиль 3 дня после оклейки.
- Мойку высокого давления держите не ближе 30 см от плёнки и не направляйте струю на её края.
- Первые 2 недели возможны мелкие пузырьки и лёгкая мутность — плёнка «садится», это проходит само. Не прокалывайте и не поддевайте их.
- Не используйте абразивные полироли и растворители, не счищайте лёд и снег скребком с оклеенных поверхностей.`;

/**
 * Автоподбор услуг для блоков, пока памятку не настроили блоками: по заголовку блока — какие
 * услуги к нему относятся. Про фары — только если фару вскрывали, про плёнку — если оклеивали.
 */
const GUESS_RULES: Array<{ title: RegExp; service: RegExp }> = [
  { title: /фар/i, service: /расклейк|разборк|разбор фар/i },
  { title: /оклейк|плёнк|пленк/i, service: /оклейка|плёнк|пленк/i },
];

const guessRule = (title: string) => GUESS_RULES.find(r => r.title.test(title));

let idSeq = 0;
export const newMemoBlockId = () => `b${Date.now().toString(36)}${(idSeq++).toString(36)}`;

/** Старый текстовый формат → блоки (по строкам-заголовкам с двоеточием) */
export function memoBlocksFromText(text: string): ActMemoBlock[] {
  const blocks: ActMemoBlock[] = [];
  let current: ActMemoBlock | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.endsWith(':') && !line.startsWith('- ')) {
      current = { id: newMemoBlockId(), title: line.slice(0, -1), text: '', targets: [] };
      blocks.push(current);
      continue;
    }
    if (!current) {
      if (!line) continue;
      current = { id: newMemoBlockId(), title: '', text: '', targets: [] };
      blocks.push(current);
    }
    current.text += (current.text ? '\n' : '') + raw;
  }
  return blocks.map(b => ({ ...b, text: b.text.trim() }));
}

/** Для редактора: какие услуги отметить у блока, перенесённого из текста */
export function guessMemoTargets(title: string, categories: Category[]): string[] {
  const rule = guessRule(title);
  if (!rule) return [];
  return categories.flatMap(c => c.services.filter(s => rule.service.test(s.name)).map(s => `svc:${s.id}`));
}

/** Блоки из настроек; без блоков — из текста (или текста по умолчанию) с автоподбором услуг */
function settingsBlocks(settings?: CompanySettings): { blocks: ActMemoBlock[]; guessed: boolean } {
  if (settings?.actMemoBlocks) return { blocks: settings.actMemoBlocks, guessed: false };
  return { blocks: memoBlocksFromText(settings?.actMemo ?? DEFAULT_ACT_MEMO), guessed: true };
}

function blockApplies(block: ActMemoBlock, record: Record, guessed: boolean): boolean {
  if (block.targets.length) {
    const targets = new Set(block.targets);
    return record.items.some(i =>
      targets.has(`svc:${i.serviceId}`) || (!!i.service?.categoryId && targets.has(`cat:${i.service.categoryId}`)));
  }
  if (!guessed) return true;
  const rule = guessRule(block.title);
  return !rule || record.items.some(i => rule.service.test(i.service?.name ?? ''));
}

/**
 * Текст памятки для конкретной записи: только блоки, относящиеся к её услугам.
 * Пустая строка — печатать нечего.
 */
export function actMemoForRecord(record: Record, settings?: CompanySettings): string {
  const { blocks, guessed } = settingsBlocks(settings);
  const seen = new Set<string>();
  return blocks
    .filter(b => b.text.trim() && blockApplies(b, record, guessed))
    // Одинаковую памятку у разных услуг печатаем один раз
    .filter(b => {
      const key = b.text.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(b => {
      const title = b.title.trim() || blockServiceNames(b, record);
      return title ? `${title}:\n${b.text.trim()}` : b.text.trim();
    })
    .join('\n\n');
}

/** Заголовок, если его не задали, — услуги записи, к которым относится памятка */
function blockServiceNames(block: ActMemoBlock, record: Record): string {
  const targets = new Set(block.targets);
  const names = record.items
    .filter(i => targets.has(`svc:${i.serviceId}`) || (!!i.service?.categoryId && targets.has(`cat:${i.service.categoryId}`)))
    .map(i => i.service?.name)
    .filter((n): n is string => !!n);
  return [...new Set(names)].join(', ');
}
