import { defineConfig } from 'prisma/config';

// datasource.url обязателен: в schema.prisma у блока datasource нет url,
// подключение задаётся только отсюда.
//
// Раньше здесь был ещё блок `migrate: { adapter }` с PrismaPg. В Prisma 7.7
// такого ключа в PrismaConfig нет — CLI молча его игнорировал, а типы ругались.
// Проверено, что db push без него отрабатывает и на пустом diff, и на реальном
// изменении схемы. PrismaPg по-прежнему используется рантаймом
// в src/prisma/client.ts — там адаптер нужен.
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
