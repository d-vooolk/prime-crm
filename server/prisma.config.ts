import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 при наличии этого файла больше не подхватывает .env сам, поэтому DATABASE_URL
// для CLI (migrate dev/deploy) грузим здесь — так же, как рантайм в src/index.ts.
// В контейнере переменные уже есть в process.env (из compose); dotenv их не перезаписывает,
// а отсутствующий файл просто игнорирует.
dotenv.config({ path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`) });
dotenv.config(); // запасной .env, если есть

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
