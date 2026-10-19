import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@matinee/protocol': path.resolve(__dirname, '../../packages/protocol/src/index.ts'),
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
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PORT ? `http://127.0.0.1:${process.env.VITE_API_PORT}` : 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_API_PORT ? `http://127.0.0.1:${process.env.VITE_API_PORT}` : 'http://127.0.0.1:8788',
        ws: true,
      },
    },
  },
});
