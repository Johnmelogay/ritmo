import { localAiPlugin } from './dev/ai';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import { recoveryPlugin } from './dev/recovery';

// Automatically load API_KEYS.env if present into process.env
for (const keysFile of ['API_KEYS.env', '.env.deepseek']) {
const keysPath = path.resolve(__dirname, keysFile);
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
}


// Public Firebase defaults only. AI provider secrets stay in the Node backend.
const DEFAULT_KEYS: Record<string, string> = {
  VITE_FIREBASE_API_KEY: 'AIzaSyDQUxnCBKCv6gGwhLftUfChw70ognmGzdg',
  VITE_FIREBASE_AUTH_DOMAIN: 'ai-gym-and-diet-manager.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'ai-gym-and-diet-manager',
  VITE_FIREBASE_STORAGE_BUCKET: 'ai-gym-and-diet-manager.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '192235480112',
  VITE_FIREBASE_APP_ID: '1:192235480112:web:266dfcdb679a76b56ff9f5',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-3X3FKZB960',
  VITE_FIREBASE_REGION: 'southamerica-east1',
  VITE_AI_BACKEND_ENABLED: 'true',
};

for (const [k, v] of Object.entries(DEFAULT_KEYS)) {
  if (!process.env[k]) {
    process.env[k] = v;
  }
}

export default defineConfig({
  envPrefix: ['VITE_FIREBASE_', 'VITE_RECAPTCHA_', 'VITE_AI_BACKEND_', 'VITE_USE_FIREBASE_'],
  base: './',
  define: Object.fromEntries(
    Object.entries(DEFAULT_KEYS).map(([k, defaultVal]) => [
      `import.meta.env.${k}`,
      JSON.stringify(process.env[k] || defaultVal)
    ])
  ),
  server: {
    watch: { ignored: ['**/node_modules.icloud-backup/**', '**/.archive/**'] },
  },
  optimizeDeps: { entries: ['index.html'] },
  plugins: [localAiPlugin(), recoveryPlugin(), react(), VitePWA({
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
