/**
 * HTML страницы записи для клиента (zapis.prime-auto.by/<код>). Её открывают с телефона по
 * ссылке из SMS, поэтому страница — одна лёгкая HTML без скриптов: стили встроены, вопросы и
 * ответы раскрываются тегом <details>, фото листаются свайпом (scroll-snap).
 * Оформление — в фирменном стиле prime-auto.by: графит, салатовый, Montserrat.
 * Все данные экранируются: имя клиента и тексты из справочника пишут люди.
 */

export interface RepairTypeView {
  name: string;
  description: string;
  photos: string[];
  faq: { question: string; answer: string }[];
  links: { title: string; url: string }[];
}

export interface RecordPageView {
  clientName: string;
  when: { weekday: string; dayNumber: string; month: string; time: string };
  /** Относительные/абсолютные ссылки на событие для календаря */
  calendar: { icsHref: string; googleHref: string };
  car: { title: string; details: string; photoUrl: string | null };
  services: string[];
  repairTypes: RepairTypeView[];
  /** Логотип Prime Auto (SVG из assets, не пользовательские данные) */
  logoSvg: string;
}

export interface GonePageView {
  logoSvg: string;
}

/** Контакты мастерской — как на prime-auto.by (src/constants/site.ts и links.js сайта) */
export const BRAND = {
  site: 'https://prime-auto.by',
  phone: '+375 (33) 66-55-44-9',
  telegram: 'https://t.me/primeautominsk',
  viber: 'viber://chat?number=%2B375336655449',
  address: 'Минск, Брилевский тупик, 5',
  hours: 'Пн–Пт 09:00–19:00, Сб–Вс — выходной',
  mapUrl: 'https://yandex.by/maps/org/praym_avto/191443735649/',
  // Маршрут на машине от текущего местоположения до мастерской
  routeUrl: 'https://yandex.by/maps/?rtext=~53.871641%2C27.523566&rtt=auto',
} as const;

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

// ─── Иконки (как на prime-auto.by) ─────────────────

