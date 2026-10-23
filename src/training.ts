import { uid, type AppState, type Exercise, type Plan, type Session } from './domain';
import { curatedExercises } from './workoutDb';

export const normalizeExercise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
const catalogByName = new Map(curatedExercises.map(ex => [normalizeExercise(ex.name), ex.id]));
export const exerciseKey = (exercise: Pick<Exercise, 'name' | 'catalogId'>) => exercise.catalogId || catalogByName.get(normalizeExercise(exercise.name)) || normalizeExercise(exercise.name);

export function parseTrainingNumber(raw: string, min: number, max: number, integer = false): number | null {
  if (!raw.trim()) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw.trim())) return null;
  const number = Number(raw.replace(',', '.'));
  return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number)) ? number : null;
}

export function shouldStartRest(session: Session, exerciseId: string, logIndex: number) {
  const current = session.exercises.find(ex => ex.id === exerciseId);
  if (!current?.supersetId) return true;
  return session.exercises.filter(ex => ex.supersetId === current.supersetId && ex.id !== exerciseId)
    .every(ex => !ex.logs[logIndex] || ex.logs[logIndex].done);
}

export function exerciseHistory(sessions: Session[]) {
  const groups = new Map<string, { key: string; name: string; muscle: string; origins: Set<Exercise['origin']>; entries: { date: string; sessionId: string; load: number; reps: number; sets: number; volume: number }[] }>();
  for (const session of [...sessions].filter(s => s.finishedAt).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))) {
    for (const exercise of session.exercises) {
      const done = exercise.logs.filter(log => log.done && log.reps > 0);
      if (!done.length) continue;
      const key = exerciseKey(exercise);
      const group = groups.get(key) ?? { key, name: exercise.name, muscle: exercise.muscle, origins: new Set<Exercise['origin']>(), entries: [] };
      const top = done.reduce((best, log) => log.load > best.load || log.load === best.load && log.reps > best.reps ? log : best);
      group.origins.add(exercise.origin);
      group.entries.push({ date: session.date, sessionId: session.id, load: top.load, reps: top.reps, sets: done.length, volume: done.reduce((sum, log) => sum + log.load * log.reps, 0) });
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

export function dailyReviewContext(state: AppState, date: string) {
  const { name: _name, ...profile } = state.profile;
  return {
    date, goals: profile,
    reviewed: state.reviewed.includes(date),
    meals: state.meals.filter(m => m.date === date),
    workouts: state.sessions.filter(s => s.date === date),
    plannedWorkouts: state.plans.filter(p => p.days.includes(new Date(`${date}T12:00:00`).getDay())),
    waterMl: state.water[date] ?? null,
    recovery: state.recovery.filter(r => r.date === date),
    body: state.body.filter(b => b.date === date).map(({ sourceText: _raw, fileName: _file, ...record }) => record),
    recentBody: state.body.filter(b => b.date <= date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2).map(b => ({ date: b.date, weight: b.weight, fat: b.fat, muscle: b.muscle })),
    exerciseProgress: exerciseHistory(state.sessions.filter(s => s.date <= date)).filter(group => state.sessions.some(s => s.date === date && s.exercises.some(ex => exerciseKey(ex) === group.key))).map(group => ({ name: group.name, entries: group.entries.slice(-4) })),
  };
}

export interface ReplaceExerciseInput {
  name: string;
  muscle: string;
  reps?: number;
  load?: number;
  catalogId?: string;
  reason?: string;
}

export function replaceSessionExercise(
  session: Session,
  exerciseId: string,
  replacement: ReplaceExerciseInput
): Session {
  const target = session.exercises.find(e => e.id === exerciseId);
  if (!target) return session;
  // Renaming an exercise must never erase already-completed sets.
  if (target.logs.some(log => log.done)) return session;

  const newExerciseId = uid();
  const reason = replacement.reason?.trim() || 'Variação do treino';

  const updatedExercises = session.exercises.map(ex => {
    if (ex.id !== exerciseId) return ex;
    return {
      ...ex,
      id: newExerciseId,
      name: replacement.name.trim(),
      muscle: replacement.muscle.trim() || target.muscle,
      reps: replacement.reps ?? target.reps,
      load: replacement.load ?? target.load,
      catalogId: replacement.catalogId,
      origin: 'usuario' as const,
      reason,
      replacedFrom: {
        id: target.id,
        name: target.name,
        muscle: target.muscle,
      },
      logs: ex.logs.map(log => ({
        id: uid(),
        reps: replacement.reps ?? log.reps,
        load: replacement.load ?? log.load,
        done: false,
        rir: log.rir,
      })),
    };
  });

  return {
    ...session,
    exercises: updatedExercises,
    orderAdapted: true,
  };
}

export function reorderSessionUnits(
  session: Session,
  fromUnitIndex: number,
  toUnitIndex: number
): Session {
  const units: Session['exercises'][] = [];
  const seenSupersets = new Set<string>();

  for (const ex of session.exercises) {
    if (!ex.supersetId) {
      units.push([ex]);
    } else if (!seenSupersets.has(ex.supersetId)) {
      seenSupersets.add(ex.supersetId);
      units.push(session.exercises.filter(item => item.supersetId === ex.supersetId));
    }
  }

  if (fromUnitIndex < 0 || fromUnitIndex >= units.length) return session;
  if (toUnitIndex < 0 || toUnitIndex >= units.length) return session;
  if (fromUnitIndex === toUnitIndex) return session;

  const [moved] = units.splice(fromUnitIndex, 1);
  units.splice(toUnitIndex, 0, moved);

  return {
    ...session,
    exercises: units.flat(),
    orderAdapted: true,
  };
}

export function swapBiSetExercises(session: Session, supersetId: string): Session {
  const exercises = [...session.exercises];
  const indices = exercises
    .map((ex, idx) => (ex.supersetId === supersetId ? idx : -1))
    .filter(idx => idx !== -1);
  if (indices.length < 2) return session;

  const [first, second] = indices;
  const temp = exercises[first];
  exercises[first] = exercises[second];
  exercises[second] = temp;

  return {
    ...session,
    exercises,
    orderAdapted: true,
  };
}

export function reorderPlanUnits(
  exercises: Exercise[],
  fromUnitIndex: number,
  toUnitIndex: number
): Exercise[] {
  const units: Exercise[][] = [];
  const seenSupersets = new Set<string>();

  for (const ex of exercises) {
    if (!ex.supersetId) {
      units.push([ex]);
    } else if (!seenSupersets.has(ex.supersetId)) {
      seenSupersets.add(ex.supersetId);
      units.push(exercises.filter(item => item.supersetId === ex.supersetId));
    }
  }

  if (fromUnitIndex < 0 || fromUnitIndex >= units.length) return exercises;
  if (toUnitIndex < 0 || toUnitIndex >= units.length) return exercises;
  if (fromUnitIndex === toUnitIndex) return exercises;

  const [moved] = units.splice(fromUnitIndex, 1);
  units.splice(toUnitIndex, 0, moved);

  return units.flat();
}

export function swapPlanBiSetExercises(exercises: Exercise[], supersetId: string): Exercise[] {
  const list = [...exercises];
  const indices = list
    .map((ex, idx) => (ex.supersetId === supersetId ? idx : -1))
    .filter(idx => idx !== -1);
  if (indices.length < 2) return exercises;

  const [first, second] = indices;
  const temp = list[first];
  list[first] = list[second];
  list[second] = temp;

  return list;
}

export function reorderSessionExercises(
  session: Session,
  fromIndex: number,
  toIndex: number
): Session {
  if (fromIndex < 0 || fromIndex >= session.exercises.length) return session;
  if (toIndex < 0 || toIndex >= session.exercises.length) return session;
  if (fromIndex === toIndex) return session;

  const units: Session['exercises'][] = [];
  const seenSupersets = new Set<string>();
  let fromUnit = -1;
  let toUnit = -1;

  for (let i = 0; i < session.exercises.length; i++) {
    const ex = session.exercises[i];
    if (!ex.supersetId) {
      if (i === fromIndex) fromUnit = units.length;
      if (i === toIndex) toUnit = units.length;
      units.push([ex]);
    } else if (!seenSupersets.has(ex.supersetId)) {
      seenSupersets.add(ex.supersetId);
      const group = session.exercises.filter(item => item.supersetId === ex.supersetId);
      if (group.some(item => session.exercises.indexOf(item) === fromIndex)) {
        fromUnit = units.length;
      }
      if (group.some(item => session.exercises.indexOf(item) === toIndex)) {
        toUnit = units.length;
      }
      units.push(group);
    }
  }

  if (fromUnit === -1 || toUnit === -1 || fromUnit === toUnit) return session;

  const [moved] = units.splice(fromUnit, 1);
  units.splice(toUnit, 0, moved);

  return {
    ...session,
    exercises: units.flat(),
    orderAdapted: true,
  };
}

export interface SessionAdaptation {
  sessionId: string;
  date: string;
  sessionName: string;
  originalName: string;
  newName: string;
  muscle: string;
  reason: string;
  sets: number;
  maxLoad: number;
}

export function sessionAdaptations(sessions: Session[]): SessionAdaptation[] {
  const result: SessionAdaptation[] = [];
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));

  for (const s of sorted) {
    for (const ex of s.exercises) {
      if (ex.replacedFrom) {
        const done = ex.logs.filter(l => l.done);
        result.push({
          sessionId: s.id,
          date: s.date,
          sessionName: s.name,
          originalName: ex.replacedFrom.name,
          newName: ex.name,
          muscle: ex.muscle,
          reason: ex.reason || 'Variação do treino',
          sets: done.length,
          maxLoad: done.length ? Math.max(...done.map(l => l.load)) : ex.load,
        });
      }
    }
  }

  return result;
}

