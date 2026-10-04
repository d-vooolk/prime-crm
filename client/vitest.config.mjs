import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Юнит-тесты чистой логики (utils и вынесенные расчёты); алиас '@' — как в webpack/tsconfig
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
