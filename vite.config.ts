import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

// Automatically load API_KEYS.env if present into process.env
const keysPath = path.resolve(__dirname, 'API_KEYS.env');
if (fs.existsSync(keysPath)) {
  const lines = fs.readFileSync(keysPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (!process.env[k] && v) process.env[k] = v;
    }
  }
}

export default defineConfig({
  base: './',
  server: {
    watch: { ignored: ['**/node_modules.icloud-backup/**'] },
    proxy: {
      '/api/typesafe': {
        target: 'https://api.typesafe.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/typesafe/, '')
      }
    }
  },
  optimizeDeps: { entries: ['index.html'] },
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Ritmo — Treino e nutrição', short_name: 'Ritmo', lang: 'pt-BR',
      description: 'Seu treino, sua alimentação, no seu ritmo.',
      theme_color: '#245548', background_color: '#f7f8f5', display: 'standalone',
      start_url: './', scope: './',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], maximumFileSizeToCacheInBytes: 3000000, navigateFallback: 'index.html' }
  })],
  build: { rollupOptions: { output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'] } } } },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/node_modules.icloud-backup/**']
  }
});
