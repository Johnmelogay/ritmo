import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// Load environment from API_KEYS.env, .env.local, and .env
for (const envFile of ['API_KEYS.env', '.env.local', '.env']) {
  const full = path.resolve(rootDir, envFile);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full });
  }
}

// Find user UID: from env, from .recovery/result.json, or fallback
let userUid = process.env.RITMO_USER_UID || process.env.USER_UID || '';
if (!userUid) {
  try {
    const recoveryPath = path.resolve(rootDir, '.recovery/result.json');
    if (fs.existsSync(recoveryPath)) {
      const data = JSON.parse(fs.readFileSync(recoveryPath, 'utf-8'));
      if (data.uid) userUid = data.uid;
    }
  } catch {}
}

// Default fallback UID from verified recovery
if (!userUid) {
  userUid = 'Qz4Hmsmav2hXCBZgX1dA1STMfU82';
}

export const CONFIG = {
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
  firebaseProjectId: process.env.VITE_FIREBASE_PROJECT_ID || 'ai-gym-and-diet-manager',
  userUid,
  serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '../serviceAccountKey.json'),
  authDir: path.resolve(__dirname, '../auth_info'),
  rootDir
};
