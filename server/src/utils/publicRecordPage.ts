/**
 * HTML страницы записи для клиента (zapis.prime-auto.by/<код>). Её открывают с телефона по
 * ссылке из SMS, поэтому страница — одна лёгкая HTML без скриптов: стили встроены, вопросы и
 * ответы раскрываются тегом <details>, фото листаются свайпом (scroll-snap).
 * Все данные экранируются: имя клиента и тексты из справочника пишут люди.
 */

export interface CompanyView {
  name: string;
  phone: string | null;
  address: string | null;
}

export interface RepairTypeView {
  name: string;
  description: string;
  photos: string[];
  faq: { question: string; answer: string }[];
  links: { title: string; url: string }[];
}

export interface RecordPageView {
  clientName: string;
  when: { day: string; time: string };
  car: { title: string; details: string; photoUrl: string | null };
  services: string[];
  repairTypes: RepairTypeView[];
  company: CompanyView;
}

export interface GonePageView {
  company: CompanyView;
}

const SITE_URL = 'https://prime-auto.by';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Текст из справочника: пустая строка — новый абзац, перенос строки — <br> */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Номер для ссылки tel: — только цифры и плюс */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

const STYLES = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  background:var(--bg);color:var(--text);
  --bg:#f3f4f6;--card:#fff;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--accent:#3b82f6;--accent-soft:#eff6ff}
