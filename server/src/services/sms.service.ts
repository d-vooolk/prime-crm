import { prisma } from '../prisma/client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RocketSMS = require('node-rocketsms-api') as new (opts: { username: string; password: string }) => {
  send: (phone: string, message: string, test: boolean) => Promise<{ id?: string | number }>;
};

const pad = (n: number) => String(n).padStart(2, '0');

const formatDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const applyTemplate = (
  template: string,
  vars: { clientName: string; date: string; time: string; carBrand: string; carModel: string; plateNumber: string; companyName: string; services: string },
) =>
  template
    .replace(/\{\{clientName\}\}/g, vars.clientName)
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{time\}\}/g, vars.time)
    .replace(/\{\{carBrand\}\}/g, vars.carBrand)
    .replace(/\{\{carModel\}\}/g, vars.carModel)
    .replace(/\{\{plateNumber\}\}/g, vars.plateNumber ? ` (${vars.plateNumber})` : '')
    .replace(/\{\{companyName\}\}/g, vars.companyName)
    .replace(/\{\{services\}\}/g, vars.services);

export const smsService = {
  async sendForRecord(recordId: string, type: 'ON_CREATE' | 'REMINDER' | 'CAR_READY' | 'REVIEW_REQUEST') {
    try {
      const settings = await prisma.smsSettings.findFirst();
      if (!settings?.enabled || !settings.username || !settings.password) return;

      const record = await prisma.record.findUnique({
        where: { id: recordId },
        include: { client: true, car: true, items: { include: { service: true } } },
      });
      if (!record) return;

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
        const client = new RocketSMS({ username: settings.username, password: settings.password });
        const result = await client.send(phone, message, false);
        externalId = result?.id != null ? String(result.id) : null;
      } catch (e) {
        status = 'failed';
        error = e instanceof Error ? e.message : String(e);
      }

      await prisma.smsLog.create({
        data: { recordId, type, phone, message, status, externalId, error },
      });
    } catch (e) {
      console.error('[SMS] sendForRecord error:', e); // eslint-disable-line no-console
    }
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
