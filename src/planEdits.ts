import { uid, type Exercise, type Origin, type Plan } from './domain';
import { exerciseKey, normalizeExercise } from './training';

/**
 * Pure, deterministic plan edits used by the AI proposal flow.
 * They only touch `plans` (never `sessions`), keep exercise ids/catalogIds/loads/reps,
 * so history and per-exercise progression stay intact.
 */

const STOP = new Set(['com', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'o', 'a', 'os', 'as', 'e', 'em', 'para', 'pra', 'the']);
const stem = (token: string) => token.length > 4 && token.endsWith('es') ? token.slice(0, -2) : token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token;
export const exerciseTokens = (value: string) => new Set(normalizeExercise(value).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !STOP.has(t)).map(stem));

export type ExerciseMatch = { ok: true; exercise: Exercise } | { ok: false; reason: 'not_found' | 'ambiguous'; candidates: string[] };

export function matchExercise(exercises: Exercise[], query: string): ExerciseMatch {
  const q = query.trim();
  if (!q) return { ok: false, reason: 'not_found', candidates: [] };
  const byId = exercises.find(ex => ex.id === q);
  if (byId) return { ok: true, exercise: byId };
  const exact = exercises.filter(ex => normalizeExercise(ex.name) === normalizeExercise(q) || exerciseKey(ex) === exerciseKey({ name: q }));
  if (exact.length === 1) return { ok: true, exercise: exact[0] };
  if (exact.length > 1) return { ok: false, reason: 'ambiguous', candidates: exact.map(ex => ex.name) };
  const qt = exerciseTokens(q);
  const scored = exercises.map(ex => {
    const et = exerciseTokens(ex.name);
    const shared = [...qt].filter(t => et.has(t)).length;
    const union = new Set([...qt, ...et]).size || 1;
    const contained = shared > 0 && (shared === et.size || shared === qt.size);
    return { ex, score: contained ? 0.5 + shared / union : shared / union };
  }).filter(item => item.score >= 0.6).sort((a, b) => b.score - a.score);
  if (!scored.length) return { ok: false, reason: 'not_found', candidates: exercises.map(ex => ex.name) };
  if (scored.length > 1 && Math.abs(scored[0].score - scored[1].score) < 0.05) return { ok: false, reason: 'ambiguous', candidates: scored.slice(0, 4).map(item => item.ex.name) };
  return { ok: true, exercise: scored[0].ex };
}

const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
export type PlanMatch = { ok: true; plan: Plan } | { ok: false; reason: 'not_found' | 'ambiguous'; candidates: string[] };

export function matchPlan(plans: Plan[], query: string): PlanMatch {
  const q = normalizeExercise(query);
  if (!q) return { ok: false, reason: 'not_found', candidates: plans.map(p => p.name) };
  const byId = plans.find(p => p.id === query.trim());
  if (byId) return { ok: true, plan: byId };
  const exact = plans.filter(p => normalizeExercise(p.name) === q);
  if (exact.length === 1) return { ok: true, plan: exact[0] };
  const partial = plans.filter(p => normalizeExercise(p.name).includes(q) || q.includes(normalizeExercise(p.name)));
  if (partial.length === 1) return { ok: true, plan: partial[0] };
  if (partial.length > 1) return { ok: false, reason: 'ambiguous', candidates: partial.map(p => p.name) };
  const day = WEEKDAYS.findIndex(name => q.includes(name));
  if (day >= 0) {
    const onDay = plans.filter(p => p.days.includes(day));
    if (onDay.length === 1) return { ok: true, plan: onDay[0] };
    if (onDay.length > 1) return { ok: false, reason: 'ambiguous', candidates: onDay.map(p => p.name) };
  }
  return { ok: false, reason: 'not_found', candidates: plans.map(p => p.name) };
}

const describe = (ex: Exercise) => `${ex.name} (${ex.sets}×${ex.reps}${ex.load ? ` · ${ex.load} kg` : ''})`;
const matchError = (query: string, match: Extract<ExerciseMatch, { ok: false }>) => match.reason === 'ambiguous'
  ? `"${query}" corresponde a mais de um exercício: ${match.candidates.join(', ')}. Qual deles?`
  : `Não encontrei "${query}" neste plano.${match.candidates.length ? ` Exercícios disponíveis: ${match.candidates.slice(0, 8).join(', ')}.` : ''}`;

