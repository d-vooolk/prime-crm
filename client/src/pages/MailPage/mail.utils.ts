import dayjs from 'dayjs';

/** Дата в списке писем: сегодня — время, в этом году — «12 окт», раньше — дд.мм.гггг */
export function formatMailDate(iso: string, now = dayjs()): string {
  const d = dayjs(iso);
  if (d.isSame(now, 'day')) return d.format('HH:mm');
  if (d.isSame(now, 'year')) return d.format('D MMM');
  return d.format('DD.MM.YYYY');
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export const senderLabel = (m: { fromName: string | null; fromAddress: string | null }) =>
  m.fromName || m.fromAddress || 'Без отправителя';

/**
 * HTML письма для iframe без скриптов и без доступа к CRM (sandbox без allow-same-origin).
 * CSP внутри запрещает скрипты, формы и любые запросы, кроме картинок: письмо не может
 * ничего отправить от имени пользователя. Ссылки открываются в новой вкладке.
 */
export function buildMailSrcDoc(html: string): string {
  const csp = "default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline'; font-src https: data:";
  return `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="${csp}">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<base target="_blank">`
    + `<style>body{margin:0;padding:12px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111827;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style>`
    + `</head><body>${html}</body></html>`;
}
