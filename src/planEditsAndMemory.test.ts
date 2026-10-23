import { describe, it, expect, beforeEach } from 'vitest';
import { emptyState, type AppState, type Plan } from './domain';
import { matchExercise, matchPlan, createSuperset, removeSuperset, applyPlanUpdate, applyExerciseSettings, type PlanUpdateRequest } from './planEdits';
import { exerciseHistory } from './training';
import { rolloverMemory, applyMemoryUpdate, stripGreeting } from './aiMemory';
import { buildDataContext, buildMemoryBlock, recentConversation } from './aiContext';

describe('Bi-set creation, matching, and progression integrity', () => {
  const plan: Plan = {
    id: 'plan-seg',
    name: 'Treino A · Segunda-feira',
    subtitle: 'Peito e ombros',
    days: [1], // Segunda-feira
    version: 1,
    origin: 'personal',
    exercises: [
      { id: 'ex-1', name: 'Supino Reto com Barra Reta', muscle: 'Peito', sets: 4, reps: 10, load: 80, rest: 90, origin: 'personal' },
      { id: 'ex-2', name: 'Elevação Lateral com Halteres', muscle: 'Ombros', sets: 3, reps: 12, load: 14, rest: 60, origin: 'personal' },
      { id: 'ex-3', name: 'Tríceps Corda', muscle: 'Tríceps', sets: 3, reps: 12, load: 25, rest: 60, origin: 'personal' }
    ]
  };

  it('matches exercises with minor typos or abbreviations via fuzzy matching', () => {
    const match1 = matchExercise(plan.exercises, 'supino reto barra reta');
    expect(match1.ok).toBe(true);
    if (match1.ok) expect(match1.exercise.id).toBe('ex-1');

    const match2 = matchExercise(plan.exercises, 'elevacao lateral halter');
    expect(match2.ok).toBe(true);
    if (match2.ok) expect(match2.exercise.id).toBe('ex-2');
  });

  it('matches plan by day of the week (segunda)', () => {
    const matched = matchPlan([plan], 'segunda');
    expect(matched.ok).toBe(true);
    if (matched.ok) expect(matched.plan.id).toBe('plan-seg');
  });

  it('transforms supino reto and elevacao lateral into a bi-set while preserving individual loads and reps', () => {
    const res = createSuperset(plan.exercises, ['supino reto barra reta', 'elevacao lateral halter']);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.exercises).toHaveLength(3);
      const [supino, elevacao] = res.exercises;
      expect(supino.supersetId).toBeDefined();
      expect(elevacao.supersetId).toBeDefined();
      expect(supino.supersetId).toBe(elevacao.supersetId);

      // Kept individual progression parameters
      expect(supino.load).toBe(80);
      expect(supino.reps).toBe(10);
      expect(elevacao.load).toBe(14);
      expect(elevacao.reps).toBe(12);

      // Superset pair shares rest period (rest taken after completing the pair)
      expect(supino.rest).toBe(90);
      expect(elevacao.rest).toBe(90);
    }
  });

  it('applies plan update request and increments version without touching sessions', () => {
    const req: PlanUpdateRequest = {
      planIdOrName: 'segunda',
      supersetsToCreate: [['supino reto barra', 'elevacao lateral']]
    };

    const outcome = applyPlanUpdate(plan, req);
    expect(outcome.changed).toBe(true);
    expect(outcome.plan.version).toBe(2);
    expect(outcome.plan.exercises[0].supersetId).toBe(outcome.plan.exercises[1].supersetId);
  });

  it('guarantees that past session history and weight progression remain untouched before and after bi-set creation', () => {
    const initialSession = {
      id: 'sess-1',
      date: '2026-10-10',
      planId: plan.id,
      planVersion: 1,
      name: plan.name,
      startedAt: '2026-10-10T10:00:00Z',
      finishedAt: '2026-10-10T11:00:00Z',
      restEnd: null,
      notes: '',
      exercises: plan.exercises.map(e => ({
        ...e,
        logs: [{ id: 'l1', reps: e.reps, load: e.load, done: true, rir: 2 }]
      }))
    };

    const historyBefore = exerciseHistory([initialSession]);
    const supinoHistoryBefore = historyBefore.find(h => h.name === 'Supino Reto com Barra Reta');
    expect(supinoHistoryBefore?.entries[0].load).toBe(80);

    // Now user turns it into a bi-set in the plan:
    const req: PlanUpdateRequest = {
      planIdOrName: plan.name,
      supersetsToCreate: [['Supino Reto com Barra Reta', 'Elevação Lateral com Halteres']]
    };
    const outcome = applyPlanUpdate(plan, req);

    // Old sessions were NOT modified:
    const historyAfter = exerciseHistory([initialSession]);
    const supinoHistoryAfter = historyAfter.find(h => h.name === 'Supino Reto com Barra Reta');
    expect(supinoHistoryAfter?.entries[0].load).toBe(80);
    expect(JSON.stringify(historyBefore)).toBe(JSON.stringify(historyAfter));
  });
});

