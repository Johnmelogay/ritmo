import { stateSchema, uid, type AppState } from './domain';

export function validateMigration(raw: unknown, ownerUid: string): AppState {
  const source = stateSchema.parse(raw);
  if (source.demo) throw new Error('Este arquivo está marcado como demonstração. Use o backup dos seus dados reais.');
  if (source.ownerUid && source.ownerUid !== ownerUid) throw new Error('Este backup está associado a outra conta. Entre na conta de origem para recuperá-lo.');
  return source;
}

export function mergeBackup(current: AppState, source: AppState, ownerUid: string, importProfile: boolean) {
  validateMigration(source, ownerUid);
  if (current.ownerUid && current.ownerUid !== ownerUid) throw new Error('A conta mudou. Reabra a importação.');
  const next: AppState = { ...current, ownerUid, demo: false, profile: importProfile ? { ...source.profile, aiConsent: current.profile.aiConsent, routineConsent: current.profile.routineConsent } : current.profile };
  for (const kind of ['meals','plans','sessions','body','recovery'] as const) {
    const present = new Set(current[kind].map(item => item.id));
    // Existing records win; importing twice never duplicates or overwrites them.
    (next[kind] as unknown[]) = [...current[kind], ...source[kind].filter(item => !present.has(item.id))];
  }
  next.water = { ...source.water, ...current.water };
  next.reviewed = [...new Set([...source.reviewed, ...current.reviewed])];
  next.dismissed = [...new Set([...source.dismissed, ...current.dismissed])];
  next.routineCorrections = { ...source.routineCorrections, ...current.routineCorrections };
  return stateSchema.parse(next);
}

export function moveToTrash(state: AppState, kind: 'plan' | 'session', id: string) {
  if (kind === 'plan') {
    const payload = state.plans.find(plan => plan.id === id); if (!payload) return state;
    return { ...state, plans: state.plans.filter(plan => plan.id !== id), trash: [...state.trash, { id: uid(), kind, removedAt: new Date().toISOString(), payload }] };
  }
  const payload = state.sessions.find(session => session.id === id); if (!payload) return state;
  return { ...state, sessions: state.sessions.filter(session => session.id !== id), trash: [...state.trash, { id: uid(), kind, removedAt: new Date().toISOString(), payload }] };
}

export function restoreTrash(state: AppState, id: string): AppState {
  const item = state.trash.find(entry => entry.id === id); if (!item) return state;
  const field = item.kind === 'plan' ? 'plans' : 'sessions';
  if (state[field].some(record => record.id === item.payload.id)) throw new Error('Já existe um registro com este ID. Exporte o backup antes de resolver o conflito.');
  if (item.kind === 'session' && !item.payload.finishedAt && state.sessions.some(s => !s.finishedAt)) throw new Error('Finalize a sessão atual antes de restaurar outro treino em andamento.');
  return stateSchema.parse({ ...state, [field]: [...state[field], item.payload], trash: state.trash.filter(entry => entry.id !== id) });
}