const ICON = {
  phone: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  telegram: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.1L2.86 10.02c-.97.38-.95 1.76.03 2.1l4.36 1.5 1.67 5.25c.24.77 1.2 1.02 1.78.47l2.44-2.3 4.43 3.27c.67.5 1.63.13 1.8-.69l2.57-15.32zM9.8 14.24l-.6 3.1-1.06-3.6 9.68-6.2-8.02 6.7z"/></svg>',
  viber: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.4 1C8.6 1.03 3.27 1.5.9 7.6c-.85 2.2-.9 5.5-.08 8.17.62 2.03 1.9 3.6 3.68 4.5v2.95c0 .55.66.83 1.05.44l2.5-2.5c1.12.12 2.27.15 3.4.1 3.47-.17 8.4-1.2 10.24-6.3.86-2.4.95-5.6.15-8.13C20.2 1.9 14.2.97 11.4 1zm.2 1.8c2.45.02 7.28.78 8.18 4.4.65 2.17.6 4.98-.13 7.03-1.5 4.13-5.52 4.95-8.42 5.1-1.06.05-2.13.02-3.18-.1l-.42-.05-1.83 1.83v-2.4l-.5-.22C3.7 17.7 2.75 16.4 2.27 14.8c-.7-2.3-.66-5.15.05-7 1.95-5 6.4-5.03 9.27-5zm-.4 2.36a.5.5 0 0 0 0 1c2.9.02 4.94 2.06 4.97 4.98a.5.5 0 0 0 1 0c-.04-3.47-2.5-5.94-5.97-5.98zm-3.28.98c-.37-.02-.75.1-1.04.38l-.6.6c-.6.6-.78 1.56-.37 2.42.95 2 2.55 4.03 4.9 5.43.86.5 1.84.4 2.47-.23l.6-.6c.53-.53.5-1.4-.05-1.9l-.98-.88a1.3 1.3 0 0 0-1.73.01l-.4.37c-1.03-.48-2.05-1.43-2.55-2.47l.36-.4a1.3 1.3 0 0 0 0-1.73l-.86-.98a1.3 1.3 0 0 0-.75-.42zm3.48.6a.5.5 0 0 0 0 1c1.45.04 2.4 1 2.43 2.43a.5.5 0 0 0 1 0c-.03-2-1.42-3.38-3.43-3.43zm.16 1.88a.5.5 0 0 0-.03 1c.42.03.62.23.66.66a.5.5 0 0 0 1-.06c-.06-.94-.67-1.56-1.63-1.6z"/></svg>',
  pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="2"/></svg>',
  route: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  calendarPlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const STYLES = `
@font-face{font-family:Montserrat;font-weight:100 900;font-display:swap;src:url(assets/montserrat-cyrillic.woff2) format("woff2");unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:Montserrat;font-weight:100 900;font-display:swap;src:url(assets/montserrat-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212}
:root{--green:#A2DB00;--green-soft:rgba(162,219,0,.12);--bg:#121212;--card:#1C1C1C;--card-2:#232323;--line:rgba(255,255,255,.08);--text:#fff;--muted:#A3A3A3;--radius:22px}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--bg)}
body{margin:0;min-height:100vh;color:var(--text);font:15px/1.55 Montserrat,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  background:radial-gradient(900px 500px at 110% 40%,rgba(162,219,0,.08),transparent 60%),radial-gradient(700px 500px at -20% 85%,rgba(162,219,0,.06),transparent 60%),var(--bg);
  padding-bottom:calc(84px + env(safe-area-inset-bottom))}
a{color:inherit}
p{margin:0 0 10px}

/* ── Первый экран ── */
.hero{position:relative;min-height:74vh;min-height:74svh;display:flex;flex-direction:column;justify-content:flex-end;padding:0 20px 64px;overflow:hidden;isolation:isolate;background:#0d0d0d}
.hero__photo{position:absolute;inset:0;z-index:-2;background:center 40%/cover no-repeat;transform:scale(1.04)}
.hero__photo--empty{background:radial-gradient(120% 80% at 75% 20%,#2c3a10 0%,#151515 55%,#0d0d0d 100%)}
.hero::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(18,18,18,.55) 0%,rgba(18,18,18,.05) 28%,rgba(18,18,18,.35) 58%,var(--bg) 100%)}
/* луч фар — медленно проходит по первому экрану */
.hero::after{content:"";position:absolute;z-index:-1;top:-30%;left:-60%;width:60%;height:160%;transform:rotate(18deg);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.10),rgba(162,219,0,.10),transparent);animation:beam 7s ease-in-out 1s infinite}
@keyframes beam{0%{left:-60%}55%,100%{left:130%}}
.top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:calc(16px + env(safe-area-inset-top)) 20px 0}
.logo{display:block;line-height:0;padding:10px 14px;border-radius:14px;background:rgba(18,18,18,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid var(--line)}
.logo svg{width:104px;height:auto}
.badge{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#121212;background:var(--green)}
.hello{margin:0 0 6px;font-size:15px;font-weight:500;color:rgba(255,255,255,.8)}
.name{margin:0;font-size:clamp(28px,8vw,40px);line-height:1.08;font-weight:800;letter-spacing:-.02em;word-break:break-word}
.car{display:flex;align-items:center;gap:10px;margin-top:16px;font-weight:700;font-size:17px}
.car::before{content:"";flex:none;width:26px;height:3px;border-radius:2px;background:var(--green)}
.car small{font-weight:500;font-size:14px;color:var(--muted);margin-left:4px}

main{position:relative;z-index:1;max-width:640px;margin:-40px auto 0;padding:0 14px}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:22px 20px;margin-bottom:14px}

/* ── Дата: нажатие добавляет событие в календарь ── */
.when{display:flex;align-items:center;gap:16px;text-decoration:none;background:linear-gradient(135deg,#232323,#1a1a1a);box-shadow:0 18px 40px rgba(0,0,0,.35)}
.when__date{flex:none;width:68px;height:72px;border-radius:18px;background:var(--green);color:#121212;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.when__num{font-size:30px;font-weight:800}
.when__month{font-size:12px;font-weight:700;text-transform:uppercase;margin-top:4px}
.when__info{flex:1;min-width:0}
.when__weekday{font-weight:700;font-size:17px;text-transform:capitalize}
.when__time{font-size:15px;color:var(--muted)}
.when__time b{color:var(--text);font-size:17px}
.when__add{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;font-weight:600;color:var(--green)}
.when-alt{display:block;margin:-6px 4px 14px;text-align:right;font-size:13px;color:var(--muted)}

/* ── Заголовки разделов ── */
.label{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--green)}
.label::after{content:"";flex:1;height:1px;background:var(--line)}
h2{margin:0 0 14px;font-size:21px;line-height:1.25;font-weight:800;letter-spacing:-.01em}

.services{list-style:none;margin:0;padding:0;counter-reset:s}
.services li{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-top:1px solid var(--line);font-weight:500}
.services li:first-child{border-top:0;padding-top:2px}
.services i{flex:none;width:24px;height:24px;margin-top:-1px;border-radius:50%;display:grid;place-items:center;background:var(--green-soft);color:var(--green)}

/* ── Блок типа ремонта ── */
.work{padding-top:26px;overflow:hidden}
.work::before{content:"";position:absolute;top:0;left:20px;right:20px;height:3px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,var(--green),rgba(162,219,0,0))}
.desc{color:#E5E5E5}
.photos{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;margin:6px -20px 16px;padding:0 20px;scrollbar-width:none}
.photos::-webkit-scrollbar{display:none}
.photos img{flex:none;width:82%;max-width:420px;aspect-ratio:4/3;object-fit:cover;border-radius:16px;scroll-snap-align:center;background:var(--card-2)}
.photos img:only-child{width:100%}
.swipe{margin:-8px 0 14px;font-size:12px;color:var(--muted)}
.faq{margin-top:18px;border-radius:16px;background:var(--card-2);padding:4px 16px}
details{border-top:1px solid var(--line)}
details:first-child{border-top:0}
summary{list-style:none;cursor:pointer;padding:14px 32px 14px 0;font-weight:600;position:relative}
summary::-webkit-details-marker{display:none}
summary::after{content:"";position:absolute;right:4px;top:19px;width:9px;height:9px;border-right:2px solid var(--green);border-bottom:2px solid var(--green);transform:rotate(45deg);transition:transform .2s}
details[open] summary::after{transform:rotate(-135deg);top:23px}
details p{color:var(--muted)}
details>div{padding-bottom:6px}
.links{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:9px 14px;border-radius:12px;border:1px solid rgba(162,219,0,.45);color:var(--green);text-decoration:none;font-weight:600;font-size:14px}

/* ── Контакты ── */
.address{display:flex;gap:12px;align-items:flex-start;text-decoration:none}
.address i{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--green-soft);color:var(--green)}
.address b{display:block;font-size:17px}
.address span{font-size:13px;color:var(--muted)}
.hours{display:flex;align-items:center;gap:8px;margin:14px 0 16px;font-size:14px;color:var(--muted)}
.route{display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:25px;background:var(--green);color:#121212;text-decoration:none;font-weight:700;font-size:16px}

footer{max-width:640px;margin:0 auto;padding:12px 20px 24px;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:13px}
footer svg{width:84px;height:auto;opacity:.7}
footer a{text-decoration:none}

/* ── Панель внизу: как на prime-auto.by ── */
.cta{position:fixed;left:0;right:0;bottom:0;z-index:10;display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(38,38,38,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 -6px 24px rgba(0,0,0,.25)}
.cta__main{flex:1;height:48px;border-radius:24px;background:var(--green);color:#262626;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-weight:700;font-size:16px}
.cta__icon{flex:none;width:46px;height:46px;align-self:center;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none}
.cta__icon--tg{background:#229ED9}
.cta__icon--viber{background:#7360F2}
@media (min-width:700px){.cta{left:50%;right:auto;bottom:16px;width:560px;transform:translateX(-50%);border-radius:30px;padding:8px}}

/* ── Страница завершённой записи ── */
.gone{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;justify-content:center;max-width:480px;margin:0 auto;padding:24px 16px}
.gone .logo{align-self:flex-start;margin-bottom:24px}
.muted{color:var(--muted)}

@media (prefers-reduced-motion:reduce){.hero::after{animation:none;display:none}}
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#121212">
<meta name="format-detection" content="telephone=no">
<title>${escapeHtml(title)}</title>
<link rel="preload" href="assets/montserrat-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function ctaBar(): string {
  return `<nav class="cta" aria-label="Связаться с нами">
  <a class="cta__main" href="${escapeHtml(telHref(BRAND.phone))}">${ICON.phone}Позвонить</a>
  <a class="cta__icon cta__icon--tg" href="${BRAND.telegram}" target="_blank" rel="noopener" aria-label="Написать в Telegram">${ICON.telegram}</a>
  <a class="cta__icon cta__icon--viber" href="${BRAND.viber}" aria-label="Написать в Viber">${ICON.viber}</a>
</nav>`;
}

function contactsCard(): string {
  return `<section class="card">
  <div class="label">Как нас найти</div>
  <a class="address" href="${BRAND.mapUrl}" target="_blank" rel="noopener">
    <i>${ICON.pin}</i>
    <div><b>${escapeHtml(BRAND.address)}</b><span>Открыть на Яндекс Картах</span></div>
  </a>
  <div class="hours">${ICON.clock}${escapeHtml(BRAND.hours)}</div>
  <a class="route" href="${BRAND.routeUrl}" target="_blank" rel="noopener">${ICON.route}Построить маршрут</a>
</section>`;
}

function repairTypeCard(t: RepairTypeView): string {
  const photos = t.photos.length
    ? `<div class="photos">${t.photos.map(src => `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`).join('')}</div>${t.photos.length > 1 ? '<p class="swipe">Листайте фото →</p>' : ''}`
    : '';
  const faq = t.faq.length
    ? `<div class="faq">${t.faq.map(f => `<details><summary>${escapeHtml(f.question)}</summary><div>${textToHtml(f.answer)}</div></details>`).join('')}</div>`
    : '';
  const links = t.links.length
    ? `<div class="links">${t.links.map(l => `<a class="chip" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.title)}${ICON.arrow}</a>`).join('')}</div>`
    : '';
  return `<section class="card work">
  <div class="label">Что предстоит</div>
  <h2>${escapeHtml(t.name)}</h2>
  ${photos}
  ${t.description ? `<div class="desc">${textToHtml(t.description)}</div>` : ''}
  ${faq}
  ${links}
</section>`;
}

export function renderRecordPage(v: RecordPageView): string {
  const photo = v.car.photoUrl
    ? `<div class="hero__photo" style="background-image:url('${escapeHtml(v.car.photoUrl)}')"></div>`
    : '<div class="hero__photo hero__photo--empty"></div>';
  const body = `
<header class="hero">
  ${photo}
  <div class="top">
    <a class="logo" href="${BRAND.site}" target="_blank" rel="noopener" aria-label="Prime Auto">${v.logoSvg}</a>
    <span class="badge">${ICON.check}Вы записаны</span>
  </div>
  <p class="hello">Здравствуйте,</p>
  <h1 class="name">${escapeHtml(v.clientName)}</h1>
  <div class="car">${escapeHtml(v.car.title)}${v.car.details ? `<small>${escapeHtml(v.car.details)}</small>` : ''}</div>
</header>
<main>
  <a class="card when" href="${escapeHtml(v.calendar.icsHref)}" aria-label="Добавить запись в календарь">
    <div class="when__date"><span class="when__num">${escapeHtml(v.when.dayNumber)}</span><span class="when__month">${escapeHtml(v.when.month)}</span></div>
    <div class="when__info">
      <div class="when__weekday">${escapeHtml(v.when.weekday)}</div>
      <div class="when__time">в <b>${escapeHtml(v.when.time)}</b></div>
      <div class="when__add">${ICON.calendarPlus}Добавить в календарь</div>
    </div>
  </a>
  <a class="when-alt" href="${escapeHtml(v.calendar.googleHref)}" target="_blank" rel="noopener">или в Google Календарь</a>

  <section class="card">
    <div class="label">Ваша запись</div>
    <h2>Вы записаны на услуги по своему авто</h2>
    ${v.services.length
    ? `<ul class="services">${v.services.map(s => `<li><i>${ICON.check}</i>${escapeHtml(s)}</li>`).join('')}</ul>`
    : '<p class="muted">Список услуг уточнит мастер-приёмщик.</p>'}
  </section>
  ${v.repairTypes.map(repairTypeCard).join('\n')}
  ${contactsCard()}
</main>
<footer>${v.logoSvg}<a href="${BRAND.site}" target="_blank" rel="noopener">prime-auto.by</a></footer>
${ctaBar()}`;
  return page('Ваша запись — Prime Auto', body);
}

/** Запись закрыта, отменена или ссылка неверная — без подробностей, чтобы не подсказывать перебор */
export function renderGonePage(v: GonePageView): string {
  const body = `
<div class="gone">
  <a class="logo" href="${BRAND.site}" aria-label="Prime Auto">${v.logoSvg}</a>
  <section class="card">
    <div class="label">Prime Auto</div>
    <h2>Страница больше недоступна</h2>
    <p class="muted">Запись уже завершена или ссылка устарела. Спасибо, что выбрали нас!</p>
    <div class="links"><a class="chip" href="${BRAND.site}">Перейти на prime-auto.by${ICON.arrow}</a></div>
  </section>
  ${contactsCard()}
</div>
${ctaBar()}`;
  return page('Prime Auto', body);
}
