import { describe, expect, it } from 'vitest';
import { createSession, emptyState, exerciseSchema, stateSchema, exportSets, exportAdaptations, weekDates, type Plan } from './domain';
import {
  dailyReviewContext,
  exerciseHistory,
  normalizeExercise,
  parseTrainingNumber,
  shouldStartRest,
  replaceSessionExercise,
  reorderSessionExercises,
  reorderSessionUnits,
  swapBiSetExercises,
  reorderPlanUnits,
  swapPlanBiSetExercises,
  sessionAdaptations,
  removeSessionExercise,
  updateSessionExerciseNotes,
  getLastExercisePerformance,
  getLastExerciseStatsMap,
  getMonthlyWorkoutReport,
} from './training';
import { executeWorkoutToolCall, AI_WORKOUT_TOOLS } from './aiWorkoutTools';

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

  describe('exercise substitution and reordering in sessions', () => {
    it('never replaces an exercise with completed sets or discards its historical loads', () => {
      const current = session();
      current.exercises[0].logs[1] = { ...current.exercises[0].logs[1], done: true, load: 32, reps: 8 };
      const snapshot = JSON.stringify(current);
      expect(replaceSessionExercise(current, 'a', { name: 'Outro exercício', muscle: 'Peito', load: 10, reps: 12, reason: 'Teste' })).toBe(current);
      expect(JSON.stringify(current)).toBe(snapshot);
    });
    it('substitutes an exercise during a session, preserving sets and recording replacedFrom and reason', () => {
      const current = session();
      const updated = replaceSessionExercise(current, 'a', {
        name: 'Supino Inclinado com Halteres',
        muscle: 'Peito Superior',
        load: 24,
        reps: 10,
        reason: 'Banco reto ocupado'
      });

      expect(updated.orderAdapted).toBe(true);
      expect(updated.exercises).toHaveLength(2);
      const replaced = updated.exercises[0];
      expect(replaced.name).toBe('Supino Inclinado com Halteres');
      expect(replaced.muscle).toBe('Peito Superior');
      expect(replaced.load).toBe(24);
      expect(replaced.reason).toBe('Banco reto ocupado');
      expect(replaced.replacedFrom).toEqual({
        id: 'a',
        name: 'Supino',
        muscle: 'Peito'
      });
      // Inherited 2 sets and rest from the original exercise
      expect(replaced.sets).toBe(2);
      expect(replaced.logs).toHaveLength(2);
      expect(replaced.logs[0].load).toBe(24);
    });

    it('reorders exercises in a session and tracks adaptations', () => {
      const plan: Plan = {
        id: 'plan-3',
        name: 'Treino C',
        subtitle: '',
        days: [1],
        origin: 'usuario',
        version: 1,
        exercises: [
          exercise('ex-1', 'Exercício 1'),
          exercise('ex-2', 'Exercício 2'),
          exercise('ex-3', 'Exercício 3')
        ]
      };
      const sess = createSession(plan, '2026-10-15');
      const reordered = reorderSessionExercises(sess, 0, 2);

      expect(reordered.orderAdapted).toBe(true);
      expect(reordered.exercises.map(e => e.id)).toEqual(['ex-2', 'ex-3', 'ex-1']);
    });

    it('extracts adaptations across sessions for monthly reports', () => {
      const current = session();
      const adapted = replaceSessionExercise(current, 'a', {
        name: 'Crucifixo Máquina',
        muscle: 'Peito',
        load: 40,
        reps: 12,
        reason: 'Variação para isolamento'
      });
      adapted.finishedAt = '2026-10-15T16:00:00Z';
      adapted.exercises[0].logs[0].done = true;
      adapted.exercises[0].logs[1].done = true;

      const adaptations = sessionAdaptations([adapted]);
      expect(adaptations).toHaveLength(1);
      expect(adaptations[0]).toMatchObject({
        date: '2026-10-15',
        originalName: 'Supino',
        newName: 'Crucifixo Máquina',
        reason: 'Variação para isolamento',
        sets: 2,
        maxLoad: 40
      });

      const state = emptyState();
      state.sessions = [adapted];
      const csvOutput = exportAdaptations(state);
      expect(csvOutput).toContain('Crucifixo Máquina');
      expect(csvOutput).toContain('Supino');
      expect(csvOutput).toContain('Variação para isolamento');
    });

    it('calculates weekly dates starting on Monday and resetting every Monday', () => {
      // 2026-10-15 is Thursday
      const weekThu = weekDates('2026-10-15');
      expect(weekThu[0]).toBe('2026-10-12'); // Monday
      expect(weekThu[6]).toBe('2026-10-18'); // Sunday
      expect(weekThu).toHaveLength(7);

      // 2026-10-18 is Sunday (same week)
      const weekSun = weekDates('2026-10-18');
      expect(weekSun[0]).toBe('2026-10-12');
      expect(weekSun[6]).toBe('2026-10-18');

      // Next day: 2026-10-19 is Monday (new week starts, count resets)
      const weekNextMon = weekDates('2026-10-19');
      expect(weekNextMon[0]).toBe('2026-10-19');
      expect(weekNextMon[6]).toBe('2026-10-25');
      expect(weekNextMon).not.toContain('2026-10-15');
    });

    it('reorderSessionUnits preserves bi-set pairs together when moving units', () => {
      const plan: Plan = {
        id: 'plan-units',
        name: 'Treino Bi-set',
        subtitle: '',
        days: [1],
        origin: 'usuario',
        version: 1,
        exercises: [
          exercise('ex-1', 'Exercício 1', 'biset-1'),
          exercise('ex-2', 'Exercício 2', 'biset-1'),
          exercise('ex-3', 'Exercício 3'),
          exercise('ex-4', 'Exercício 4')
        ]
      };
      const sess = createSession(plan, '2026-10-15');

      // Move unit 0 (the bi-set pair) to index 1 (between ex-3 and ex-4)
      const reordered = reorderSessionUnits(sess, 0, 1);
      expect(reordered.exercises.map(e => e.id)).toEqual(['ex-3', 'ex-1', 'ex-2', 'ex-4']);
      // Bi-set pair remains contiguous and intact
      expect(reordered.exercises[1].supersetId).toBe('biset-1');
      expect(reordered.exercises[2].supersetId).toBe('biset-1');

      // Move unit 2 (ex-4) to top (index 0)
      const movedTop = reorderSessionUnits(reordered, 2, 0);
      expect(movedTop.exercises.map(e => e.id)).toEqual(['ex-4', 'ex-3', 'ex-1', 'ex-2']);
    });

    it('swapBiSetExercises swaps the order of exercises within a bi-set', () => {
      const sess = session(); // has pair 'a' and 'b' with supersetId 'pair'
      expect(sess.exercises.map(e => e.id)).toEqual(['a', 'b']);

      const swapped = swapBiSetExercises(sess, 'pair');
      expect(swapped.exercises.map(e => e.id)).toEqual(['b', 'a']);
      expect(swapped.exercises[0].supersetId).toBe('pair');
      expect(swapped.exercises[1].supersetId).toBe('pair');
      expect(swapped.orderAdapted).toBe(true);
    });

    it('reorderPlanUnits and swapPlanBiSetExercises work on plan exercises', () => {
      const planExercises = [
        exercise('p-1', 'Supino Reto', 'pair-p'),
        exercise('p-2', 'Crucifixo Reto', 'pair-p'),
        exercise('p-3', 'Tríceps Corda'),
        exercise('p-4', 'Elevação Lateral')
      ];

      // Move unit 0 (the bi-set pair) to end
      const reordered = reorderPlanUnits(planExercises, 0, 2);
      expect(reordered.map(e => e.id)).toEqual(['p-3', 'p-4', 'p-1', 'p-2']);
      expect(reordered[2].supersetId).toBe('pair-p');
      expect(reordered[3].supersetId).toBe('pair-p');

      // Swap the exercises within the bi-set
      const swapped = swapPlanBiSetExercises(reordered, 'pair-p');
      expect(swapped.map(e => e.id)).toEqual(['p-3', 'p-4', 'p-2', 'p-1']);
    });
  });

  describe('Tecnofit UX Overhaul & AI Workout Tools', () => {
    it('removeSessionExercise unpairs remaining bi-set partner when one is removed', () => {
      const current = session(); // exercises 'a' and 'b' sharing supersetId 'pair'
      expect(current.exercises[0].supersetId).toBe('pair');
      expect(current.exercises[1].supersetId).toBe('pair');

      const updated = removeSessionExercise(current, 'a');
      expect(updated.exercises).toHaveLength(1);
      expect(updated.exercises[0].id).toBe('b');
      // Solitary partner now has supersetId cleared!
      expect(updated.exercises[0].supersetId).toBeUndefined();
    });

    it('updateSessionExerciseNotes saves machine pin / discrete notes', () => {
      const current = session();
      const updated = updateSessionExerciseNotes(current, 'a', 'Banco no furo 3, pegada neutra');
      expect(updated.exercises.find(e => e.id === 'a')?.notes).toBe('Banco no furo 3, pegada neutra');
    });

    it('getLastExercisePerformance extracts previous session loads and reps', () => {
      const s1 = session();
      s1.date = '2026-10-01';
      s1.finishedAt = '2026-10-01T19:00:00Z';
      s1.exercises[0].logs[0].done = true;
      s1.exercises[0].logs[0].load = 32.5;
      s1.exercises[0].logs[0].reps = 10;
      s1.exercises[0].logs[1].done = true;
      s1.exercises[0].logs[1].load = 35;
      s1.exercises[0].logs[1].reps = 8;

      const s2 = session();
      s2.date = '2026-10-08';
      s2.finishedAt = '2026-10-08T19:00:00Z';
      s2.exercises[0].logs[0].done = true;
      s2.exercises[0].logs[0].load = 37.5;
      s2.exercises[0].logs[0].reps = 8;

      const last = getLastExercisePerformance([s1, s2], 'Supino');
      expect(last).not.toBeNull();
      expect(last?.load).toBe(37.5);
      expect(last?.reps).toBe(8);

      const statsMap = getLastExerciseStatsMap([s1, s2]);
      const supinoStats = statsMap.get(normalizeExercise('Supino'));
      expect(supinoStats?.load).toBe(37.5);
    });

    it('getMonthlyWorkoutReport aggregates monthly sessions, volumes, and max capacities', () => {
      const s1 = session();
      s1.date = '2026-10-05';
      s1.finishedAt = '2026-10-05T19:00:00Z';
      s1.exercises[0].logs[0].done = true;
      s1.exercises[0].logs[0].load = 40;
      s1.exercises[0].logs[0].reps = 10; // 400 volume
      s1.exercises[0].logs[1].done = true;
      s1.exercises[0].logs[1].load = 50;
      s1.exercises[0].logs[1].reps = 6;  // 300 volume

      const report = getMonthlyWorkoutReport([s1], '2026-10');
      expect(report.totalSessions).toBe(1);
      expect(report.totalSets).toBe(2);
      expect(report.totalVolume).toBe(700);
      expect(report.exercises).toHaveLength(1);
      expect(report.exercises[0].name).toBe('Supino');
      expect(report.exercises[0].bestLoad).toBe(50);
      expect(report.exercises[0].lastLoad).toBe(50);
      expect(report.exercises[0].totalVolume).toBe(700);
    });

    it('executeWorkoutToolCall supports universal AI workout manipulations', () => {
      const state = emptyState();
      const p: Plan = {
        id: 'plan-1',
        name: 'Treino A',
        subtitle: '',
        days: [1],
        origin: 'usuario',
        version: 1,
        exercises: [
          exercise('e1', 'Supino Reto'),
          exercise('e2', 'Crucifixo Reto'),
          exercise('e3', 'Tríceps Corda')
        ]
      };
      state.plans = [p];
      const sess = createSession(p, '2026-10-22');
      state.sessions = [sess];

      // 1. Toolcall: set_exercise_notes
      const noteRes = executeWorkoutToolCall(state, 'set_exercise_notes', {
        exerciseName: 'Supino Reto',
        note: 'Banco regulado no pino 4'
      });
      expect(noteRes.success).toBe(true);
      expect(noteRes.state.sessions[0].exercises[0].notes).toBe('Banco regulado no pino 4');

      // 2. Toolcall: update_exercise_load
      const loadRes = executeWorkoutToolCall(noteRes.state, 'update_exercise_load', {
        exerciseName: 'Supino Reto',
        load: 60,
        persistToPlan: true
      });
      expect(loadRes.success).toBe(true);
      expect(loadRes.state.sessions[0].exercises[0].load).toBe(60);
      expect(loadRes.state.plans[0].exercises[0].load).toBe(60);

      // 3. Toolcall: create_bi_set
      const biSetRes = executeWorkoutToolCall(loadRes.state, 'create_bi_set', {
        exerciseNames: ['Supino Reto', 'Crucifixo Reto'],
        persistToPlan: true
      });
      expect(biSetRes.success).toBe(true);
      const planSupersets = new Set(biSetRes.state.plans[0].exercises.slice(0, 2).map(e => e.supersetId));
      expect(planSupersets.size).toBe(1);
      expect([...planSupersets][0]).toBeDefined();

      // 4. Toolcall: replace_exercise
      const repRes = executeWorkoutToolCall(biSetRes.state, 'replace_exercise', {
        currentExerciseName: 'Tríceps Corda',
        replacementName: 'Tríceps Testa',
        muscle: 'Tríceps',
        load: 25,
        reps: 12,
        reason: 'Aparelho ocupado'
      });
      expect(repRes.success).toBe(true);
      expect(repRes.state.sessions[0].exercises[2].name).toBe('Tríceps Testa');
      expect(repRes.state.sessions[0].exercises[2].replacedFrom?.name).toBe('Tríceps Corda');
      expect(repRes.state.plans[0].exercises[2].name).toBe('Tríceps Testa');

      // 5. Toolcall: remove_exercise
      const remRes = executeWorkoutToolCall(repRes.state, 'remove_exercise', {
        exerciseName: 'Tríceps Testa',
        persistToPlan: true
      });
      expect(remRes.success).toBe(true);
      expect(remRes.state.sessions[0].exercises.some(e => e.name === 'Tríceps Testa')).toBe(false);
      expect(remRes.state.plans[0].exercises.some(e => e.name === 'Tríceps Testa')).toBe(false);

      // 6. Toolcall: get_monthly_training_report
      const reportRes = executeWorkoutToolCall(remRes.state, 'get_monthly_training_report', {
        yearMonth: '2026-10'
      });
      expect(reportRes.success).toBe(true);
      expect(reportRes.data).toBeDefined();
    });
  });
});
