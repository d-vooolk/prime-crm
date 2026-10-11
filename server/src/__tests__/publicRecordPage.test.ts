import { describe, it, expect } from 'vitest';
import { escapeHtml, textToHtml, telHref, renderRecordPage, renderGonePage, RecordPageView, BRAND } from '../utils/publicRecordPage';
import { generatePublicToken, isPublicTokenFormat } from '../utils/publicToken';
import { buildIcs, escapeIcsText, foldIcsLine, formatIcsDate, googleCalendarUrl, CalendarEvent } from '../utils/recordCalendar';

const LOGO = '<svg data-test="logo"></svg>';

const view = (over: Partial<RecordPageView> = {}): RecordPageView => ({
  clientName: 'Иванов Иван',
  when: { weekday: 'пятница', dayNumber: '17', month: 'окт', time: '10:00' },
  calendar: { icsHref: 'abc/calendar.ics', googleHref: 'https://calendar.google.com/calendar/render?x=1' },
  car: { title: 'BMW X5', details: 'G05 · 2020', photoUrl: '/api/cars/photo/1/2/3' },
  services: ['Замена линз', 'Полировка фар × 2'],
  repairTypes: [],
  logoSvg: LOGO,
  ...over,
});

describe('страница записи — экранирование', () => {
  it('escapeHtml экранирует опасные символы', () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
  });

  it('textToHtml: абзацы и переносы, без HTML из текста', () => {
    expect(textToHtml('Первый\nвторой\n\n<b>Третий</b>')).toBe('<p>Первый<br>второй</p><p>&lt;b&gt;Третий&lt;/b&gt;</p>');
    expect(textToHtml('   ')).toBe('');
  });

  it('telHref оставляет только цифры и плюс', () => {
    expect(telHref('+375 (29) 123-45-67')).toBe('tel:+375291234567');
  });

  it('имя клиента и тексты справочника не превращаются в разметку', () => {
    const html = renderRecordPage(view({
      clientName: '<img src=x onerror=alert(1)>',
      repairTypes: [{
        name: 'Ремонт <фар>',
        description: 'Описание',
        photos: ['/api/uploads/repair-types/a.webp'],
        faq: [{ question: 'Сколько <длится>?', answer: 'День' }],
        links: [{ title: 'Подробнее', url: 'https://prime-auto.by/"onmouseover="x' }],
      }],
    }));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Ремонт &lt;фар&gt;');
    expect(html).toContain('href="https://prime-auto.by/&quot;onmouseover=&quot;x"');
    expect(html).not.toContain('<script');
  });
});

describe('страница записи — содержимое', () => {
  it('логотип, приветствие, авто, дата и услуги', () => {
    const html = renderRecordPage(view());
    expect(html).toContain(LOGO);
    expect(html).toContain('Иванов Иван');
    expect(html).toContain('BMW X5');
    expect(html).toContain('<span class="when__num">17</span>');
    expect(html).toContain('Полировка фар × 2');
    expect(html).toContain("background-image:url('/api/cars/photo/1/2/3')");
    expect(html).toContain('name="robots" content="noindex,nofollow"');
  });

  it('дата добавляет событие в календарь', () => {
    const html = renderRecordPage(view());
    expect(html).toContain('class="card when" href="abc/calendar.ics"');
    expect(html).toContain('href="https://calendar.google.com/calendar/render?x=1"');
  });

  it('панель связи и контакты как на prime-auto.by', () => {
    const html = renderRecordPage(view());
    expect(html).toContain(`href="${telHref(BRAND.phone)}"`);
    expect(html).toContain(`href="${BRAND.telegram}"`);
    expect(html).toContain(`href="${BRAND.viber}"`);
    expect(html).toContain(`href="${BRAND.routeUrl}"`);
    expect(html).toContain('Построить маршрут');
    expect(html).toContain(`href="${BRAND.mapUrl}"`);
  });

  it('без фото авто — запасной фон', () => {
    const html = renderRecordPage(view({ car: { title: 'Lada', details: '', photoUrl: null } }));
    expect(html).toContain('hero__photo--empty');
    expect(html).not.toContain('background-image');
  });

  it('блок типа ремонта: фото, вопросы, ссылки', () => {
    const html = renderRecordPage(view({
      repairTypes: [{
        name: 'Замена линз',
        description: 'Ставим билинзы',
        photos: ['/api/uploads/repair-types/a.webp', '/api/uploads/repair-types/b.webp'],
        faq: [{ question: 'Гарантия?', answer: '2 года' }],
        links: [{ title: 'Наши работы', url: 'https://prime-auto.by/works' }],
      }],
    }));
    expect(html).toContain('<h2>Замена линз</h2>');
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('<summary>Гарантия?</summary>');
    expect(html).toContain('href="https://prime-auto.by/works"');
  });

  it('страница завершённой записи не показывает данных записи', () => {
    const html = renderGonePage({ logoSvg: LOGO });
    expect(html).toContain('Страница больше недоступна');
    expect(html).not.toContain('Иванов');
  });
});

describe('событие для календаря', () => {
  const event: CalendarEvent = {
    uid: 'abc@zapis.prime-auto.by',
    start: new Date('2026-10-17T07:00:00Z'),
    end: new Date('2026-10-17T08:30:00Z'),
    title: 'Prime Auto — BMW X5',
    description: 'Услуги: Замена линз, Полировка фар\nТелефон: +375',
    location: 'Prime Auto, Минск, Брилевский тупик, 5',
    url: 'https://zapis.prime-auto.by/abc',
  };

  it('дата в UTC', () => {
    expect(formatIcsDate(event.start)).toBe('20261017T070000Z');
  });

  it('экранирование текста', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('длинные строки переносятся не длиннее 75 байт', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'ж'.repeat(100)}`);
    for (const line of folded.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(`DESCRIPTION:${'ж'.repeat(100)}`);
  });

  it('файл .ics с событием и напоминанием', () => {
    const ics = buildIcs(event, new Date('2026-10-11T00:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261017T070000Z');
    expect(ics).toContain('DTEND:20261017T083000Z');
    expect(ics).toContain('LOCATION:Prime Auto\\, Минск\\, Брилевский тупик\\, 5');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('ссылка Google Календаря', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261017T070000Z/20261017T083000Z');
    expect(url.searchParams.get('text')).toBe('Prime Auto — BMW X5');
  });
});

describe('код страницы записи', () => {
  it('12 букв и цифр, каждый раз новый', () => {
    const a = generatePublicToken();
    const b = generatePublicToken();
    expect(a).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(a).not.toBe(b);
    expect(isPublicTokenFormat(a)).toBe(true);
  });

  it('формат кода: отсекает мусор', () => {
    expect(isPublicTokenFormat('abc')).toBe(false);
    expect(isPublicTokenFormat('abcdef12345/')).toBe(false);
    expect(isPublicTokenFormat('0a1b2c3d4e5f')).toBe(true); // код из миграции (hex)
  });
});
