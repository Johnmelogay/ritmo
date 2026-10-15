import { describe, expect, it } from 'vitest';
import { createSession, emptyState, exerciseSchema, stateSchema, exportSets, type Plan } from './domain';
import { dailyReviewContext, exerciseHistory, normalizeExercise, parseTrainingNumber, shouldStartRest } from './training';

const exercise = (id: string, name: string, supersetId?: string) => exerciseSchema.parse({ id, name, muscle: 'Peito', sets: 2, reps: 10, load: 20, rest: 90, origin: 'usuario', ...(supersetId ? { supersetId } : {}) });
function session() {
  const plan: Plan = { id: 'plan', name: 'Treino A', subtitle: '', days: [4], exercises: [exercise('a', 'Supino', 'pair'), exercise('b', 'Remada', 'pair')], origin: 'usuario', version: 1 };
  return createSession(plan, '2026-10-15');
}
describe('training numeric input', () => {
  it('accepts decimal comma and decimals without leading zero', () => {
    expect(parseTrainingNumber('22,5', 0, 1000)).toBe(22.5);
    expect(parseTrainingNumber('12', 0, 200, true)).toBe(12);
    expect(parseTrainingNumber('0', 0, 1000)).toBe(0);
  });
  it('rejects empty/invalid/out of range inputs and fractional reps', () => {
    for (const raw of ['', ' ', '-2', 'Infinity', 'abc', '20kg', '1001', '1e2']) expect(parseTrainingNumber(raw, 0, 1000)).toBeNull();
    expect(parseTrainingNumber('2.5', 0, 200, true)).toBeNull();
  });
});
describe('bi-set schema and timer', () => {
  it('keeps links and catalogue IDs in session copies and backups', () => {
    const current = session(); current.exercises[0].catalogId = 'supino';
    const state = emptyState(); state.sessions = [current];
    expect(current.exercises[0].supersetId).toBe(current.exercises[1].supersetId);
    expect(stateSchema.parse(JSON.parse(JSON.stringify(state))).sessions[0].exercises[0].catalogId).toBe('supino');
    expect(exportSets(state)).toContain('dupla_id');
    expect(exportSets(state)).toContain('"pair"');
  });
  it('starts rest only when the other exercise in the round is complete', () => {
    const current = session();
    expect(shouldStartRest(current, 'a', 0)).toBe(false);
    current.exercises[0].logs[0].done = true;
    expect(shouldStartRest(current, 'b', 0)).toBe(true);
    expect(shouldStartRest(current, 'b', 1)).toBe(false);
  });
  it('retains normal rest for a standalone exercise', () => {
    const current = session(); delete current.exercises[0].supersetId;
    expect(shouldStartRest(current, 'a', 0)).toBe(true);
  });
});
describe('real progression and review context', () => {
  it('ignores uncompleted sets and unfinished sessions', () => {
    const current = session(); current.exercises[0].logs[0].done = true;
    expect(exerciseHistory([current])).toHaveLength(0);
    current.finishedAt = '2026-10-15T15:00:00Z';
    const history = exerciseHistory([current]);
    expect(history).toHaveLength(1);
    expect(history[0].entries[0]).toMatchObject({ load: 20, reps: 10, sets: 1, volume: 200 });
  });
  it('normalizes Portuguese names without accents', () => {
    expect(normalizeExercise('  ELEVAÇÃO Lateral ')).toBe('elevacao lateral');
  });
  it('includes unfinished workout logs, water, recovery and day completeness without sending name', () => {
    const state = emptyState(); state.sessions = [session()]; state.water['2026-10-15'] = 500;
    state.recovery = [{ id: 'r', date: '2026-10-15', sleep: 7, energy: 8, soreness: 2, notes: 'Rotina diferente' }];
    const context = dailyReviewContext(state, '2026-10-15');
    expect(context.workouts).toHaveLength(1);
    expect(context.waterMl).toBe(500);
    expect(context.recovery[0].notes).toBe('Rotina diferente');
    expect(context.reviewed).toBe(false);
    expect(context.goals).not.toHaveProperty('name');
    expect(dailyReviewContext(state, '2026-10-16').workouts).toHaveLength(0);
  });
});