@media (prefers-color-scheme:dark){body{--bg:#0b0f17;--card:#151b26;--text:#f3f4f6;--muted:#9ca3af;--border:#253041;--accent:#60a5fa;--accent-soft:#16233a}}
a{color:var(--accent)}
.hero{position:relative;min-height:62vh;min-height:62svh;display:flex;flex-direction:column;justify-content:flex-end;
  padding:24px 20px calc(28px + 16px);color:#fff;background:#111827 center/cover no-repeat;overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.35) 45%,rgba(0,0,0,.85) 100%)}
.hero--empty{background:radial-gradient(120% 90% at 80% 0%,#1d4ed8 0%,#111827 60%)}
.hero>*{position:relative;z-index:1}
.brand{position:absolute;top:calc(16px + env(safe-area-inset-top));left:20px;z-index:1;font-weight:700;letter-spacing:.04em;font-size:14px;opacity:.9;text-transform:uppercase}
.hello{margin:0 0 4px;font-size:15px;opacity:.85}
.name{margin:0 0 12px;font-size:28px;line-height:1.15;font-weight:700;word-break:break-word}
.car{margin:0;font-size:17px;font-weight:600}
.car small{display:block;font-weight:400;font-size:14px;opacity:.8}
main{position:relative;z-index:2;margin:-16px auto 0;max-width:640px;padding:0 12px 32px}
.card{background:var(--card);border-radius:18px;padding:20px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.when{display:flex;gap:12px;align-items:center}
.when__icon{flex:none;width:44px;height:44px;border-radius:12px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:22px}
.when__day{font-weight:600;text-transform:capitalize}
.when__time{color:var(--muted);font-size:15px}
h2{margin:0 0 12px;font-size:19px;line-height:1.3}
.muted{color:var(--muted);font-size:14px;margin:0 0 12px}
.services{list-style:none;margin:0;padding:0}
.services li{position:relative;padding:10px 0 10px 28px;border-top:1px solid var(--border)}
.services li:first-child{border-top:0}
.services li::before{content:"";position:absolute;left:4px;top:17px;width:10px;height:10px;border-radius:50%;background:var(--accent)}
.desc p{margin:0 0 10px}
.photos{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;margin:4px -20px 12px;padding:0 20px;scrollbar-width:none}
.photos::-webkit-scrollbar{display:none}
.photos img{flex:none;width:85%;max-width:420px;aspect-ratio:4/3;object-fit:cover;border-radius:12px;scroll-snap-align:center;background:var(--border)}
.photos img:only-child{width:100%}
details{border-top:1px solid var(--border)}
details:first-of-type{border-top:0}
summary{list-style:none;cursor:pointer;padding:12px 28px 12px 0;font-weight:600;position:relative}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";position:absolute;right:2px;top:9px;font-size:22px;font-weight:400;color:var(--muted)}
details[open] summary::after{content:"−"}
details p{margin:0 0 12px;color:var(--muted)}
.faq h3{margin:16px 0 4px;font-size:16px}
.links{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px}
.btn--soft{background:var(--accent-soft);color:var(--accent)}
.btn--main{background:var(--accent);color:#fff;width:100%}
.contacts p{margin:0 0 12px}
footer{text-align:center;color:var(--muted);font-size:13px;padding:8px 20px calc(24px + env(safe-area-inset-bottom))}
.gone{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;justify-content:center;max-width:480px;margin:0 auto;padding:24px 16px}
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#111827">
<meta name="format-detection" content="telephone=no">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function contactsCard(company: CompanyView): string {
  if (!company.phone && !company.address) return '';
  return `<section class="card contacts">
  <h2>Контакты</h2>
  ${company.address ? `<p>📍 ${escapeHtml(company.address)}</p>` : ''}
  ${company.phone ? `<a class="btn btn--main" href="${escapeHtml(telHref(company.phone))}">Позвонить ${escapeHtml(company.phone)}</a>` : ''}
</section>`;
}

function repairTypeCard(t: RepairTypeView): string {
  const photos = t.photos.length
    ? `<div class="photos">${t.photos.map(src => `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`).join('')}</div>`
    : '';
  const faq = t.faq.length
    ? `<div class="faq"><h3>Вопросы и ответы</h3>${t.faq.map(f => `<details><summary>${escapeHtml(f.question)}</summary>${textToHtml(f.answer)}</details>`).join('')}</div>`
    : '';
  const links = t.links.length
    ? `<div class="links">${t.links.map(l => `<a class="btn btn--soft" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.title)}</a>`).join('')}</div>`
    : '';
  return `<section class="card">
  <h2>${escapeHtml(t.name)}</h2>
  ${photos}
  ${t.description ? `<div class="desc">${textToHtml(t.description)}</div>` : ''}
  ${faq}
  ${links}
</section>`;
}

export function renderRecordPage(v: RecordPageView): string {
  const heroStyle = v.car.photoUrl ? ` style="background-image:url('${escapeHtml(v.car.photoUrl)}')"` : '';
  const body = `
<header class="hero${v.car.photoUrl ? '' : ' hero--empty'}"${heroStyle}>
  <div class="brand">${escapeHtml(v.company.name)}</div>
  <p class="hello">Здравствуйте,</p>
  <h1 class="name">${escapeHtml(v.clientName)}</h1>
  <p class="car">${escapeHtml(v.car.title)}${v.car.details ? `<small>${escapeHtml(v.car.details)}</small>` : ''}</p>
</header>
<main>
  <section class="card when">
    <div class="when__icon" aria-hidden="true">📅</div>
    <div>
      <div class="when__day">${escapeHtml(v.when.day)}</div>
      <div class="when__time">в ${escapeHtml(v.when.time)}</div>
    </div>
  </section>
  <section class="card">
    <h2>Вы записаны на услуги по своему авто</h2>
    ${v.services.length ? `<ul class="services">${v.services.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : '<p class="muted">Список услуг уточнит мастер-приёмщик.</p>'}
  </section>
  ${v.repairTypes.map(repairTypeCard).join('\n')}
  ${contactsCard(v.company)}
</main>
<footer><a href="${SITE_URL}" target="_blank" rel="noopener">prime-auto.by</a></footer>`;
  return page(`Ваша запись — ${v.company.name}`, body);
}

/** Запись закрыта, отменена или ссылка неверная — без подробностей, чтобы не подсказывать перебор */
export function renderGonePage(v: GonePageView): string {
  const body = `
<div class="gone">
  <section class="card">
    <h2>Страница больше недоступна</h2>
    <p class="muted">Запись уже завершена или ссылка устарела. Спасибо, что выбрали ${escapeHtml(v.company.name)}!</p>
    <a class="btn btn--soft" href="${SITE_URL}">Перейти на prime-auto.by</a>
  </section>
  ${contactsCard(v.company)}
</div>`;
  return page(v.company.name, body);
}
