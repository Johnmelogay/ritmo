import { number, type Exercise, type Plan } from './domain';

/** Fields of a plan exercise the user can see change in the preview. */
export type ExerciseField = 'name' | 'muscle' | 'sets' | 'reps' | 'load' | 'rest' | 'superset' | 'notes' | 'order';
export type PlanField = 'name' | 'subtitle' | 'days';

export interface FieldChange<K extends string = string> { key: K; label: string; before: string; after: string }
export interface ExerciseDiff { exerciseId: string; name: string; status: 'added' | 'removed' | 'changed'; fields: FieldChange<ExerciseField>[] }
export interface PlanDiff { planId: string; planName: string; status: 'added' | 'removed' | 'changed'; fields: FieldChange<PlanField>[]; exercises: ExerciseDiff[] }

/** One stop of the floating "AI is here" guide. */
export interface ChangeStop { id: string; planId: string; exerciseId?: string; title: string; detail: string }

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fieldLabels: Record<ExerciseField, string> = { name: 'Exercício', muscle: 'Grupo', sets: 'Séries', reps: 'Reps', load: 'Carga', rest: 'Descanso', superset: 'Bi-set', notes: 'Obs.', order: 'Ordem' };

export function supersetPartners(exercise: Exercise, exercises: Exercise[]) {
  if (!exercise.supersetId) return [];
  return exercises.filter(other => other.id !== exercise.id && other.supersetId === exercise.supersetId).map(other => other.name);
}

const fmtSuperset = (exercise: Exercise, exercises: Exercise[]) => { const partners = supersetPartners(exercise, exercises); return partners.length ? `com ${partners.join(' + ')}` : 'não'; };
const fmtDays = (days: number[]) => days.length ? [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => dayNames[d]).join(', ') : 'sem dia';

function exerciseValues(exercise: Exercise, exercises: Exercise[]): Record<ExerciseField, string> {
  return {
    name: exercise.name,
    muscle: exercise.muscle,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    load: `${number(exercise.load, 1)} kg`,
    rest: `${exercise.rest}s`,
    superset: fmtSuperset(exercise, exercises),
    notes: exercise.notes?.trim() || '—',
    order: `${exercises.indexOf(exercise) + 1}º`,
  };
}

function diffExercises(before: Exercise[], after: Exercise[]): ExerciseDiff[] {
  const out: ExerciseDiff[] = [];
  const beforeById = new Map(before.map(ex => [ex.id, ex]));
  const afterIds = new Set(after.map(ex => ex.id));
  for (const ex of after) {
    const prev = beforeById.get(ex.id);
    const next = exerciseValues(ex, after);
    if (!prev) {
      out.push({ exerciseId: ex.id, name: ex.name, status: 'added', fields: [{ key: 'sets', label: 'Prescrição', before: '—', after: `${next.sets} × ${next.reps} · ${next.load} · ${next.rest}` }] });
      continue;
    }
    const old = exerciseValues(prev, before);
    // Order is only reported when the relative order really changed, not when items were added/removed around it.
    const keptBefore = before.filter(item => afterIds.has(item.id)).map(item => item.id);
    const keptAfter = after.filter(item => beforeById.has(item.id)).map(item => item.id);
    const orderChanged = keptBefore.indexOf(ex.id) !== keptAfter.indexOf(ex.id);
    const fields = (Object.keys(fieldLabels) as ExerciseField[])
      .filter(key => key === 'order' ? orderChanged : old[key] !== next[key])
      .map(key => ({ key, label: fieldLabels[key], before: old[key], after: next[key] }));
    if (fields.length) out.push({ exerciseId: ex.id, name: ex.name, status: 'changed', fields });
  }
  for (const ex of before) if (!afterIds.has(ex.id)) out.push({ exerciseId: ex.id, name: ex.name, status: 'removed', fields: [] });
  return out;
}

/** Compares two plan lists and returns only what actually changed, in display order. */
export function diffPlans(before: Plan[], after: Plan[]): PlanDiff[] {
  const out: PlanDiff[] = [];
  const beforeById = new Map(before.map(plan => [plan.id, plan]));
  for (const plan of after) {
    const prev = beforeById.get(plan.id);
    if (!prev) {
      out.push({ planId: plan.id, planName: plan.name, status: 'added', fields: [], exercises: plan.exercises.map(ex => ({ exerciseId: ex.id, name: ex.name, status: 'added' as const, fields: [] })) });
      continue;
    }
    const fields: FieldChange<PlanField>[] = [];
    if (prev.name !== plan.name) fields.push({ key: 'name', label: 'Nome', before: prev.name, after: plan.name });
    if (prev.subtitle !== plan.subtitle) fields.push({ key: 'subtitle', label: 'Descrição', before: prev.subtitle || '—', after: plan.subtitle || '—' });
    if (fmtDays(prev.days) !== fmtDays(plan.days)) fields.push({ key: 'days', label: 'Dias', before: fmtDays(prev.days), after: fmtDays(plan.days) });
    const exercises = diffExercises(prev.exercises, plan.exercises);
    if (fields.length || exercises.length) out.push({ planId: plan.id, planName: plan.name, status: 'changed', fields, exercises });
  }
  const afterIds = new Set(after.map(plan => plan.id));
  for (const plan of before) if (!afterIds.has(plan.id)) out.push({ planId: plan.id, planName: plan.name, status: 'removed', fields: [], exercises: [] });
  return out;
}

/** Flattens a diff into the sequence of places the floating guide walks through. */
export function changeStops(diffs: PlanDiff[]): ChangeStop[] {
  const stops: ChangeStop[] = [];
  for (const plan of diffs) {
    if (plan.status !== 'changed') {
      stops.push({ id: `plan-${plan.planId}`, planId: plan.planId, title: plan.planName, detail: plan.status === 'added' ? `Novo plano com ${plan.exercises.length} exercício(s)` : 'Plano removido' });
      continue;
    }
    if (plan.fields.length) stops.push({ id: `plan-${plan.planId}`, planId: plan.planId, title: plan.planName, detail: plan.fields.map(f => `${f.label}: ${f.before} → ${f.after}`).join(' · ') });
    for (const ex of plan.exercises) {
      const detail = ex.status === 'added' ? `Novo exercício · ${ex.fields[0]?.after ?? ''}`.trim()
        : ex.status === 'removed' ? 'Exercício removido'
        : ex.fields.map(f => `${f.label}: ${f.before} → ${f.after}`).join(' · ');
      stops.push({ id: `ex-${plan.planId}-${ex.exerciseId}`, planId: plan.planId, exerciseId: ex.exerciseId, title: `${plan.planName} › ${ex.name}`, detail });
    }
  }
  return stops;
}

/** Quick lookup used by the plan views to highlight changed cells. */
export function diffIndex(diffs: PlanDiff[]) {
  const plans = new Map(diffs.map(plan => [plan.planId, plan]));
  const exercises = new Map<string, ExerciseDiff>();
  for (const plan of diffs) for (const ex of plan.exercises) exercises.set(`${plan.planId}:${ex.exerciseId}`, ex);
  return {
    plan: (planId: string) => plans.get(planId),
    exercise: (planId: string, exerciseId: string) => exercises.get(`${planId}:${exerciseId}`),
    field: (planId: string, exerciseId: string, key: ExerciseField) => exercises.get(`${planId}:${exerciseId}`)?.fields.find(f => f.key === key),
  };
}
export type DiffIndex = ReturnType<typeof diffIndex>;