export type EditResult = { ok: true; exercises: Exercise[]; details: string[] } | { ok: false; error: string };

/** Groups 2–4 existing exercises into a bi-set/tri-set, in the requested order, at the position of the first one. */
export function createSuperset(exercises: Exercise[], queries: string[]): EditResult {
  const names = queries.map(q => q.trim()).filter(Boolean);
  if (names.length < 2) return { ok: false, error: 'Um bi-set precisa de pelo menos dois exercícios.' };
  if (names.length > 4) return { ok: false, error: 'Agrupe no máximo quatro exercícios por vez.' };
  const members: Exercise[] = [];
  for (const name of names) {
    const match = matchExercise(exercises, name);
    if (!match.ok) return { ok: false, error: matchError(name, match) };
    if (members.some(m => m.id === match.exercise.id)) return { ok: false, error: `"${match.exercise.name}" foi indicado duas vezes.` };
    members.push(match.exercise);
  }
  const groups = new Set(members.map(m => m.supersetId).filter(Boolean));
  if (groups.size === 1 && members.every(m => m.supersetId) && exercises.filter(ex => ex.supersetId === members[0].supersetId).length === members.length) {
    return { ok: false, error: `${members.map(m => m.name).join(' e ')} já formam um bi-set.` };
  }
  const busy = members.find(m => m.supersetId);
  if (busy) {
    const partners = exercises.filter(ex => ex.supersetId === busy.supersetId && ex.id !== busy.id).map(ex => ex.name);
    return { ok: false, error: `"${busy.name}" já está em um bi-set com ${partners.join(', ')}. Desfaça esse bi-set antes de criar outro.` };
  }
  const ids = new Set(members.map(m => m.id));
  const anchorIndex = Math.min(...members.map(m => exercises.findIndex(ex => ex.id === m.id)));
  const anchor = exercises[anchorIndex];
  const supersetId = uid();
  const grouped = members.map(m => ({ ...m, supersetId, rest: anchor.rest }));
  const remaining = exercises.filter(ex => !ids.has(ex.id));
  const before = exercises.slice(0, anchorIndex).filter(ex => !ids.has(ex.id)).length;
  const next = [...remaining.slice(0, before), ...grouped, ...remaining.slice(before)];
  const details = [
    `Bi-set: ${members.map(describe).join(' + ')}`,
    `Descanso só após completar a dupla: ${anchor.rest}s`,
  ];
  const sets = members.map(m => m.sets);
  if (new Set(sets).size > 1) {
    const top = members.reduce((a, b) => b.sets > a.sets ? b : a);
    details.push(`Séries diferentes (${sets.join(' e ')}): as rodadas extras terão só ${top.name}. Séries não foram alteradas.`);
  }
  details.push('Cargas, repetições e histórico de evolução de cada exercício continuam os mesmos.');
  return { ok: true, exercises: next, details };
}

/** Removes the bi-set that contains the given exercise, keeping both exercises as normal ones. */
export function removeSuperset(exercises: Exercise[], query: string): EditResult {
  const match = matchExercise(exercises, query);
  if (!match.ok) return { ok: false, error: matchError(query, match) };
  const group = match.exercise.supersetId;
  if (!group) return { ok: false, error: `"${match.exercise.name}" não está em um bi-set.` };
  const names = exercises.filter(ex => ex.supersetId === group).map(ex => ex.name);
  return {
    ok: true,
    exercises: exercises.map(ex => { if (ex.supersetId !== group) return ex; const copy = { ...ex }; delete copy.supersetId; return copy; }),
    details: [`Desfazer bi-set: ${names.join(' + ')} voltam a ser exercícios separados`],
  };
}

export interface PlanUpdateRequest {
  planIdOrName: string;
  name?: string;
  subtitle?: string;
  days?: number[];
  exercisesToAdd?: Array<{ name: string; muscle: string; sets: number; reps: number; load: number; rest: number; origin: Origin }>;
  exercisesToUpdate?: Array<{ exerciseName: string; sets?: number; reps?: number; load?: number; rest?: number }>;
  supersetsToCreate?: string[][];
  supersetsToRemove?: string[];
}

export interface PlanUpdateOutcome { plan: Plan; changed: boolean; details: string[]; warnings: string[] }

