import { csv, uid, type AppState, type Exercise, type Plan, type Session } from './domain';
import { exerciseHistory, exerciseKey } from './training';

export interface LoadHistory { initial?: { load: number; date: string }; last?: { load: number; reps: number; date: string } }

/** Map from exercise key to the first and most recent top set across finished sessions. */
export function loadHistoryMap(sessions: Session[]) {
  const map = new Map<string, LoadHistory>();
  for (const group of exerciseHistory(sessions)) {
    const first = group.entries[0], last = group.entries.at(-1);
    map.set(group.key, { initial: first && { load: first.load, date: first.date }, last: last && { load: last.load, reps: last.reps, date: last.date } });
  }
  return { get: (exercise: Pick<Exercise, 'name' | 'catalogId'>) => map.get(exerciseKey(exercise)) ?? {} };
}

const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** CSV (Excel pt-BR friendly via the shared csv helper) with the same columns as the spreadsheet view. */
export function exportPlansSheet(state: Pick<AppState, 'plans' | 'sessions'>, onlyPlanId?: string) {
  const history = loadHistoryMap(state.sessions);
  const rows: (string | number | boolean | null)[][] = [['plano', 'dias', 'versao', 'ordem', 'exercicio', 'grupo', 'biset_grupo', 'biset_com', 'series', 'reps', 'carga_plano_kg', 'carga_inicial_kg', 'data_carga_inicial', 'ultima_carga_kg', 'ultimas_reps', 'data_ultima_carga', 'descanso_s', 'observacoes']];
  for (const plan of state.plans.filter(p => !onlyPlanId || p.id === onlyPlanId)) {
    const letters = new Map<string, string>();
    for (const ex of plan.exercises) if (ex.supersetId && !letters.has(ex.supersetId)) letters.set(ex.supersetId, String.fromCharCode(65 + letters.size));
    const days = [...plan.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => weekdayNames[d]).join(' ');
    plan.exercises.forEach((ex, index) => {
      const past = history.get(ex);
      const partners = ex.supersetId ? plan.exercises.filter(o => o.id !== ex.id && o.supersetId === ex.supersetId).map(o => o.name).join(' + ') : '';
      rows.push([plan.name, days, plan.version, index + 1, ex.name, ex.muscle, ex.supersetId ? letters.get(ex.supersetId) ?? '' : '', partners || null, ex.sets, ex.reps, ex.load, past.initial?.load ?? null, past.initial?.date ?? null, past.last?.load ?? null, past.last?.reps ?? null, past.last?.date ?? null, ex.rest, ex.notes?.trim() || null]);
    });
  }
  return csv(rows);
}

export type EditableField = 'sets' | 'reps' | 'load' | 'rest';
const limits: Record<EditableField, { min: number; max: number; integer: boolean }> = {
  sets: { min: 1, max: 15, integer: true },
  reps: { min: 1, max: 100, integer: true },
  load: { min: 0, max: 1000, integer: false },
  rest: { min: 0, max: 1200, integer: true },
};

/** Parses a typed cell value (accepts "42,5"). Returns null when outside the plan schema limits. */
export function parseCell(field: EditableField, raw: string): number | null {
  const value = Number(raw.trim().replace(',', '.'));
  const rule = limits[field];
  if (!raw.trim() || !Number.isFinite(value) || value < rule.min || value > rule.max) return null;
  if (rule.integer && !Number.isInteger(value)) return null;
  return rule.integer ? value : Math.round(value * 10) / 10;
}

/** Applies a single numeric cell edit and bumps the plan version. Unchanged values return the same plan. */
export function editPlanCell(plan: Plan, exerciseId: string, field: EditableField, value: number): Plan {
  const target = plan.exercises.find(ex => ex.id === exerciseId);
  if (!target || target[field] === value) return plan;
  return { ...plan, version: plan.version + 1, exercises: plan.exercises.map(ex => ex.id === exerciseId ? { ...ex, [field]: value } : ex) };
}

/** Pairs an exercise with a partner (bi-set) or clears it when partnerId is empty. Solitary groups are dissolved. */
export function setSupersetPartner(plan: Plan, exerciseId: string, partnerId: string): Plan {
  const target = plan.exercises.find(ex => ex.id === exerciseId);
  if (!target) return plan;
  let exercises: Exercise[];
  if (!partnerId) {
    if (!target.supersetId) return plan;
    exercises = plan.exercises.map(ex => { if (ex.id !== exerciseId) return ex; const { supersetId: _drop, ...rest } = ex; return rest; });
  } else {
    const partner = plan.exercises.find(ex => ex.id === partnerId);
    if (!partner || partner.id === exerciseId) return plan;
    if (target.supersetId && target.supersetId === partner.supersetId) return plan;
    const groupId = partner.supersetId ?? uid();
    exercises = plan.exercises.map(ex => ex.id === exerciseId || ex.id === partnerId ? { ...ex, supersetId: groupId } : ex);
  }
  // Dissolve any group left with a single member.
  const counts = new Map<string, number>();
  for (const ex of exercises) if (ex.supersetId) counts.set(ex.supersetId, (counts.get(ex.supersetId) ?? 0) + 1);
  exercises = exercises.map(ex => { if (!ex.supersetId || (counts.get(ex.supersetId) ?? 0) > 1) return ex; const { supersetId: _drop, ...rest } = ex; return rest; });
  return { ...plan, version: plan.version + 1, exercises };
}
