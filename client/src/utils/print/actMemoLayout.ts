import { escapeHtml } from './shared';

export function buildMemoHtml(memo: string): string {
  let html = '';
  let inList = false;
  for (const line of memo.split('\n')) {
    const text = line.trim();
    const isItem = text.startsWith('- ');
    // Соседние пункты собираем в один список
    if (isItem && !inList) html += '<ul>';
    if (!isItem && inList) html += '</ul>';
    inList = isItem;

    if (isItem) html += `<li>${escapeHtml(text.slice(2))}</li>`;
    else if (!text) html += '<div class="memo-gap"></div>';
    else if (text.endsWith(':')) html += `<div class="memo-title">${escapeHtml(text)}</div>`;
    else html += `<p>${escapeHtml(text)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

// Поля страницы задаём явно: по ним считаем, влезает ли памятка на первый лист.
// Размеры шрифтов — через CSS-переменные: placeActMemo подбирает их, чтобы акт уместился на лист
export const memoStyles = `
  <style>
    @page { size: A4; margin: 10mm; }
    .legal-text { font-size: var(--legal-fs, 10px); }
    .memo {
      font-size: var(--memo-fs, 9px); line-height: 1.3; margin: 4px 0 10px;
      padding: 5px 8px; border: 1px solid #999; border-radius: 3px;
    }
    .memo-heading { font-size: 1.15em; font-weight: 700; margin-bottom: 3px; }
    /* Две колонки: памятка вдвое ниже и помещается под гарантиями */
    .memo-body { column-count: 2; column-gap: 6mm; }
    .memo-title { font-weight: 700; margin-top: 3px; break-after: avoid; page-break-after: avoid; }
    .memo-title:first-child { margin-top: 0; }
    .memo ul { padding-left: 11px; }
    .memo li { break-inside: avoid; page-break-inside: avoid; }
    .memo-gap { height: 2px; }
    /* Не влезло даже мелко — отдельная страница. Отступ body есть только у первого листа, задаём свой */
    .memo-back {
      page-break-before: always; break-before: page; margin-top: 0; padding: 14mm 0 0; border: none;
      font-size: 11px; line-height: 1.55;
    }
    .memo-back .memo-body { column-count: 1; }
    .memo-back .memo-heading {
      font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;
      margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #000;
    }
    .memo-back .memo-title { margin-top: 10px; margin-bottom: 2px; }

    /* Компактный акт: включается, когда с памяткой лист не помещается. !important — против инлайновых стилей шаблона */
    body.act-compact { font-size: 11px; padding: 6mm 12mm; }
    @media print { body.act-compact { padding: 6mm 12mm; } }
    .act-compact h1 { font-size: 14px; margin-bottom: 2px; }
    .act-compact .subtitle { margin-bottom: 6px; }
    .act-compact h2 { font-size: 11.5px; margin: 6px 0 3px; }
    .act-compact .two-col { margin: 4px 0 !important; gap: 8px; }
    .act-compact .two-col div { line-height: 1.35 !important; }
    .act-compact table { margin: 3px 0; }
    .act-compact th, .act-compact td { padding: 2px 6px; font-size: 10px; }
    .act-compact .total { font-size: 12px; margin-top: 3px; padding-top: 2px; }
    .act-compact .legal-text { line-height: 1.3; margin: 2px 0 6px !important; }
    .act-compact .legal-text p { margin-bottom: 1px !important; }
    .act-compact .memo { line-height: 1.25; margin: 2px 0 6px; padding: 4px 6px; }
    .act-compact .sig-section { margin-top: 8px !important; }
    .act-compact .sig-line { margin-top: 16px; }
  </style>
`;

// Ступени ужатия: обычный акт → компактный (поля, таблицы, реквизиты) → мельче памятка и гарантии.
// Меньше 7px на бумаге уже не читается — дальше только отдельная страница
export const FIT_STEPS: Array<{ compact: boolean; memo: number; legal: number }> = [
  { compact: false, memo: 9, legal: 10 },
  { compact: true, memo: 9, legal: 9.5 },
  { compact: true, memo: 8.5, legal: 9 },
  { compact: true, memo: 8, legal: 8.5 },
  { compact: true, memo: 7.5, legal: 8 },
  { compact: true, memo: 7, legal: 8 },
];

/**
 * Памятка стоит под гарантиями, до подписей. Акт печатают сразу в двух экземплярах, поэтому
 * всё должно уместиться на один лист: подбираем шрифт памятки и гарантий по ступеням FIT_STEPS.
 * Только если не влезает и на самой мелкой — переносим памятку на отдельную страницу после подписей.
 * Меряем в той же вёрстке, что при печати: ширина и отступы листа из @page и @media print.
 */
export function placeActMemo(doc: Document): void {
  const memo = doc.getElementById('act-memo');
  if (!memo) return;
  const body = doc.body;
  const prev = { width: body.style.width, padding: body.style.padding };
  body.style.width = '190mm'; // 210mm минус поля @page

  const probe = doc.createElement('div');
  probe.style.height = '277mm'; // 297mm минус поля @page
  body.appendChild(probe);
  const pageHeight = probe.offsetHeight;
  probe.remove();

  // Небольшой запас: браузеры по-разному округляют шрифты при печати
  const fitsPage = () => body.scrollHeight <= pageHeight * 0.97;
  const fitted = FIT_STEPS.some(step => {
    body.classList.toggle('act-compact', step.compact);
    body.style.padding = step.compact ? '6mm 12mm' : '10mm 15mm'; // как в @media print
    body.style.setProperty('--memo-fs', `${step.memo}px`);
    body.style.setProperty('--legal-fs', `${step.legal}px`);
    return fitsPage();
  });

  body.style.width = prev.width;
  body.style.padding = prev.padding;
  if (fitted) return;

  body.classList.remove('act-compact');
  body.style.removeProperty('--memo-fs');
  body.style.removeProperty('--legal-fs');
  memo.classList.add('memo-back');
  body.appendChild(memo);
}