describe('AI Context Management, Daily Note & Anti-Greeting Behavior', () => {
  it('strips redundant greetings from AI answers', () => {
    expect(stripGreeting('Olá! Tudo bem? Vamos organizar seu treino.')).toBe('Vamos organizar seu treino.');
    expect(stripGreeting('Oi João! Tudo certo? Aqui está o ajuste.')).toBe('Aqui está o ajuste.');
    expect(stripGreeting('Bom dia, tudo bem? Podemos conjugar os exercícios.')).toBe('Podemos conjugar os exercícios.');
    expect(stripGreeting('Direto ao ponto sem saudação.')).toBe('Direto ao ponto sem saudação.');
  });

  it('rolls over daily memory, prunes old chat messages and digests past days', () => {
    const s: AppState = {
      ...emptyState(),
      chat: [
        { id: 'm1', role: 'user', text: 'Quero treinar pernas hoje', createdAt: '2026-10-13T10:00:00.000Z' },
        { id: 'm2', role: 'assistant', text: 'Perfeito, montei a divisão.', createdAt: '2026-10-13T10:01:00.000Z' },
        { id: 'm3', role: 'user', text: 'Hoje quero supino', createdAt: '2026-10-15T12:00:00.000Z' }
      ],
      aiMemory: {
        day: '2026-10-13',
        dailyNote: 'Usuário focou em pernas na terça.',
        history: [],
        facts: [{ id: 'f1', text: 'Treina às 6h', createdAt: '2026-10-12T10:00:00Z' }],
        updatedAt: '2026-10-13T10:00:00.000Z'
      }
    };

    const rolled = rolloverMemory(s, '2026-10-15');
    // Stale messages from 2026-10-13 are pruned from chat, only today (2026-10-15) remains
    expect(rolled.chat).toHaveLength(1);
    expect(rolled.chat[0].id).toBe('m3');

    // Past daily note from 2026-10-13 is archived in history
    expect(rolled.aiMemory.history).toHaveLength(1);
    expect(rolled.aiMemory.history[0].date).toBe('2026-10-13');
    expect(rolled.aiMemory.history[0].note).toContain('Usuário focou em pernas');

    // Facts remain
    expect(rolled.aiMemory.facts[0].text).toBe('Treina às 6h');
  });

  it('applies dailyNote update and stores durable safe facts', () => {
    const mem = emptyState().aiMemory;
    const updated = applyMemoryUpdate(mem, '2026-10-15', {
      dailyNote: 'Pediu para conjugar supino e elevacao lateral.',
      facts: ['Prefere bi-set de peito e ombro', 'senha123'] // unsafe password fact should be dropped!
    });

    expect(updated.dailyNote).toBe('Pediu para conjugar supino e elevacao lateral.');
    expect(updated.facts).toHaveLength(1);
    expect(updated.facts[0].text).toBe('Prefere bi-set de peito e ombro');
  });

  it('keeps data context compact and bounded within character limits', () => {
    const s = emptyState();
    const context = buildDataContext(s, '2026-10-15');
    expect(context.length).toBeLessThan(5000);
    expect(context).toContain('Hoje: 2026-10-15');
  });

  describe('applyExerciseSettings (PWA bi-set creation & exercise tuning)', () => {
    const plan: Plan = {
      id: 'plan-test',
      name: 'Treino A',
      subtitle: 'Peito e ombros',
      days: [1],
      version: 1,
      origin: 'personal',
      exercises: [
        { id: 'ex-1', name: 'Supino Reto com Barra Reta', muscle: 'Peito', sets: 4, reps: 10, load: 80, rest: 90, origin: 'personal' },
        { id: 'ex-2', name: 'Elevação Lateral com Halteres', muscle: 'Ombros', sets: 3, reps: 12, load: 14, rest: 60, origin: 'personal' },
        { id: 'ex-3', name: 'Tríceps Corda', muscle: 'Tríceps', sets: 3, reps: 12, load: 25, rest: 60, origin: 'personal' }
      ]
    };

    it('turns an exercise into a bi-set by pairing with an existing exercise of the day', () => {
      const initial = [...plan.exercises];
      const supinoUpdated = { ...initial[0], sets: 4, rest: 75 };
      const res = applyExerciseSettings(initial, supinoUpdated, {
        type: 'pair_existing',
        partnerId: 'ex-3' // Tríceps Corda
      });

      expect(res).toHaveLength(3);
      const [supino, triceps, elevacao] = res;
      // Pair formed and grouped sequentially
      expect(supino.id).toBe('ex-1');
      expect(triceps.id).toBe('ex-3');
      expect(supino.supersetId).toBeDefined();
      expect(triceps.supersetId).toBe(supino.supersetId);

      // Shared sets and rest
      expect(supino.sets).toBe(4);
      expect(triceps.sets).toBe(4);
      expect(supino.rest).toBe(75);
      expect(triceps.rest).toBe(75);

      // Third exercise remains unaffected
      expect(elevacao.id).toBe('ex-2');
      expect(elevacao.supersetId).toBeUndefined();
    });

    it('turns an exercise into a bi-set by adding a new partner exercise', () => {
      const initial = [...plan.exercises];
      const supinoUpdated = { ...initial[0], sets: 3, rest: 60 };
      const res = applyExerciseSettings(initial, supinoUpdated, {
        type: 'create_new',
        partner: {
          name: 'Crucifixo Inclinado com Halteres',
          muscle: 'Peito',
          reps: 15,
          load: 18
        }
      });

      expect(res).toHaveLength(4);
      const [supino, crucifixo, elevacao, triceps] = res;
      expect(supino.id).toBe('ex-1');
      expect(crucifixo.name).toBe('Crucifixo Inclinado com Halteres');
      expect(crucifixo.muscle).toBe('Peito');
      expect(crucifixo.reps).toBe(15);
      expect(crucifixo.load).toBe(18);

      // Both share sets and rest
      expect(crucifixo.sets).toBe(3);
      expect(crucifixo.rest).toBe(60);
      expect(supino.supersetId).toBeDefined();
      expect(crucifixo.supersetId).toBe(supino.supersetId);

      // Other exercises preserved
      expect(elevacao.id).toBe('ex-2');
      expect(triceps.id).toBe('ex-3');
    });

    it('unpairs an existing bi-set into individual exercises', () => {
      // Start with a paired set
      const paired = applyExerciseSettings(plan.exercises, plan.exercises[0], {
        type: 'pair_existing',
        partnerId: 'ex-2'
      });
      expect(paired[0].supersetId).toBeDefined();
      expect(paired[1].supersetId).toBe(paired[0].supersetId);

      // Now unpair via settings
      const unpaired = applyExerciseSettings(paired, paired[0], { type: 'unpair' });
      expect(unpaired[0].supersetId).toBeUndefined();
      expect(unpaired[1].supersetId).toBeUndefined();
      expect(unpaired).toHaveLength(3);
    });
  });
});

