import { type AppState, stateSchema } from './domain';

export type ChangeCategory =
  | 'workout_plan_new'
  | 'workout_plan_update'
  | 'profile_goal'
  | 'diet_macros'
  | 'meal_log'
  | 'body_metric';

export interface FieldChangeSummary {
  category: ChangeCategory;
  icon: string;
  label: string;
  description: string;
  before?: string | null;
  after?: string | null;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO format
  prompt: string;
  summary: string;
  source: 'jev_ai' | 'manual';
  jevDecision?: {
    intent: string;
    confidence: number;
    details?: string;
  };
  changes: FieldChangeSummary[];
  snapshotBefore: AppState;
  snapshotAfter: AppState;
  status: 'applied' | 'reverted';
  revertedAt?: string;
}

const STORAGE_KEY = 'ritmo_audit_logs_v1';

const inMemoryStore = new Map<string, string>();

function getStorage() {
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    return localStorage;
  }
  return {
    getItem: (key: string) => inMemoryStore.get(key) ?? null,
    setItem: (key: string, val: string) => { inMemoryStore.set(key, val); },
    removeItem: (key: string) => { inMemoryStore.delete(key); },
    clear: () => { inMemoryStore.clear(); }
  };
}

/**
 * Carrega todos os registros de auditoria persistidos no armazenamento local.
 */
export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list;
  } catch (err) {
    console.error('Falha ao carregar logs de auditoria:', err);
    return [];
  }
}

/**
 * Salva a lista de logs no armazenamento local.
 */
function saveAuditLogs(logs: AuditLogEntry[]) {
  try {
    // Guarda até 50 logs mais recentes para manter o armazenamento eficiente
    const trimmed = logs.slice(0, 50);
    getStorage().setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Falha ao salvar logs de auditoria:', err);
  }
}

/**
 * Registra uma nova alteração de estado no log de auditoria.
 */
export function recordAuditEntry(entry: AuditLogEntry): void {
  const current = getAuditLogs();
  // Insere no início (mais recente primeiro)
  saveAuditLogs([entry, ...current]);
}

/**
 * Reverte uma alteração aplicando com segurança o snapshotBefore.
 */
export function revertAuditEntry(
  logId: string,
  currentState: AppState
): { success: boolean; restoredState?: AppState; error?: string } {
  const logs = getAuditLogs();
  const entryIndex = logs.findIndex(l => l.id === logId);

  if (entryIndex === -1) {
    return { success: false, error: 'Registro de auditoria não encontrado.' };
  }

  const entry = logs[entryIndex];
  if (entry.status === 'reverted') {
    return { success: false, error: 'Esta alteração já foi revertida anteriormente.' };
  }

  try {
    // Valida que o snapshot anterior satisfaz o schema da aplicação
    const validatedBefore = stateSchema.parse(entry.snapshotBefore);

    // Marca como revertido
    logs[entryIndex] = {
      ...entry,
      status: 'reverted',
      revertedAt: new Date().toISOString()
    };
    saveAuditLogs(logs);

    return {
      success: true,
      restoredState: validatedBefore
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro ao validar estado prévio: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Re-aplica uma alteração que havia sido revertida.
 */
export function reapplyAuditEntry(
  logId: string,
  currentState: AppState
): { success: boolean; restoredState?: AppState; error?: string } {
  const logs = getAuditLogs();
  const entryIndex = logs.findIndex(l => l.id === logId);

  if (entryIndex === -1) {
    return { success: false, error: 'Registro de auditoria não encontrado.' };
  }

  const entry = logs[entryIndex];
  if (entry.status === 'applied') {
    return { success: false, error: 'Esta alteração já está aplicada.' };
  }

  try {
    const validatedAfter = stateSchema.parse(entry.snapshotAfter);

    logs[entryIndex] = {
      ...entry,
      status: 'applied',
      revertedAt: undefined
    };
    saveAuditLogs(logs);

    return {
      success: true,
      restoredState: validatedAfter
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro ao reaplicar estado: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Limpa o histórico de auditoria.
 */
export function clearAuditLogs(): void {
  try {
    getStorage().removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Falha ao limpar logs:', err);
  }
}
