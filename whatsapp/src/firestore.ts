import admin from 'firebase-admin';
import fs from 'node:fs';
import { CONFIG } from './config.js';
import { emptyState, stateSchema, type AppState, type Meal, type Session, type WaterLog, type AiMemory } from '../../src/domain.js';

let initialized = false;
let db: admin.firestore.Firestore | null = null;

export function getFirestoreDb(): admin.firestore.Firestore {
  if (db) return db;
  if (!initialized) {
    if (fs.existsSync(CONFIG.serviceAccountPath)) {
      try {
        const key = JSON.parse(fs.readFileSync(CONFIG.serviceAccountPath, 'utf-8'));
        admin.initializeApp({
          credential: admin.credential.cert(key),
          projectId: key.project_id || CONFIG.firebaseProjectId
        });
      } catch (e) {
        console.warn('Could not read serviceAccountKey.json, using default credentials:', e);
        admin.initializeApp({ projectId: CONFIG.firebaseProjectId });
      }
    } else {
      admin.initializeApp({ projectId: CONFIG.firebaseProjectId });
    }
    initialized = true;
  }
  db = admin.firestore();
  return db;
}

export interface RecordValue {
  kind: string;
  payload: unknown;
  updatedAt: string;
}

export function restoreAppState(items: RecordValue[], ownerUid: string): AppState {
  const next = emptyState();
  for (const item of items) {
    if (item.kind === 'profile') next.profile = item.payload as AppState['profile'];
    else if (item.kind === 'meta') Object.assign(next, item.payload);
    else if (['meals', 'plans', 'sessions', 'body', 'recovery'].includes(item.kind)) {
      (next[item.kind as 'meals'] as unknown[]).push(item.payload);
    }
  }
  return stateSchema.parse({ ...next, ownerUid, demo: false });
}

export async function fetchCurrentState(uid: string = CONFIG.userUid): Promise<AppState> {
  const firestore = getFirestoreDb();
  const snapshot = await firestore.collection(`users/${uid}/records`).get();
  if (snapshot.empty) {
    return { ...emptyState(), ownerUid: uid };
  }
  const items = snapshot.docs.map(doc => doc.data() as RecordValue);
  return restoreAppState(items, uid);
}

export async function recordWaterIntake(ml: number, uid: string = CONFIG.userUid): Promise<{ totalToday: number; newLog: WaterLog }> {
  const firestore = getFirestoreDb();
  const metaRef = firestore.doc(`users/${uid}/records/meta`);
  const metaSnap = await metaRef.get();
  const metaData = metaSnap.data() || { kind: 'meta', payload: {} };
  const payload = (metaData.payload || {}) as Record<string, any>;
  const waterList: WaterLog[] = Array.isArray(payload.water) ? [...payload.water] : [];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const newLog: WaterLog = {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: todayStr,
    time: timeStr,
    ml
  };

  waterList.push(newLog);
  payload.water = waterList;

  await metaRef.set({
    kind: 'meta',
    payload,
    updatedAt: now.toISOString()
  });

  const totalToday = waterList.filter(w => w.date === todayStr).reduce((s, w) => s + w.ml, 0);
  return { totalToday, newLog };
}

export async function recordMeal(meal: Meal, uid: string = CONFIG.userUid): Promise<void> {
  const firestore = getFirestoreDb();
  const mealRef = firestore.doc(`users/${uid}/records/meals_${meal.id}`);
  await mealRef.set({
    kind: 'meals',
    payload: meal,
    updatedAt: new Date().toISOString()
  });
}

export async function recordSession(session: Session, uid: string = CONFIG.userUid): Promise<void> {
  const firestore = getFirestoreDb();
  const sessionRef = firestore.doc(`users/${uid}/records/sessions_${session.id}`);
  await sessionRef.set({
    kind: 'sessions',
    payload: session,
    updatedAt: new Date().toISOString()
  });
}

export async function updateMemoryAndChat(
  chatTurn: { role: 'user' | 'assistant'; text: string; time: string },
  memoryUpdate?: { dailyNote?: string; facts?: string[] },
  uid: string = CONFIG.userUid
): Promise<void> {
  const firestore = getFirestoreDb();
  const metaRef = firestore.doc(`users/${uid}/records/meta`);
  const metaSnap = await metaRef.get();
  const metaData = metaSnap.data() || { kind: 'meta', payload: {} };
  const payload = (metaData.payload || {}) as Record<string, any>;

  const chat = Array.isArray(payload.chat) ? [...payload.chat] : [];
  chat.push(chatTurn);
  if (chat.length > 50) chat.splice(0, chat.length - 50);
  payload.chat = chat;

  if (memoryUpdate) {
    const memory: AiMemory = payload.aiMemory || { dailyNote: '', facts: [], history: [] };
    if (memoryUpdate.dailyNote !== undefined) memory.dailyNote = memoryUpdate.dailyNote;
    if (memoryUpdate.facts?.length) {
      const merged = [...new Set([...(memory.facts || []), ...memoryUpdate.facts])];
      memory.facts = merged.slice(-15);
    }
    payload.aiMemory = memory;
  }

  await metaRef.set({
    kind: 'meta',
    payload,
    updatedAt: new Date().toISOString()
  });
}
