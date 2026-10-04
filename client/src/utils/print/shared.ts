// Общие помощники печатных документов: окно печати, экранирование, базовые стили.
// Цвета в стилях печати — для бумаги, к теме приложения отношения не имеют.

export function openPrintWindow(html: string, beforePrint?: (doc: Document) => void): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    beforePrint?.(win.document);
    win.print();
    win.close();
  }, 500);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Многострочный текст из формы — с сохранением переносов строк */
export function multiline(text: string): string {
  return escapeHtml(text.trim()).replace(/\n/g, '<br>');
}

export const printStyles = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; padding: 15mm 20mm; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 4px; font-weight: 700; text-transform: uppercase; }
    h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #000; padding-bottom: 3px; font-weight: 700; text-transform: uppercase; }
    .subtitle { text-align: center; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; font-size: 11px; }
    th { font-weight: 700; background: #f0f0f0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
    .block { margin-bottom: 10px; }
    .block-label { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
    .block-value { border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 18px; font-size: 12px; }
    .total { text-align: right; font-size: 13px; font-weight: 700; margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; }
    .legal-text { font-size: 10px; line-height: 1.5; margin: 10px 0; color: #333; }
    .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 16px; }
    .sig-block { font-size: 11px; }
    .sig-line { border-top: 1px solid #000; margin-top: 24px; padding-top: 3px; }
    .sig-title { font-weight: 700; margin-bottom: 4px; }
    @media print { body { padding: 10mm 15mm; } }
  </style>
`;

