import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@matinee/protocol': path.resolve(__dirname, '../../packages/protocol/src/index.ts'),
    },
  },
  test: {
    globals: true,
  },
});
