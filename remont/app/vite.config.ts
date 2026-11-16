/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Многостраничная сборка: лендинг, кабинет клиента, панель владельца, политика.
// Собираем прямо в remont/ — так GitHub Pages отдаёт /remont/, /remont/cabinet/, /remont/admin/.
export default defineConfig({
  base: './',
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: '../',
    emptyOutDir: false,
    assetsDir: 'static',
    target: 'es2019',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        cabinet: path.resolve(__dirname, 'cabinet/index.html'),
        admin: path.resolve(__dirname, 'admin/index.html'),
        privacy: path.resolve(__dirname, 'privacy/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