export interface LastPerformance {
  load: number;
  reps: number;
  date: string;
  sessionName: string;
}

/**
 * Searches completed sessions chronologically to find the most recent completed performance
 * for a specific exercise (by catalogue ID or normalized name).
 */
export function getLastExercisePerformance(
  sessions: Session[],
  exerciseNameOrCatalogId: string
): LastPerformance | null {
  const normKey = normalizeExercise(exerciseNameOrCatalogId);
  const finished = [...sessions]
    .filter(s => s.finishedAt)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.finishedAt || '').localeCompare(a.finishedAt || ''));

  for (const s of finished) {
    for (const ex of s.exercises) {
      const match = (ex.catalogId && ex.catalogId === exerciseNameOrCatalogId) ||
        normalizeExercise(ex.name) === normKey ||
        exerciseKey(ex) === normKey;
      if (match) {
        const done = ex.logs.filter(l => l.done && l.reps > 0);
        if (done.length > 0) {
          // Find set with maximum load (or the last completed set)
          const top = done.reduce((best, l) => (l.load > best.load || (l.load === best.load && l.reps > best.reps)) ? l : best);
          return {
            load: top.load,
            reps: top.reps,
            date: s.date,
            sessionName: s.name,
          };
        }
      }
    }
  }
  return null;
}

