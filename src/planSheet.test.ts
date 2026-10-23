import { describe, expect, it } from 'vitest';
import { makePlan, type Session } from './domain';
import { changeStops, diffPlans } from './planDiff';
import { editPlanCell, exportPlansSheet, loadHistoryMap, parseCell, setSupersetPartner } from './planSheet';

describe('planSheet helpers', () => {
  it('parses valid numeric cells and rejects invalid values', () => {
    expect(parseCell('sets', '4')).toBe(4);
    expect(parseCell('sets', '4.5')).toBeNull(); // integer only
    expect(parseCell('sets', '0')).toBeNull(); // min 1
    expect(parseCell('sets', '20')).toBeNull(); // max 15
    expect(parseCell('load', '42,5')).toBe(42.5); // comma decimal
    expect(parseCell('load', '120.25')).toBe(120.3); // rounded to 1 decimal
    expect(parseCell('rest', '90')).toBe(90);
  });

  it('edits a plan cell and bumps the version only when value changes', () => {
    const plan = makePlan();
    const exId = plan.exercises[0].id;
    const initialVersion = plan.version;

    const unchanged = editPlanCell(plan, exId, 'load', plan.exercises[0].load);
    expect(unchanged).toBe(plan);

    const updated = editPlanCell(plan, exId, 'load', 55);
    expect(updated.version).toBe(initialVersion + 1);
    expect(updated.exercises[0].load).toBe(55);
  });

  it('pairs and unpairs bi-set exercises properly', () => {
    const plan = makePlan();
    const ex1 = plan.exercises[0].id;
    const ex2 = plan.exercises[1].id;

    const paired = setSupersetPartner(plan, ex1, ex2);
    expect(paired.version).toBe(plan.version + 1);
    expect(paired.exercises[0].supersetId).toBeDefined();
    expect(paired.exercises[0].supersetId).toBe(paired.exercises[1].supersetId);

    // Unpair
    const unpaired = setSupersetPartner(paired, ex1, '');
    expect(unpaired.exercises[0].supersetId).toBeUndefined();
    // Since ex2 was solitary, it was dissolved as well
    expect(unpaired.exercises[1].supersetId).toBeUndefined();
  });

  it('computes load history map from completed sessions', () => {
    const plan = makePlan();
    const exName = plan.exercises[0].name;
    const sessions: Session[] = [
      {
        id: 's1',
        date: '2026-10-01',
        planId: plan.id,
        planVersion: 1,
        name: plan.name,
        startedAt: '2026-10-01T10:00:00Z',
        finishedAt: '2026-10-01T11:00:00Z',
        restEnd: null,
        notes: '',
        exercises: [{
          ...plan.exercises[0],
          logs: [
            { id: 'l1', done: true, reps: 10, load: 40, rir: 2 },
            { id: 'l2', done: true, reps: 10, load: 45, rir: 1 },
          ],
        }],
      },
      {
        id: 's2',
        date: '2026-10-15',
        planId: plan.id,
        planVersion: 1,
        name: plan.name,
        startedAt: '2026-10-15T10:00:00Z',
        finishedAt: '2026-10-15T11:00:00Z',
        restEnd: null,
        notes: '',
        exercises: [{
          ...plan.exercises[0],
          logs: [
            { id: 'l3', done: true, reps: 8, load: 50, rir: 1 },
          ],
        }],
      },
    ];

    const history = loadHistoryMap(sessions);
    const item = history.get({ name: exName });
    expect(item.initial?.load).toBe(45);
    expect(item.initial?.date).toBe('2026-10-01');
    expect(item.last?.load).toBe(50);
    expect(item.last?.reps).toBe(8);
    expect(item.last?.date).toBe('2026-10-15');
  });

  it('exports plan sheet as valid CSV with bi-sets and history', () => {
    const plan = makePlan();
    const csvContent = exportPlansSheet({ plans: [plan], sessions: [] });
    expect(csvContent).toContain('"plano";"dias";"versao";"ordem";"exercicio";"grupo";"biset_grupo"');
    expect(csvContent).toContain(plan.name);
    expect(csvContent).toContain(plan.exercises[0].name);
  });
});

describe('planDiff', () => {
  it('detects changes in exercises and builds stops', () => {
    const before = [makePlan()];
    const after = [{
      ...before[0],
      exercises: before[0].exercises.map((ex, idx) => idx === 0 ? { ...ex, load: 60, rest: 90 } : ex),
    }];

    const diffs = diffPlans(before, after);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].exercises).toHaveLength(1);
    expect(diffs[0].exercises[0].fields.map(f => f.key)).toContain('load');
    expect(diffs[0].exercises[0].fields.map(f => f.key)).toContain('rest');

    const stops = changeStops(diffs);
    expect(stops).toHaveLength(1);
    expect(stops[0].title).toContain(before[0].exercises[0].name);
    expect(stops[0].detail).toContain('Carga: 40 kg → 60 kg');
  });
});
