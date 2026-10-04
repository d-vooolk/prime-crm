import { prisma } from '../prisma/client';

/** Категории и услуги прайса */
export const catalogService = {
  /** Категории с активными услугами и популярностью каждой услуги */
  async listCategories() {
    const [categories, usage] = await Promise.all([
      prisma.category.findMany({
        include: { services: { where: { isActive: true }, orderBy: { name: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
      // Популярность услуги — сколько раз её добавляли в неотменённые записи
      prisma.recordItem.groupBy({
        by: ['serviceId'],
        where: { record: { status: { not: 'CANCELLED' } } },
        _count: { _all: true },
      }),
    ]);
    const usageById = new Map(usage.map(u => [u.serviceId, u._count._all]));
    return categories.map(c => ({
      ...c,
      services: c.services.map(s => ({ ...s, usageCount: usageById.get(s.id) ?? 0 })),
    }));
  },

  createCategory(data: { name: string; color?: string | null }) {
    return prisma.category.create({ data: { name: data.name, color: data.color ?? null } });
  },

  updateCategory(id: string, data: { name?: string; color?: string | null; customPercent?: number | null }) {
    return prisma.category.update({ where: { id }, data });
  },

  deleteCategory(id: string) {
    return prisma.category.delete({ where: { id } });
  },

  createService(data: {
    name: string; categoryId: string; standardPrice: number; estimatedTime: number;
    hasEquipment?: boolean; isProduct?: boolean; customPercent?: number | null;
  }) {
    return prisma.service.create({ data, include: { category: true } });
  },

  updateService(id: string, data: Partial<{
    name: string; categoryId: string; standardPrice: number; estimatedTime: number;
    hasEquipment: boolean; isProduct: boolean; customPercent: number | null;
  }>) {
    return prisma.service.update({ where: { id }, data, include: { category: true } });
  },

  /** Услуга не удаляется (на неё ссылаются записи), а скрывается из прайса */
  deactivateService(id: string) {
    return prisma.service.update({ where: { id }, data: { isActive: false } });
  },
};
