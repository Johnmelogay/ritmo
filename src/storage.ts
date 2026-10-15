import { emptyState, stateSchema, type AppState } from './domain';

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredState(storage: StorageAccess, key: string): AppState {
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyState();
    const parsed = stateSchema.parse(JSON.parse(raw));
    if (!parsed.demo) return parsed;
    const archiveKey = `${key}-demo-archive`;
    if (!storage.getItem(archiveKey)) storage.setItem(archiveKey, raw);
    const clean = emptyState();
    return clean;
  } catch {
    return emptyState();
  }
}

export function writeStoredState(storage: StorageAccess, key: string, next: AppState) {
  const previousRaw = storage.getItem(key);
  const serialized = JSON.stringify(next);
  if (previousRaw === serialized) return;
  if (previousRaw) {
    let backupNeeded = false;
    try {
      const previous = stateSchema.parse(JSON.parse(previousRaw));
      backupNeeded = previous.demo || ['meals','plans','sessions','body','recovery'].some(kind => {
        const field = kind as 'plans';
        return previous[field].some(item => !next[field].some(current => current.id === item.id));
      }) || previous.plans.some(plan => {
        const changed = next.plans.find(item => item.id === plan.id);
        return changed && JSON.stringify(changed) !== JSON.stringify(plan);
      });
    } catch { backupNeeded = true; }
    // Never overwrite a disappearing or incompatible record without preserving it.
    if (backupNeeded) storage.setItem(`${key}-checkpoint-${Date.now()}-${crypto.randomUUID()}`, previousRaw);
  }
  storage.setItem(key, serialized);
}
