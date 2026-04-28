import { prisma } from '../prisma/client';

type NotePriority = 'LOW' | 'MEDIUM' | 'HIGH';

interface NoteCreateData {
  text: string;
  date?: string | null;
  allDay: boolean;
  time?: string | null;
  repeat?: string | null;
  priority: NotePriority;
}

interface NoteUpdateData {
  text?: string;
  date?: string | null;
  allDay?: boolean;
  time?: string | null;
  repeat?: string | null;
  priority?: NotePriority;
  isDone?: boolean;
}

export const notesService = {
  async getAll(servicemanId: string, archive: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any).note.findMany({
      where: { servicemanId, isDone: archive },
      orderBy: archive ? { doneAt: 'desc' } : { createdAt: 'desc' },
      include: { serviceman: { select: { id: true, name: true } } },
    });
  },

  async create(servicemanId: string, data: NoteCreateData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any).note.create({
      data: {
        servicemanId,
        text: data.text,
        date: data.date ? new Date(data.date) : null,
        allDay: data.allDay,
        time: data.time ?? null,
        repeat: data.repeat ?? null,
        priority: data.priority,
      },
    });
  },

  async update(id: string, requesterId: string, isCreator: boolean, data: NoteUpdateData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await (prisma as any).note.findUnique({ where: { id } });
    if (!note) {
      const err = new Error('Not found');
      (err as NodeJS.ErrnoException).code = '404';
      throw err;
    }
    if (!isCreator && note.servicemanId !== requesterId) {
      const err = new Error('Forbidden');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (data.text !== undefined) updateData.text = data.text;
    if ('date' in data) updateData.date = data.date ? new Date(data.date) : null;
    if (data.allDay !== undefined) updateData.allDay = data.allDay;
    if ('time' in data) updateData.time = data.time ?? null;
    if ('repeat' in data) updateData.repeat = data.repeat ?? null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isDone !== undefined) {
      updateData.isDone = data.isDone;
      updateData.doneAt = data.isDone ? new Date() : null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any).note.update({ where: { id }, data: updateData });
  },

  async delete(id: string, requesterId: string, isCreator: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await (prisma as any).note.findUnique({ where: { id } });
    if (!note) {
      const err = new Error('Not found');
      (err as NodeJS.ErrnoException).code = '404';
      throw err;
    }
    if (!isCreator && note.servicemanId !== requesterId) {
      const err = new Error('Forbidden');
      (err as NodeJS.ErrnoException).code = '403';
      throw err;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any).note.delete({ where: { id } });
  },
};