const clampInt = (value: number | undefined, min: number, max: number) => value === undefined || !Number.isFinite(value) ? undefined : Math.min(max, Math.max(min, Math.round(value)));

/**
 * Applies an AI plan-update request to one plan. Invalid sub-operations become warnings
 * (never silent no-ops) and the version only increases when something really changed.
 */
export function applyPlanUpdate(plan: Plan, req: PlanUpdateRequest): PlanUpdateOutcome {
  const details: string[] = [], warnings: string[] = [];
  let exercises = [...plan.exercises];

  for (const upd of req.exercisesToUpdate ?? []) {
    const match = matchExercise(exercises, upd.exerciseName);
    if (!match.ok) { warnings.push(matchError(upd.exerciseName, match)); continue; }
    const ex = match.exercise;
    const patch = { sets: clampInt(upd.sets, 1, 15), reps: clampInt(upd.reps, 1, 100), load: upd.load === undefined || !Number.isFinite(upd.load) ? undefined : Math.min(1000, Math.max(0, upd.load)), rest: clampInt(upd.rest, 0, 1200) };
    const next = { ...ex, sets: patch.sets ?? ex.sets, reps: patch.reps ?? ex.reps, load: patch.load ?? ex.load, rest: patch.rest ?? ex.rest };
    if (JSON.stringify(next) === JSON.stringify(ex)) continue;
    exercises = exercises.map(item => {
      if (item.id === ex.id) return next;
      // Bi-set partners share sets and rest, like the manual editor.
      if (ex.supersetId && item.supersetId === ex.supersetId) return { ...item, sets: next.sets, rest: next.rest };
      return item;
    });
    details.push(`Ajustar ${ex.name}: ${describe(ex)} → ${describe(next)}${next.rest !== ex.rest ? ` · ${next.rest}s` : ''}`);
  }

  for (const name of req.supersetsToRemove ?? []) {
    const result = removeSuperset(exercises, name);
    if (!result.ok) { warnings.push(result.error); continue; }
    exercises = result.exercises; details.push(...result.details);
  }

  for (const group of req.supersetsToCreate ?? []) {
    const result = createSuperset(exercises, group);
    if (!result.ok) { warnings.push(result.error); continue; }
    exercises = result.exercises; details.push(...result.details);
  }

  for (const add of req.exercisesToAdd ?? []) {
    if (matchExercise(exercises, add.name).ok) { warnings.push(`"${add.name}" já existe neste plano; não foi duplicado.`); continue; }
    exercises.push({ id: uid(), name: add.name, muscle: add.muscle, sets: add.sets, reps: add.reps, load: add.load, rest: add.rest, origin: add.origin || 'ia' });
    details.push(`Adicionar ${add.name} (${add.sets}×${add.reps}${add.load ? ` · ${add.load} kg` : ''})`);
  }

  const name = req.name?.trim() || plan.name;
  const subtitle = req.subtitle?.trim() || plan.subtitle;
  const days = req.days?.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) ?? plan.days;
  if (name !== plan.name) details.push(`Renomear para "${name}"`);
  if (JSON.stringify([...days].sort()) !== JSON.stringify([...plan.days].sort())) details.push(`Dias: ${days.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ') || 'nenhum'}`);

  const changed = name !== plan.name || subtitle !== plan.subtitle || JSON.stringify(days) !== JSON.stringify(plan.days) || JSON.stringify(exercises) !== JSON.stringify(plan.exercises);
  return { plan: changed ? { ...plan, name, subtitle, days, exercises, version: plan.version + 1 } : plan, changed, details, warnings };
}

/** Compact one-line description used in AI prompts (keeps tokens low). */
export function compactPlan(plan: Plan) {
  const days = plan.days.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(',') || 'sem dia';
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const ex of plan.exercises) {
    const line = (e: Exercise) => `${e.name} ${e.sets}x${e.reps}${e.load ? ` ${e.load}kg` : ''}`;
    if (!ex.supersetId) { parts.push(line(ex)); continue; }
    if (seen.has(ex.supersetId)) continue;
    seen.add(ex.supersetId);
    parts.push(`BI-SET[${plan.exercises.filter(e => e.supersetId === ex.supersetId).map(line).join(' + ')}]`);
  }
  return `"${plan.name}" (id ${plan.id}, ${days}, v${plan.version}): ${parts.join('; ')}`;
}
