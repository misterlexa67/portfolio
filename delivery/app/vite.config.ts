/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Картинки живут в delivery/assets — рядом с собранным сайтом.
// В dev-режиме отдаём их тем же относительным путём, что и в проде.
const assetsDir = path.resolve(__dirname, '../assets');
const serveAssets = (): Plugin => ({
  name: 'serve-delivery-assets',
  configureServer(server) {
    server.middlewares.use('/assets', (req, res, next) => {
      const file = path.join(assetsDir, decodeURIComponent((req.url ?? '').split('?')[0]));
      if (!file.startsWith(assetsDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
      res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use('/assets', (req, res, next) => {
      const file = path.join(assetsDir, decodeURIComponent((req.url ?? '').split('?')[0]));
      if (!file.startsWith(assetsDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
      res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), serveAssets()],
  publicDir: false,
  build: {
    outDir: '../',
    emptyOutDir: false,
    assetsDir: 'static',
    target: 'es2019',
    cssCodeSplit: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
