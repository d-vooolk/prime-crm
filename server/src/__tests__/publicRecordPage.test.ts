import { describe, it, expect } from 'vitest';
import { escapeHtml, textToHtml, telHref, renderRecordPage, renderGonePage, RecordPageView } from '../utils/publicRecordPage';
import { generatePublicToken, isPublicTokenFormat } from '../utils/publicToken';

const company = { name: 'Prime Auto', phone: '+375 (29) 123-45-67', address: 'Минск, ул. Примерная, 1' };

const view = (over: Partial<RecordPageView> = {}): RecordPageView => ({
  clientName: 'Иванов Иван',
  when: { day: 'пятница, 17 октября', time: '10:00' },
  car: { title: 'BMW X5', details: 'G05 · 2020', photoUrl: '/api/cars/photo/1/2/3' },
  services: ['Замена линз', 'Полировка фар × 2'],
  repairTypes: [],
  company,
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
  it('приветствие, авто, дата и услуги', () => {
    const html = renderRecordPage(view());
    expect(html).toContain('Иванов Иван');
    expect(html).toContain('BMW X5');
    expect(html).toContain('пятница, 17 октября');
    expect(html).toContain('<li>Полировка фар × 2</li>');
    expect(html).toContain("background-image:url('/api/cars/photo/1/2/3')");
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).toContain('href="tel:+375291234567"');
  });

  it('без фото авто — запасной фон', () => {
    const html = renderRecordPage(view({ car: { title: 'Lada', details: '', photoUrl: null } }));
    expect(html).toContain('hero hero--empty');
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
    const html = renderGonePage({ company });
    expect(html).toContain('Страница больше недоступна');
    expect(html).not.toContain('Иванов');
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
