import { describe, it, expect, beforeEach } from 'vitest';
import { emptyState, type AppState } from './domain';
import { applySmartCards, calculateMetabolicProfile, type SmartCardChange } from './smartCommand';
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

  it('calculates scientifically calibrated metabolic targets for recomposition (Matheus)', () => {
    const initial: AppState = emptyState();
    const result = calculateMetabolicProfile({
      weight: 80,
      fatPercent: 18,
      goal: 'Recomposição corporal',
      currentState: initial
    });

    // FFM = 80 * (1 - 0.18) = 65.6 kg
    expect(result.fatFreeMass).toBe(65.6);
    // TMB (Katch-McArdle) = 370 + 21.6 * 65.6 = 1787 kcal
    expect(result.tmb).toBe(1787);
    // TDEE = 1787 * 1.45 = 2591 kcal
    expect(result.tdee).toBe(2591);
    // Recomposition target = TDEE - 180 kcal = 2411 kcal
    expect(result.targetKcal).toBe(2411);
    // Protein ~2.3g/kg of FFM = 65.6 * 2.3 = 151g
    expect(result.protein).toBeGreaterThanOrEqual(150);
    // Water ~40ml/kg = 3200ml
    expect(result.water).toBe(3200);
    expect(result.goal).toBe('Recomposição corporal');
  });

  it('calculates caloric deficit and body metrics for fat loss bioimpedance (82kg, 20% fat, 1.78m)', () => {
    const initial: AppState = emptyState();
    const result = calculateMetabolicProfile({
      weight: 82,
      fatPercent: 20,
      height: 178,
      goal: 'Perder gordura',
      currentState: initial
    });

    // FFM = 82 * 0.8 = 65.6 kg
    expect(result.fatFreeMass).toBe(65.6);
    expect(result.fatMass).toBe(16.4);
    // TMB = 1787
    expect(result.tmb).toBe(1787);
    // TDEE = 2591
    expect(result.tdee).toBe(2591);
    // Fat loss deficit = 2591 - 450 = 2141 kcal
    expect(result.targetKcal).toBe(2141);
    // BMI = 82 / (1.78^2) = 25.9
    expect(result.bmi).toBe(25.9);
    // Water = 82 * 40 = 3280ml
    expect(result.water).toBe(3280);
    expect(result.targetWeight).toBe(75);
  });

  it('plans changes from multimodal attached screenshot with OCR data', async () => {
    const initial: AppState = emptyState();
    
    // Mock global fetch for Gemini API
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        const bodyStr = String(init?.body || '');
        // Verify inlineData part was sent
        expect(bodyStr).toContain('inlineData');
        expect(bodyStr).toContain('image/png');
        expect(bodyStr).toContain('fake-base64-data');
        
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: 'Laudo InBody lido com sucesso: 82kg, 20% gordura e 1.78m.',
                        bodyToAdd: {
                          weight: 82,
                          fat: 20,
                          muscle: 37,
                          height: 178
                        },
                        profileUpdates: {
                          name: 'Matheus',
                          goal: 'Perder gordura',
                          calories: 2140,
                          protein: 160,
                          carbs: 230,
                          fat: 65,
                          water: 3300,
                          targetWeight: 75
                        }
                      })
                    }
                  ]
                }
              }
            ]
          })
        } as Response;
      }
      return originalFetch(url, init);
    };

    try {
      const { planSmartCommand } = await import('./smartCommand');
      const plan = await planSmartCommand(
        '', // Empty prompt, relying on attached image
        initial,
        {
          data: 'fake-base64-data',
          mimeType: 'image/png',
          name: 'inbody_exam.png',
          previewUrl: 'data:image/png;base64,fake-base64-data'
        }
      );

      expect(plan.cards.length).toBeGreaterThan(0);
      const bioCard = plan.cards.find(c => c.category === 'body_metric');
      expect(bioCard).toBeDefined();
      expect(bioCard?.title).toBe('Nova Avaliação de Bioimpedância');
      expect(bioCard?.after).toContain('82 kg');
      expect(bioCard?.after).toContain('20% gordura');

      const nameCard = plan.cards.find(c => c.title === 'Nome no Perfil');
      expect(nameCard).toBeDefined();
      expect(nameCard?.after).toBe('Matheus');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

