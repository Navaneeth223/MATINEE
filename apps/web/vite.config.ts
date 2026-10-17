import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://127.0.0.1:8788',
        ws: true,
      },
    },
  },
});