/** Precomputes a map of normalized exercise key -> LastPerformance for fast O(1) lookups */
export function getLastExerciseStatsMap(sessions: Session[]): Map<string, LastPerformance> {
  const map = new Map<string, LastPerformance>();
  const finished = [...sessions]
    .filter(s => s.finishedAt)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.finishedAt || '').localeCompare(a.finishedAt || ''));

  for (const s of finished) {
    for (const ex of s.exercises) {
      const key = exerciseKey(ex);
      const nameKey = normalizeExercise(ex.name);
      if (!map.has(key) || !map.has(nameKey)) {
        const done = ex.logs.filter(l => l.done && l.reps > 0);
        if (done.length > 0) {
          const top = done.reduce((best, l) => (l.load > best.load || (l.load === best.load && l.reps > best.reps)) ? l : best);
          const perf: LastPerformance = {
            load: top.load,
            reps: top.reps,
            date: s.date,
            sessionName: s.name,
          };
          if (!map.has(key)) map.set(key, perf);
          if (!map.has(nameKey)) map.set(nameKey, perf);
        }
      }
    }
  }
  return map;
}

/** Removes an exercise from an active session, cleaning up superset pairing if solitary */
export function removeSessionExercise(session: Session, exerciseId: string): Session {
  const target = session.exercises.find(e => e.id === exerciseId);
  if (!target) return session;

  let exercises = session.exercises.filter(e => e.id !== exerciseId);
  if (target.supersetId) {
    const remaining = exercises.filter(e => e.supersetId === target.supersetId);
    if (remaining.length <= 1) {
      exercises = exercises.map(e => {
        if (e.supersetId === target.supersetId) {
          const copy = { ...e };
          delete copy.supersetId;
          return copy;
        }
        return e;
      });
    }
  }

  return {
    ...session,
    exercises,
    orderAdapted: true,
  };
}

/** Updates discrete note for a specific session exercise */
export function updateSessionExerciseNotes(session: Session, exerciseId: string, notes: string): Session {
  return {
    ...session,
    exercises: session.exercises.map(ex => ex.id === exerciseId ? { ...ex, notes: notes.trim() || undefined } : ex),
  };
}

export type SessionPlanSyncAction =
  | { type: 'remove'; exerciseIdOrName: string }
  | { type: 'replace'; exerciseIdOrName: string; replacement: ReplaceExerciseInput }
  | { type: 'add'; exercise: Exercise }
  | { type: 'finish_loads'; session: Session };

/**
 * Synchronizes session modifications (remove, replace, add, and load progression upon finish)
 * directly into the corresponding underlying Plan in AppState.
 */
