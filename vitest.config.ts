import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@ui': resolve(__dirname, 'src/ui'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/ui/**/*.test.ts'],
    globals: true,
  },
});
