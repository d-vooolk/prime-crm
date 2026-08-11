import { SmsType } from '@prisma/client';
import { prisma } from '../prisma/client';
import { smsBy } from './smsby.provider';

const pad = (n: number) => String(n).padStart(2, '0');

const formatDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

interface TemplateVars {
  clientName: string;
  date: string;
  time: string;
  carBrand: string;
  carModel: string;
  plateNumber: string;
  companyName: string;
  services: string;
}

// Закрывающую скобку вне квантификатора экранировать не нужно — \} избыточно.
const PLACEHOLDER = /\{\{(\w+)}}/g;

const applyTemplate = (template: string, vars: TemplateVars) => {
  const values: Record<string, string> = {
    ...vars,
    // Гос. номер подставляется в скобках и только если он заполнен
    plateNumber: vars.plateNumber ? ` (${vars.plateNumber})` : '',
  };
  // Неизвестный плейсхолдер остаётся в тексте как есть — как и раньше
  return template.replace(PLACEHOLDER, (match, key: string) => values[key] ?? match);
};

/**
 * Типы, которые отправляются не более одного раза за всю жизнь записи.
 * Запрос отзыва уходит при закрытии сделки, а сделку можно закрывать
 * и редактировать многократно — клиент не должен получить его дважды.
 */
const ONCE_PER_RECORD: SmsType[] = ['REVIEW_REQUEST'];

export type SendResult = 'sent' | 'failed' | 'skipped' | 'disabled';

export const smsService = {
  async sendForRecord(recordId: string, type: SmsType): Promise<SendResult> {
    try {
      const settings = await prisma.smsSettings.findFirst();
      if (!settings?.enabled || !settings.token) return 'disabled';

      if (ONCE_PER_RECORD.includes(type)) {
        const already = await prisma.smsLog.findFirst({
          where: { recordId, type, status: 'sent' },
          select: { id: true },
        });
        if (already) return 'skipped';
      }

      const record = await prisma.record.findUnique({
        where: { id: recordId },
        include: { client: true, car: true, items: { include: { service: true } } },
      });
      if (!record) return 'failed';

      const companyCfg = await prisma.companySettings.findFirst();
      const templateMap = {
        ON_CREATE: settings.onCreateTemplate,
        REMINDER: settings.reminderTemplate,
        CAR_READY: settings.carReadyTemplate,
        REVIEW_REQUEST: settings.reviewRequestTemplate,
      };
      const template = templateMap[type];
      const services = record.items.map(i => i.service.name).join(', ');
      const message = applyTemplate(template, {
        clientName: record.client.name,
        date: formatDate(record.scheduledAt),
        time: formatTime(record.scheduledAt),
        carBrand: record.car.brand,
        carModel: record.car.model,
        plateNumber: record.car.plateNumber || '',
        companyName: companyCfg?.name || '',
        services,
      });

      const phone = record.client.phone;
      let status = 'sent';
      let externalId: string | null = null;
      let error: string | null = null;

      try {
        externalId = await smsBy.sendQuickSMS(settings.token, phone, message, settings.alphanameId) || null;
      } catch (e) {
        status = 'failed';
        error = e instanceof Error ? e.message : String(e);
      }

      await prisma.smsLog.create({
        data: { recordId, type, phone, message, status, externalId, error },
      });
      return status === 'sent' ? 'sent' : 'failed';
    } catch (e) {
      console.error('[SMS] sendForRecord error:', e); // eslint-disable-line no-console
      return 'failed';
    }
  },

  /** Проверка подключения: баланс + список одобренных альфа-имён. */
  async checkConnection(tokenOverride?: string) {
    const settings = await prisma.smsSettings.findFirst();
    const token = tokenOverride || settings?.token;
    if (!token) throw new Error('Не указан токен sms.by');

    const balance = await smsBy.getBalance(token);
    // Отсутствие альфа-имён — не ошибка подключения, поэтому глушим
    const alphanames = await smsBy.getAlphanames(token).catch(() => []);
    return { ...balance, alphanames };
  },

  /** Тестовая отправка на произвольный номер (в лог записей не пишется). */
  async sendTest(phone: string, message: string) {
    const settings = await prisma.smsSettings.findFirst();
    if (!settings?.token) throw new Error('Не указан токен sms.by');
    const smsId = await smsBy.sendQuickSMS(settings.token, phone, message, settings.alphanameId);
    return { smsId };
  },

  async runReminderCheck() {
    try {
      const settings = await prisma.smsSettings.findFirst();
      if (!settings?.enabled) return;

      const now = Date.now();
      // Window: от 23ч 50мин до 24ч 10мин — чтобы не пропустить при шаге 5 минут
      const from = new Date(now + 23 * 60 * 60 * 1000 + 50 * 60 * 1000);
      const to   = new Date(now + 24 * 60 * 60 * 1000 + 10 * 60 * 1000);

      const records = await prisma.record.findMany({
        where: {
          status: 'ACTIVE',
          scheduledAt: { gte: from, lte: to },
          smsLogs: { none: { type: 'REMINDER' } },
        },
        select: { id: true },
      });

      for (const r of records) {
        await smsService.sendForRecord(r.id, 'REMINDER');
      }
    } catch (e) {
      console.error('[SMS] runReminderCheck error:', e); // eslint-disable-line no-console
    }
  },
};
