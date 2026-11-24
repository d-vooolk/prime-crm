import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';

export interface ContactData {
  name: string;
  phone?: string | null;
  comment?: string | null;
}

/** Полезные контакты компании: общий список для менеджеров и выше */
export const contactsService = {
  async list() {
    return prisma.contact.findMany({ orderBy: { name: 'asc' } });
  },

  async create(data: ContactData) {
    return prisma.contact.create({
      data: { name: data.name, phone: data.phone ?? null, comment: data.comment ?? null },
    });
  },

  async update(id: string, data: Partial<ContactData>) {
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new AppError('Контакт не найден', 404);
    return prisma.contact.update({ where: { id }, data });
  },

  async delete(id: string) {
    const { count } = await prisma.contact.deleteMany({ where: { id } });
    if (!count) throw new AppError('Контакт не найден', 404);
  },
};
