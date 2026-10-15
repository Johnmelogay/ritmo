import { type AppState, type Exercise, type Session } from './domain';
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