export function syncSessionChangesToPlan(
  state: AppState,
  planId: string,
  action: SessionPlanSyncAction
): AppState {
  const planIndex = state.plans.findIndex(p => p.id === planId);
  if (planIndex === -1) return state;

  const targetPlan = state.plans[planIndex];
  let exercises = [...targetPlan.exercises];
  let changed = false;

  if (action.type === 'remove') {
    const query = normalizeExercise(action.exerciseIdOrName);
    const target = exercises.find(e => e.id === action.exerciseIdOrName || normalizeExercise(e.name) === query);
    if (target) {
      if (target.supersetId) {
        const remaining = exercises.filter(e => e.supersetId === target.supersetId && e.id !== target.id);
        if (remaining.length <= 1) {
          exercises = exercises.map(e => {
            if (e.supersetId === target.supersetId) {
              const copy = { ...e };
              delete copy.supersetId;
              return copy;
            }
            return e;
          });
        }
      }
      exercises = exercises.filter(e => e.id !== target.id);
      changed = true;
    }
  } else if (action.type === 'replace') {
    const query = normalizeExercise(action.exerciseIdOrName);
    const targetIndex = exercises.findIndex(e => e.id === action.exerciseIdOrName || normalizeExercise(e.name) === query);
    if (targetIndex !== -1) {
      const orig = exercises[targetIndex];
      exercises[targetIndex] = {
        ...orig,
        name: action.replacement.name.trim(),
        muscle: action.replacement.muscle.trim() || orig.muscle,
        load: action.replacement.load ?? orig.load,
        reps: action.replacement.reps ?? orig.reps,
        catalogId: action.replacement.catalogId,
        origin: 'usuario',
      };
      changed = true;
    }
  } else if (action.type === 'add') {
    exercises.push(action.exercise);
    changed = true;
  } else if (action.type === 'finish_loads') {
    // For each completed exercise in the session, update the plan load to the maximum load achieved!
    for (const sEx of action.session.exercises) {
      const doneLogs = sEx.logs.filter(l => l.done && l.reps > 0);
      if (!doneLogs.length) continue;
      const maxLoad = Math.max(...doneLogs.map(l => l.load));
      const sKey = normalizeExercise(sEx.name);
      const pIdx = exercises.findIndex(e => e.id === sEx.id || (e.catalogId && e.catalogId === sEx.catalogId) || normalizeExercise(e.name) === sKey);
      if (pIdx !== -1 && exercises[pIdx].load !== maxLoad) {
        exercises[pIdx] = { ...exercises[pIdx], load: maxLoad };
        changed = true;
      }
    }
  }

  if (!changed) return state;

  const updatedPlan: Plan = {
    ...targetPlan,
    exercises,
    version: targetPlan.version + 1,
  };

  return {
    ...state,
    plans: state.plans.map(p => p.id === planId ? updatedPlan : p),
  };
}

export interface MonthlyExerciseStat {
  key: string;
  name: string;
  muscle: string;
  bestLoad: number;
  lastLoad: number;
  lastReps: number;
  totalSets: number;
  totalVolume: number;
  historyCount: number;
}

export interface MonthlyWorkoutReport {
  yearMonth: string;
  monthLabel: string;
  totalSessions: number;
  totalSets: number;
  totalVolume: number;
  exercises: MonthlyExerciseStat[];
}

/** Aggregates all completed workout stats for a given month (e.g. "2026-10") */
export function getMonthlyWorkoutReport(sessions: Session[], yearMonthPrefix?: string): MonthlyWorkoutReport {
  const currentPrefix = yearMonthPrefix || new Date().toISOString().slice(0, 7);
  const finishedInMonth = sessions.filter(s => s.finishedAt && s.date.startsWith(currentPrefix));

  const exMap = new Map<string, MonthlyExerciseStat>();
  let totalSets = 0;
  let totalVolume = 0;

  for (const s of [...finishedInMonth].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of s.exercises) {
      const done = ex.logs.filter(l => l.done && l.reps > 0);
      if (!done.length) continue;
      const key = exerciseKey(ex);
      const topSet = done.reduce((best, l) => l.load > best.load ? l : best);
      const lastSet = done.at(-1)!;
      const setsCount = done.length;
      const vol = done.reduce((sum, l) => sum + l.load * l.reps, 0);

      totalSets += setsCount;
      totalVolume += vol;

      const existing = exMap.get(key);
      if (!existing) {
        exMap.set(key, {
          key,
          name: ex.name,
          muscle: ex.muscle,
          bestLoad: topSet.load,
          lastLoad: lastSet.load,
          lastReps: lastSet.reps,
          totalSets: setsCount,
          totalVolume: vol,
          historyCount: 1,
        });
      } else {
        existing.bestLoad = Math.max(existing.bestLoad, topSet.load);
        existing.lastLoad = lastSet.load;
        existing.lastReps = lastSet.reps;
        existing.totalSets += setsCount;
        existing.totalVolume += vol;
        existing.historyCount += 1;
      }
    }
  }

  const [yearStr, monthStr] = currentPrefix.split('-');
  const dateObj = new Date(Number(yearStr), Number(monthStr) - 1, 15);
  const monthLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return {
    yearMonth: currentPrefix,
    monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    totalSessions: finishedInMonth.length,
    totalSets,
    totalVolume,
    exercises: [...exMap.values()].sort((a, b) => b.totalVolume - a.totalVolume),
  };
}
