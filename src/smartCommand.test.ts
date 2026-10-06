import { describe, it, expect, beforeEach } from 'vitest';
import { emptyState, type AppState } from './domain';
import { applySmartCards, type SmartCardChange } from './smartCommand';
import { getAuditLogs, revertAuditEntry, clearAuditLogs } from './auditLog';

describe('Smart Command Card Approval & State Mutations', () => {
  beforeEach(() => {
    clearAuditLogs();
  });

  it('applies only selected cards and generates audit log with reversible snapshot', () => {
    const initial: AppState = emptyState();
    expect(initial.profile.calories).toBe(2000);
    expect(initial.profile.protein).toBe(150);

    const cardCal: SmartCardChange = {
      id: 'c1',
      category: 'diet_macros',
      icon: 'flame',
      title: 'Meta Calórica',
      subtitle: 'Aumento diário',
      badge: 'Meta',
      before: '2.000 kcal',
      after: '2.600 kcal',
      selected: true,
      apply: (s) => ({ ...s, profile: { ...s.profile, calories: 2600 } })
    };

    const cardProt: SmartCardChange = {
      id: 'c2',
      category: 'diet_macros',
      icon: 'protein',
      title: 'Meta Proteica',
      subtitle: 'Aporte proteico',
      badge: 'Meta',
      before: '150g',
      after: '190g',
      selected: false, // User unchecked this card!
      apply: (s) => ({ ...s, profile: { ...s.profile, protein: 190 } })
    };

    const { nextState, logEntry } = applySmartCards(
      initial,
      [cardCal, cardProt],
      'Mudar calorias para 2600 e proteina para 190',
      { intent: 'diet_and_nutrition', confidence: 0.99 }
    );

    // Only cardCal should have been applied
    expect(nextState.profile.calories).toBe(2600);
    expect(nextState.profile.protein).toBe(150); // Unchecked card was skipped!

    // Verify Audit log was written
    const logs = getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(logEntry.id);
    expect(logs[0].changes).toHaveLength(1);
    expect(logs[0].changes[0].label).toBe('Meta Calórica');

    // Reverting restores state back to initial exactly
    const revertResult = revertAuditEntry(logEntry.id, nextState);
    expect(revertResult.success).toBe(true);
    expect(revertResult.restoredState?.profile.calories).toBe(2000);
  });

  it('bulk adds a workout plan via card application and validates domain schema', () => {
    const initial: AppState = emptyState();
    expect(initial.plans).toHaveLength(0);

    const newPlanCard: SmartCardChange = {
      id: 'p1',
      category: 'workout_plan_new',
      icon: 'dumbbell',
      title: 'Novo Plano: Treino A',
      subtitle: 'Peito e Tríceps',
      badge: 'Novo Treino',
      before: 'Nenhum plano',
      after: '2 exercícios',
      selected: true,
      apply: (s) => ({
        ...s,
        plans: [
          ...s.plans,
          {
            id: 'plan-abc',
            name: 'Treino A · Peito e Tríceps',
            subtitle: 'Peito, ombros e tríceps',
            days: [1, 4],
            origin: 'ia',
            version: 1,
            exercises: [
              {
                id: 'ex-1',
                name: 'Supino Reto',
                muscle: 'Peito',
                sets: 4,
                reps: 10,
                load: 70,
                rest: 90,
                origin: 'ia'
              }
            ]
          }
        ]
      })
    };

    const { nextState } = applySmartCards(
      initial,
      [newPlanCard],
      'Criar treino A de peito com supino'
    );

    expect(nextState.plans).toHaveLength(1);
    expect(nextState.plans[0].name).toBe('Treino A · Peito e Tríceps');
    expect(nextState.plans[0].exercises[0].name).toBe('Supino Reto');
  });
});
