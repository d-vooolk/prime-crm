import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { generatePublicToken, isPublicTokenFormat } from '../utils/publicToken';
import { photoUrl, RepairTypeFaqItem, RepairTypeLink } from './repairTypes.service';
import type { RecordPageView, GonePageView } from '../utils/publicRecordPage';

const TZ = 'Europe/Minsk';

/** «пятница, 17 октября» и «10:00» по минскому времени */
function formatWhen(date: Date) {
  const day = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  return { day, time };
}

const jsonArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export type PublicRecordResult =
  | { kind: 'page'; view: RecordPageView }
  | { kind: 'gone'; view: GonePageView };

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

  async getPage(token: string): Promise<PublicRecordResult> {
    const company = await prisma.companySettings.findFirst({ select: { name: true, phone: true, actualAddress: true } });
    const companyView = {
      name: company?.name || 'Prime Auto',
      phone: company?.phone || null,
      address: company?.actualAddress || null,
    };

    const record = isPublicTokenFormat(token)
      ? await prisma.record.findUnique({
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
      })
      : null;

    if (!record || record.status !== 'ACTIVE') {
      return { kind: 'gone', view: { company: companyView } };
    }

    // Блок каждого типа ремонта — один раз, в порядке справочника
    const types = new Map<string, NonNullable<typeof record.items[number]['service']['repairType']>>();
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
    const view: RecordPageView = {
      clientName: record.client.name,
      when: formatWhen(record.scheduledAt),
      car: {
        title: `${car.brand} ${car.model}`.trim(),
        details: [car.generationName, car.year].filter(Boolean).join(' · '),
        photoUrl: car.generationId ? `/api/cars/photo/${encodeURIComponent(car.brandId)}/${encodeURIComponent(car.modelId)}/${encodeURIComponent(car.generationId)}` : null,
      },
      services: record.items.map(i => (i.quantity > 1 ? `${i.service.name} × ${i.quantity}` : i.service.name)),
      repairTypes,
      company: companyView,
    };
    return { kind: 'page', view };
  },
};
