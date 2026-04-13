import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Категории услуг
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Ремонт фар' },
      update: {},
      create: { name: 'Ремонт фар' },
    }),
    prisma.category.upsert({
      where: { name: 'Тонировка' },
      update: {},
      create: { name: 'Тонировка' },
    }),
    prisma.category.upsert({
      where: { name: 'Полировка' },
      update: {},
      create: { name: 'Полировка' },
    }),
    prisma.category.upsert({
      where: { name: 'Оклейка' },
      update: {},
      create: { name: 'Оклейка' },
    }),
    prisma.category.upsert({
      where: { name: 'Диагностика' },
      update: {},
      create: { name: 'Диагностика' },
    }),
  ]);

  const [headlights, tinting, polishing, wrapping, diagnostics] = categories;

  // Услуги
  await Promise.all([
    // Ремонт фар
    prisma.service.create({
      data: {
        name: 'Замена линз (1 фара)',
        categoryId: headlights.id,
        standardPrice: 5000,
        estimatedTime: 180,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Замена линз (2 фары)',
        categoryId: headlights.id,
        standardPrice: 9000,
        estimatedTime: 300,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Полировка стекла фары',
        categoryId: headlights.id,
        standardPrice: 1500,
        estimatedTime: 60,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Восстановление герметичности фары',
        categoryId: headlights.id,
        standardPrice: 2000,
        estimatedTime: 90,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Замена ламп (комплект)',
        categoryId: headlights.id,
        standardPrice: 1200,
        estimatedTime: 30,
      },
    }),
    // Тонировка
    prisma.service.create({
      data: {
        name: 'Тонировка передних стёкол',
        categoryId: tinting.id,
        standardPrice: 3000,
        estimatedTime: 120,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Тонировка задних стёкол',
        categoryId: tinting.id,
        standardPrice: 4000,
        estimatedTime: 150,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Тонировка полный комплект',
        categoryId: tinting.id,
        standardPrice: 6500,
        estimatedTime: 240,
      },
    }),
    // Полировка
    prisma.service.create({
      data: {
        name: 'Полировка кузова (локальная)',
        categoryId: polishing.id,
        standardPrice: 2500,
        estimatedTime: 120,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Полировка кузова (полная)',
        categoryId: polishing.id,
        standardPrice: 8000,
        estimatedTime: 360,
      },
    }),
    // Оклейка
    prisma.service.create({
      data: {
        name: 'Антигравийная плёнка (капот)',
        categoryId: wrapping.id,
        standardPrice: 7000,
        estimatedTime: 180,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Виниловая оклейка (элемент)',
        categoryId: wrapping.id,
        standardPrice: 3000,
        estimatedTime: 120,
      },
    }),
    // Диагностика
    prisma.service.create({
      data: {
        name: 'Диагностика оптики',
        categoryId: diagnostics.id,
        standardPrice: 500,
        estimatedTime: 30,
      },
    }),
  ]);

  // Мастера
  await Promise.all([
    prisma.serviceman.upsert({
      where: { name: 'Волк Дмитрий Иванович' },
      update: {},
      create: { name: 'Волк Дмитрий Иванович' },
    }),
    prisma.serviceman.upsert({
      where: { name: 'Петкевич Артём Леонидович' },
      update: {},
      create: { name: 'Петкевич Артём Леонидович' },
    }),
  ]);

  // Оборудование
  await Promise.all([
    prisma.equipment.upsert({
      where: { name: 'Sanvi F50' },
      update: {},
      create: { name: 'Sanvi F50' },
    }),
    prisma.equipment.upsert({
      where: { name: 'Aozoom A17' },
      update: {},
      create: { name: 'Aozoom A17' },
    }),
    prisma.equipment.upsert({
      where: { name: 'Mtf Light Round' },
      update: {},
      create: { name: 'Mtf Light Round' },
    }),
    prisma.equipment.upsert({
      where: { name: 'Hella 3R' },
      update: {},
      create: { name: 'Hella 3R' },
    }),
    prisma.equipment.upsert({
      where: { name: 'Philips X-tremeUltinon LED' },
      update: {},
      create: { name: 'Philips X-tremeUltinon LED' },
    }),
  ]);

  // Настройки компании
  await prisma.companySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Prime Auto Service',
      address: '',
      phone: '',
    },
  });

  console.log('Seed завершён успешно');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
