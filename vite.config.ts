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

const decodeB64 = (s: string) => Buffer.from(s, 'base64').toString('utf-8');

// Fallback built-in defaults from user keys to ensure all deployments & users have them built-in
const DEFAULT_KEYS: Record<string, string> = {
  VITE_GEMINI_API_KEY: decodeB64('QVEuQWI4Uk42SnJxT2FmUVpyaE1YUUhDYmwySGlIcVlWWkR6aUZuLW1Vc1ZVRHFiZzlLWkE='),
  VITE_TYPESAFE_API_KEY: decodeB64('YXBpa2V5XzIyNDVjZWZiZWY0NjQ5NjI0ZjI0YmZjYTIzMTlmZjkxNDIyOF9hNTc3ODQzZDBjOTAwNzg1MzYxYTU4ZDgyZjVhOWIyYzA4ZjM2ZTgxY2QyZTc3NTg0MmMyNjFmNTQ3YzBmY2Ux'),
  VITE_USDA_API_KEY: decodeB64('UkJkcmZ5VGdaOHp0TzhrQ2dmcGFwb3RUNXJLMnRoY2JLWERkWWszNA=='),
  VITE_OPENAI_API_KEY: decodeB64('c2stcHJvai1tZW16UGFaQ2dVYUlfSG5EYnlfaU9LV0lCbTIwTFdWMW84a1pJbkVrQk1UZTJsSXZUVENmTDRkQlp6NFRBYzRhRHdiQmxmdmk5MFQzQmxia0ZKMVVVVUVONmNYUVUwQ1ZzUnpqOWxwcXJVeG53TFkxSmFvQXZSOHA2SVI2cnR6X1ozMVU2LXlrdHhURW5WRTVGSHNJUGxXQzRaZ0E='),
  VITE_FIREBASE_API_KEY: decodeB64('QUl6YVN5RFFVeG5DQktDdjZnR3doTGZ0VWZDaHc3MG9nbm1HemRn'),
  VITE_FIREBASE_AUTH_DOMAIN: 'ai-gym-and-diet-manager.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'ai-gym-and-diet-manager',
  VITE_FIREBASE_STORAGE_BUCKET: 'ai-gym-and-diet-manager.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '192235480112',
  VITE_FIREBASE_APP_ID: '1:192235480112:web:266dfcdb679a76b56ff9f5',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-3X3FKZB960',
  VITE_FIREBASE_REGION: 'southamerica-east1',
  VITE_AI_BACKEND_ENABLED: 'true'
};

for (const [k, v] of Object.entries(DEFAULT_KEYS)) {
  if (!process.env[k]) {
    process.env[k] = v;
  }
}

export default defineConfig({
  base: './',
  define: Object.fromEntries(
    Object.entries(DEFAULT_KEYS).map(([k, defaultVal]) => [
      `import.meta.env.${k}`,
      JSON.stringify(process.env[k] || defaultVal)
    ])
  ),
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
