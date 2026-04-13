import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';

export const clientsService = {
  async findAll(search?: string) {
    return prisma.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      include: {
        cars: true,
        _count: { select: { records: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async findByPhone(phone: string) {
    return prisma.client.findMany({
      where: { phone: { contains: phone } },
      include: { cars: true },
      take: 5,
    });
  },

  async findById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        cars: true,
        records: {
          include: {
            car: true,
            items: { include: { service: { include: { category: true } } } },
            deal: true,
          },
          orderBy: { scheduledAt: 'desc' },
        },
      },
    });
    if (!client) throw new AppError('Клиент не найден', 404);
    return client;
  },

  async create(data: { name: string; phone: string; notes?: string }) {
    const existing = await prisma.client.findUnique({ where: { phone: data.phone } });
    if (existing) throw new AppError('Клиент с таким номером уже существует', 409);
    return prisma.client.create({ data, include: { cars: true } });
  },

  async update(id: string, data: Partial<{ name: string; phone: string; notes: string }>) {
    await clientsService.findById(id);
    return prisma.client.update({
      where: { id },
      data,
      include: { cars: true },
    });
  },
};
