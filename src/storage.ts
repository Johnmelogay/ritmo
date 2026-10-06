import { emptyState, stateSchema, type AppState } from './domain';

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredState(storage: StorageAccess, key: string): AppState {
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyState();
    const parsed = stateSchema.parse(JSON.parse(raw));
    if (!parsed.demo && parsed.profile.name !== 'João') return parsed;
    const archiveKey = `${key}-demo-archive`;
    if (!storage.getItem(archiveKey)) storage.setItem(archiveKey, raw);
    const clean = emptyState();
    storage.setItem(key, JSON.stringify(clean));
    return clean;
  } catch {
    return emptyState();
  }
}
