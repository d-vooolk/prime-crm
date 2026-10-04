import { defineConfig } from 'vitest/config';

// Юнит-тесты чистой логики сервера (без базы): src/**/*.test.ts
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Клиент Prisma создаётся при импорте сервисов, но в юнит-тестах к базе не подключается
    env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' },
  },
});
