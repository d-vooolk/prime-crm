import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { generatePublicToken, isPublicTokenFormat } from '../utils/publicToken';
import { photoUrl, RepairTypeFaqItem, RepairTypeLink } from './repairTypes.service';
import { BRAND, type RecordPageView } from '../utils/publicRecordPage';
import { buildIcs, googleCalendarUrl, type CalendarEvent } from '../utils/recordCalendar';

const TZ = 'Europe/Minsk';

/** Длительность события в календаре: по времени услуг, но не меньше 30 минут и не больше 8 часов */
const MIN_MINUTES = 30;
const DEFAULT_MINUTES = 60;
const MAX_MINUTES = 8 * 60;

/** «пятница», «17», «окт», «10:00» по минскому времени */
function whenParts(date: Date) {
  const part = (opts: Intl.DateTimeFormatOptions) => date.toLocaleString('ru-RU', { ...opts, timeZone: TZ });
  return {
    weekday: part({ weekday: 'long' }),
    dayNumber: part({ day: 'numeric' }),
    month: part({ month: 'short' }).replace('.', ''),
    time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
  };
}

const jsonArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

async function loadActiveRecord(token: string) {
  if (!isPublicTokenFormat(token)) return null;
  const record = await prisma.record.findUnique({
    where: { publicToken: token },
    select: {
      status: true,
      scheduledAt: true,
      client: { select: { name: true } },
      car: {
        select: {
          brand: true, model: true, brandId: true, modelId: true, generationId: true, generationName: true, year: true,
        },
      },
      items: {
        orderBy: { id: 'asc' },
        select: {
          quantity: true,
          service: {
            select: {
              name: true,
              estimatedTime: true,
              repairType: {
                select: {
                  id: true, name: true, description: true, faq: true, links: true, sortOrder: true,
                  photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { filename: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  return record && record.status === 'ACTIVE' ? record : null;
}

type ActiveRecord = NonNullable<Awaited<ReturnType<typeof loadActiveRecord>>>;

const serviceLines = (r: ActiveRecord) =>
  r.items.map(i => (i.quantity > 1 ? `${i.service.name} × ${i.quantity}` : i.service.name));

function calendarEvent(token: string, r: ActiveRecord): CalendarEvent {
  const minutes = r.items.reduce((sum, i) => sum + (i.service.estimatedTime || 0) * i.quantity, 0) || DEFAULT_MINUTES;
  const duration = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes));
  const carTitle = `${r.car.brand} ${r.car.model}`.trim();
  const services = serviceLines(r);
  return {
    uid: `${token}@zapis.prime-auto.by`,
    start: r.scheduledAt,
    end: new Date(r.scheduledAt.getTime() + duration * 60 * 1000),
    title: `Prime Auto — ${carTitle}`,
    description: [
      services.length ? `Услуги: ${services.join(', ')}` : '',
      `Телефон: ${BRAND.phone}`,
    ].filter(Boolean).join('\n'),
    location: `Prime Auto, ${BRAND.address}`,
    url: `${env.publicRecordUrl}/${token}`,
  };
}

/**
 * Страница записи для клиента (zapis.prime-auto.by/<код>). Ничего не хранится отдельно:
 * страница собирается из записи при каждом открытии. Запись закрыта или отменена — по ссылке
 * только «страница больше недоступна», поэтому старые страницы не копятся.
 */
export const publicRecordService = {
  /** Ссылка для SMS. У старых записей кода может не быть — создаём при первой отправке */
  async linkFor(record: { id: string; publicToken: string | null }): Promise<string> {
    let token = record.publicToken;
    if (!token) {
      token = generatePublicToken();
      await prisma.record.update({ where: { id: record.id }, data: { publicToken: token } });
    }
    return `${env.publicRecordUrl}/${token}`;
  },

  /** Данные страницы; null — запись не найдена, закрыта или отменена */
  async getPage(token: string, logoSvg: string): Promise<RecordPageView | null> {
    const record = await loadActiveRecord(token);
    if (!record) return null;

    // Блок каждого типа ремонта — один раз, в порядке справочника
    const types = new Map<string, NonNullable<ActiveRecord['items'][number]['service']['repairType']>>();
    for (const item of record.items) {
      const t = item.service.repairType;
      if (t && !types.has(t.id)) types.set(t.id, t);
    }
    const repairTypes = [...types.values()]
      .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.name.localeCompare(b.name, 'ru'))
      .map(t => ({
        name: t.name,
        description: t.description,
        photos: t.photos.map(p => photoUrl(p.filename)),
        faq: jsonArray<RepairTypeFaqItem>(t.faq).filter(f => f?.question && f?.answer),
        links: jsonArray<RepairTypeLink>(t.links).filter(l => l?.title && /^https?:\/\//i.test(l?.url ?? '')),
      }));

    const { car } = record;
    return {
      clientName: record.client.name,
      when: whenParts(record.scheduledAt),
      calendar: {
        // Относительная ссылка: работает и на zapis.prime-auto.by/<код>, и локально на /zapis/<код>
        icsHref: `${token}/calendar.ics`,
        googleHref: googleCalendarUrl(calendarEvent(token, record)),
      },
      car: {
        title: `${car.brand} ${car.model}`.trim(),
        details: [car.generationName, car.year].filter(Boolean).join(' · '),
        photoUrl: car.generationId ? `/api/cars/photo/${encodeURIComponent(car.brandId)}/${encodeURIComponent(car.modelId)}/${encodeURIComponent(car.generationId)}` : null,
      },
      services: serviceLines(record),
      repairTypes,
      logoSvg,
    };
  },

  /** Файл .ics для календаря; null — запись недоступна */
  async getCalendar(token: string): Promise<string | null> {
    const record = await loadActiveRecord(token);
    return record ? buildIcs(calendarEvent(token, record)) : null;
  },
};
