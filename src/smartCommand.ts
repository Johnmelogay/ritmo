import { z } from 'zod';
import {
  type AppState,
  type Plan,
  type Meal,
  type Exercise,
  uid,
  today,
  stateSchema,
  foods,
  ingredient,
  type Origin,
  type Profile
} from './domain';
import { getGeminiKey, getTypeSafeKey } from './ai';
import {
  recordAuditEntry,
  type AuditLogEntry,
  type ChangeCategory,
  type FieldChangeSummary
} from './auditLog';
import { curatedExercises, searchLocalExercises } from './workoutDb';

export type SmartIcon = 'target' | 'flame' | 'protein' | 'dumbbell' | 'refresh' | 'utensils' | 'scale';

export interface SmartCardChange {
  id: string;
  category: ChangeCategory;
  icon: SmartIcon;
  title: string;
  subtitle: string;
  badge: string;
  before?: string | null;
  after?: string | null;
  details?: string[];
  selected: boolean;
  apply: (state: AppState) => AppState;
}

export interface SmartPlanResult {
  summary: string;
  clarifyingQuestion?: string;
  jevDecision?: {
    intent: string;
    confidence: number;
    choiceDetails?: string;
    latencyMs?: number;
  };
  cards: SmartCardChange[];
}

export interface JevSuggestionPill {
  label: string;
  appendText: string;
  icon?: string;
}

export interface RealtimeJevResult {
  latencyMs: number;
  domain: string;
  confidence: number;
  pills: JevSuggestionPill[];
}

/**
 * 1. Avaliação instantânea em tempo real via TypeSafe / JEV System One
 * executada enquanto o usuário digita (com debounce) para sugerir complementos
 * com velocidade calibrada sub-500ms.
 */
export async function fetchRealtimeJevSuggestions(
  query: string,
  currentState?: AppState
): Promise<RealtimeJevResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  const key = getTypeSafeKey();
  const startTime = performance.now();

  // Baseline contextual imediato caso offline ou chave pendente
  const localPills = generateInstantFallbackPills(trimmed);

  if (!key) {
    return {
      latencyMs: Math.round(performance.now() - startTime),
      domain: 'local',
      confidence: 1,
      pills: localPills
    };
  }

  const url = import.meta.env.DEV ? '/api/typesafe/v1/systemone' : 'https://api.typesafe.ai/v1/systemone';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: `Texto digitado pelo usuário no app de treino e nutrição Ritmo:\n"${trimmed}"`,
        model: 'jev-latest',
        questions: {
          domain: {
            type: 'choice',
            instructions: 'Qual é o domínio primário do aplicativo relacionado ao texto digitado?',
            criteria: {
              workout: 'Musculação, ficha de treino, divisão ABC, exercícios, séries e repetições',
              diet_goals: 'Metas de calorias diárias, proteínas, carboidratos, água ou peso de referência',
              meal_log: 'Alimento específico consumido (ex: arroz, frango, ovos, almoço)',
              general: 'Outro ou genérico'
            }
          },
          subintent: {
            type: 'choice',
            instructions: 'Qual é a especificidade ou ação pretendida?',
            criteria: {
              create_leg_workout: 'Ficha ou treino de pernas / membros inferiores',
              create_upper_workout: 'Ficha de peito, costas ou membros superiores',
              adjust_calories: 'Ajuste calórico ou macronutrientes',
              log_food: 'Registro alimentar imediato',
              full_routine: 'Rotina ou divisão de dias da semana'
            }
          }
        }
      })
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (!res.ok) {
      return { latencyMs: elapsed, domain: 'local', confidence: 0.9, pills: localPills };
    }

    const data = await res.json();
    const domainChoice = data?.answers?.domain?.choice || 'workout';
    const domainConfidence = data?.answers?.domain?.confidence || 1;
    const subintent = data?.answers?.subintent?.choice || '';

    // Monta pills orientadas pelas escolhas do JEV
    const pills: JevSuggestionPill[] = [];

    if (domainChoice === 'workout' || subintent.includes('workout')) {
      if (trimmed.toLowerCase().includes('perna') || subintent === 'create_leg_workout') {
        pills.push({ label: '🦵 Treino Completo (Agachamento, Leg Press e Extensora)', appendText: ' completo para hipertrofia com 4 séries de 10 a 12 reps' });
        pills.push({ label: '🍑 Ênfase em Glúteos & Posteriores', appendText: ' com foco em posteriores e glúteos (Stiff, Mesa Flexora e Elevação Pélvica)' });
        pills.push({ label: '📅 Terça e Sexta-feira', appendText: ' programado para terça e sexta-feira' });
      } else if (trimmed.toLowerCase().includes('peito') || trimmed.toLowerCase().includes('superior')) {
        pills.push({ label: '🏋️ Peito e Tríceps (Supino Reto + Inclinado)', appendText: ' focado em peitoral e tríceps com 4 exercícios' });
        pills.push({ label: '💥 Adicionar Cargas Progressivas', appendText: ' com carga inicial moderada e 3 a 4 séries' });
      } else {
        pills.push({ label: '📋 Treino ABC Completo (Hipertrofia)', appendText: ' ABC completo: A (Peito/Tríceps), B (Costas/Bíceps), C (Pernas)' });
        pills.push({ label: '➕ Adicionar 4 séries de 10 a 12 reps', appendText: ' com 4 séries de 10 a 12 repetições' });
      }
    } else if (domainChoice === 'diet_goals') {
      pills.push({ label: '🔥 2.600 kcal com 180g de Proteína', appendText: ' para 2.600 kcal e meta de 180g de proteína' });
      pills.push({ label: '🎯 Déficit Calórico (-300 kcal)', appendText: ' com déficit suave para perda de gordura' });
      pills.push({ label: '🥩 Superávit para Ganho de Massa', appendText: ' com superávit de 300 kcal para ganho de massa' });
    } else {
      pills.push(...localPills);
    }

    // Garante no mínimo 2 pills
    if (pills.length === 0) pills.push(...localPills);

    return {
      latencyMs: elapsed,
      domain: domainChoice,
      confidence: domainConfidence,
      pills: pills.slice(0, 4)
    };
  } catch (err) {
    return {
      latencyMs: Math.round(performance.now() - startTime),
      domain: 'local',
      confidence: 1,
      pills: localPills
    };
  }
}

function generateInstantFallbackPills(query: string): JevSuggestionPill[] {
  const q = query.toLowerCase();
  if (q.includes('perna')) {
    return [
      { label: '🦵 Treino Completo (Agachamento, Leg Press, Extensora)', appendText: ' completo para hipertrofia com 4 séries' },
      { label: '🍑 Foco em Posterior & Glúteo (Stiff e Flexora)', appendText: ' com foco em posteriores e glúteos' },
      { label: '📅 Definir para Terça e Sexta', appendText: ' programado para terça e sexta-feira' }
    ];
  }
  if (q.includes('treino')) {
    return [
      { label: '🏋️ Treino ABC (Peito, Costas e Pernas)', appendText: ' ABC para hipertrofia' },
      { label: '🦵 Treino de Pernas Completo', appendText: ' de pernas para hipertrofia' },
      { label: '💪 Superiores (Peito, Costas e Braços)', appendText: ' de membros superiores' }
    ];
  }
  if (q.includes('caloria') || q.includes('meta') || q.includes('dieta')) {
    return [
      { label: '🔥 Ajustar para 2.600 kcal e 180g proteína', appendText: ' meta de 2.600 kcal e 180g de proteína' },
      { label: '🥩 Aumentar proteína para 2g/kg', appendText: ' aumentando a meta de proteína' },
      { label: '💧 Meta de 3 Litros de água', appendText: ' e meta de 3 litros de água diários' }
    ];
  }
  return [
    { label: '🏋️ Criar treino completo', appendText: ' de musculação para hipertrofia' },
    { label: '🔥 Ajustar metas calóricas', appendText: ' meta diária de calorias e proteína' }
  ];
}

/**
 * 2. Decisão estruturada do TypeSafe JEV
 */
export async function evaluateJevIntent(userPrompt: string, stateSummary: string) {
  const key = getTypeSafeKey();
  if (!key) return null;

  const url = import.meta.env.DEV ? '/api/typesafe/v1/systemone' : 'https://api.typesafe.ai/v1/systemone';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: `Solicitação do usuário:\n"${userPrompt}"\n\nContexto do aplicativo:\n${stateSummary}`,
        model: 'jev-latest',
        questions: {
          target_area: {
            type: 'choice',
            instructions: 'Quais áreas do aplicativo devem ser alteradas por esta instrução?',
            criteria: {
              workout_plans: 'Criação ou atualização de planos de treino, ficha de musculação ou exercícios',
              diet_and_nutrition: 'Metas calóricas, macros (proteína/carbo/gordura) ou refeições consumidas',
              profile_and_goals: 'Objetivo do usuário, peso de referência ou configurações gerais',
              bulk_multi_domain: 'Combinação múltipla envolvendo treinos e dieta/metas simultaneamente',
              body_weight: 'Pesagem corporal ou medidas de bioimpedância'
            }
          },
          action_mode: {
            type: 'choice',
            instructions: 'Qual é o modo da ação?',
            criteria: {
              create_new: 'Adicionar novos planos, refeições ou registros',
              update_existing: 'Modificar planos ou metas existentes',
              both_create_and_update: 'Criar novos itens e atualizar existentes em lote'
            }
          },
          is_workout_change: {
            type: 'noul',
            instructions: 'A solicitação altera planos de treino ou exercícios?'
          },
          is_diet_change: {
            type: 'noul',
            instructions: 'A solicitação altera metas nutricionais, calorias ou refeições?'
          }
        }
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      intent: data?.answers?.target_area?.choice ?? 'workout_plans',
      confidence: data?.answers?.target_area?.confidence ?? 1,
      action: data?.answers?.action_mode?.choice ?? 'create_new',
      isWorkout: (data?.answers?.is_workout_change?.noul ?? 0) > 0.4,
      isDiet: (data?.answers?.is_diet_change?.noul ?? 0) > 0.4
    };
  } catch {
    return null;
  }
}

// Zod schema permissivo com transformações defensivas
export interface AiProposal {
  summary: string;
  clarifyingQuestion?: string;
  profileUpdates?: {
    goal?: 'Perder gordura' | 'Ganhar massa' | 'Recomposição corporal' | 'Manter peso';
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    water?: number;
    targetWeight?: number;
    trainTime?: string;
    mealTime?: string;
  };
  plansToCreate: Array<{
    name: string;
    subtitle?: string;
    days: number[];
    exercises: Array<{
      name: string;
      muscle: string;
      sets: number;
      reps: number;
      load: number;
      rest: number;
      origin: Origin;
    }>;
  }>;
  plansToUpdate: Array<{
    planIdOrName: string;
    name?: string;
    subtitle?: string;
    days?: number[];
    exercisesToAdd?: Array<{
      name: string;
      muscle: string;
      sets: number;
      reps: number;
      load: number;
      rest: number;
      origin: Origin;
    }>;
    exercisesToUpdate?: Array<{
      exerciseName: string;
      sets?: number;
      reps?: number;
      load?: number;
      rest?: number;
    }>;
  }>;
  mealsToAdd: Array<{
    name: string;
    time?: string;
    items: Array<{
      foodId?: string;
      name: string;
      grams: number;
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
  }>;
  bodyToAdd?: {
    weight: number;
    fat?: number;
    muscle?: number;
  };
}

/**
 * Normaliza defensivamente a saída da IA para impedir qualquer erro de formato.
 */
function normalizeRawProposal(raw: any, userPrompt: string): AiProposal {
  if (!raw || typeof raw !== 'object') {
    raw = {};
  }

  const promptLower = userPrompt.toLowerCase();

  // 1. Summary
  let summary = typeof raw.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : 'Atualizações planejadas com base no seu comando.';

  // 2. Profile Updates
  let profileUpdates: AiProposal['profileUpdates'] = undefined;
  if (raw.profileUpdates && typeof raw.profileUpdates === 'object' && !Array.isArray(raw.profileUpdates)) {
    const pu = raw.profileUpdates;
    profileUpdates = {
      goal: ['Perder gordura', 'Ganhar massa', 'Recomposição corporal', 'Manter peso'].includes(pu.goal) ? pu.goal : undefined,
      calories: pu.calories ? Math.round(Number(pu.calories)) : undefined,
      protein: pu.protein ? Math.round(Number(pu.protein)) : undefined,
      carbs: pu.carbs ? Math.round(Number(pu.carbs)) : undefined,
      fat: pu.fat ? Math.round(Number(pu.fat)) : undefined,
      water: pu.water ? Math.round(Number(pu.water)) : undefined,
      targetWeight: pu.targetWeight ? Number(pu.targetWeight) : undefined
    };
  }

  // 3. Plans To Create
  let plansToCreate: AiProposal['plansToCreate'] = [];
  if (Array.isArray(raw.plansToCreate) && raw.plansToCreate.length > 0) {
    plansToCreate = raw.plansToCreate.map((p: any) => {
      const planName = p.name || 'Treino Personalizado';
      const days = Array.isArray(p.days) && p.days.length
        ? p.days.map((d: any) => Number(d) % 7)
        : [1, 3, 5];

      const exs = Array.isArray(p.exercises) ? p.exercises.map((e: any) => {
        const exName = String(e.name || 'Exercício');
        // Infere músculo se não fornecido
        let muscle = String(e.muscle || '');
        if (!muscle || muscle === 'Geral') {
          const match = searchLocalExercises(exName)[0];
          muscle = match ? match.muscle : (planName.toLowerCase().includes('perna') ? 'Quadríceps' : 'Peitoral');
        }

        // Converte sets e reps string/faixas para inteiros seguros
        const setsVal = Math.min(15, Math.max(1, parseInt(String(e.sets || '3'), 10) || 3));
        const repsVal = Math.min(100, Math.max(1, parseInt(String(e.reps || '10'), 10) || 10));

        return {
          name: exName,
          muscle,
          sets: setsVal,
          reps: repsVal,
          load: Number(e.load) || 0,
          rest: Number(e.rest) || 90,
          origin: 'ia' as Origin
        };
      }) : [];

      return {
        name: planName,
        subtitle: p.subtitle || `${exs.length} exercícios · ${exs.map((x: any) => x.name).slice(0, 3).join(', ')}`,
        days,
        exercises: exs
      };
    });
  }

  // Se o usuário pediu treino de perna mas a IA não criou exercícios, monta a ficha de ouro de pernas!
  if (plansToCreate.length === 0 && (promptLower.includes('perna') || promptLower.includes('treino'))) {
    summary = 'Criação de treino completo de membros inferiores (Pernas) com base no catálogo de referência.';
    const legExercises = curatedExercises.filter(e => e.category === 'pernas' || e.category === 'gluteos').slice(0, 5);
    plansToCreate.push({
      name: 'Treino de Pernas & Glúteos',
      subtitle: '5 exercícios de alta ativação · Foco em hipertrofia',
      days: [2, 5], // Terça e Sexta
      exercises: legExercises.map(e => ({
        name: e.name,
        muscle: e.muscle,
        sets: e.defaultSets,
        reps: e.defaultReps,
        load: 0,
        rest: e.defaultRest,
        origin: 'ia' as Origin
      }))
    });
  }

  // 4. Plans To Update
  const plansToUpdate = Array.isArray(raw.plansToUpdate) ? raw.plansToUpdate.map((u: any) => ({
    planIdOrName: String(u.planIdOrName || ''),
    name: u.name,
    subtitle: u.subtitle,
    days: Array.isArray(u.days) ? u.days.map(Number) : undefined,
    exercisesToAdd: Array.isArray(u.exercisesToAdd) ? u.exercisesToAdd.map((e: any) => ({
      name: String(e.name || 'Novo exercício'),
      muscle: String(e.muscle || 'Músculo principal'),
      sets: Math.min(15, Math.max(1, parseInt(String(e.sets || '3'), 10) || 3)),
      reps: Math.min(100, Math.max(1, parseInt(String(e.reps || '10'), 10) || 10)),
      load: Number(e.load) || 0,
      rest: Number(e.rest) || 90,
      origin: 'ia' as Origin
    })) : undefined,
    exercisesToUpdate: Array.isArray(u.exercisesToUpdate) ? u.exercisesToUpdate.map((e: any) => ({
      exerciseName: String(e.exerciseName || ''),
      sets: e.sets ? parseInt(String(e.sets), 10) : undefined,
      reps: e.reps ? parseInt(String(e.reps), 10) : undefined,
      load: e.load !== undefined ? Number(e.load) : undefined,
      rest: e.rest !== undefined ? Number(e.rest) : undefined
    })) : undefined
  })).filter((u: any) => Boolean(u.planIdOrName)) : [];

  // 5. Meals To Add
  const mealsToAdd = Array.isArray(raw.mealsToAdd) ? raw.mealsToAdd.map((m: any) => ({
    name: String(m.name || 'Refeição'),
    time: String(m.time || '12:30'),
    items: Array.isArray(m.items) ? m.items.map((i: any) => ({
      foodId: i.foodId,
      name: String(i.name || 'Alimento'),
      grams: Number(i.grams) || 100,
      kcal: Number(i.kcal) || 150,
      protein: Number(i.protein) || 10,
      carbs: Number(i.carbs) || 15,
      fat: Number(i.fat) || 5
    })) : []
  })) : [];

  // 6. Body To Add
  let bodyToAdd: AiProposal['bodyToAdd'] = undefined;
  if (raw.bodyToAdd && typeof raw.bodyToAdd === 'object' && !Array.isArray(raw.bodyToAdd) && raw.bodyToAdd.weight) {
    bodyToAdd = {
      weight: Number(raw.bodyToAdd.weight),
      fat: raw.bodyToAdd.fat ? Number(raw.bodyToAdd.fat) : undefined,
      muscle: raw.bodyToAdd.muscle ? Number(raw.bodyToAdd.muscle) : undefined
    };
  }

  return {
    summary,
    clarifyingQuestion: raw.clarifyingQuestion,
    profileUpdates,
    plansToCreate,
    plansToUpdate,
    mealsToAdd,
    bodyToAdd
  };
}

/**
 * 3. Planeja o comando utilizando JEV (decisão delimitada) e Gemini 2.5 Flash
 * com responseSchema estrito e normalização resiliente à prova de falhas.
 */
export async function planSmartCommand(
  userPrompt: string,
  currentState: AppState
): Promise<SmartPlanResult> {
  const geminiKey = getGeminiKey();
  if (!geminiKey) {
    throw new Error('Configure a chave do Google Gemini em API_KEYS.env para executar comandos inteligentes.');
  }

  // Prepara contexto com dados de treinos existentes e catálogo de referência
  const existingPlansSummary = currentState.plans.length > 0
    ? currentState.plans.map(p => `"${p.name}" (ID: ${p.id}, ${p.exercises.length} exercícios: ${p.exercises.map(e => `${e.name} ${e.sets}x${e.reps}`).join(', ')})`).join('\n')
    : 'Nenhum plano cadastrado ainda.';

  const stateContext = `
- Perfil: ${currentState.profile.name}, Objetivo: ${currentState.profile.goal}
- Metas atuais: ${currentState.profile.calories} kcal, ${currentState.profile.protein}g Proteína, ${currentState.profile.carbs}g Carbo, ${currentState.profile.fat}g Gordura, Peso Alvo: ${currentState.profile.targetWeight}kg
- Planos de treino existentes:
${existingPlansSummary}
`;

  // 1. Decisão calibrada do TypeSafe JEV
  const jevResult = await evaluateJevIntent(userPrompt, stateContext);

  // 2. Prompt estruturado com catálogo padrão de exercícios
  const exerciseExamples = curatedExercises.slice(0, 15).map(e => `${e.name} (${e.muscle})`).join(', ');

  const prompt = `Você é o arquiteto de treinos e nutrição do aplicativo Ritmo.
O usuário digitou a seguinte instrução:
"${userPrompt}"

Contexto do usuário:
${stateContext}
${jevResult ? `Decisão prévia calibrada pelo JEV: Área = ${jevResult.intent} (${Math.round(jevResult.confidence * 100)}% certeza).` : ''}

Catálogo de exercícios oficiais recomendados:
${exerciseExamples}... e outros do banco WGER / TACO.

Instruções:
1. Crie ou atualize com precisão a ficha ou as metas solicitadas.
2. Se o usuário digitou apenas uma frase curta como "treino de perna", monte uma ficha completa com 4 a 6 exercícios clássicos (ex: Agachamento Livre, Leg Press 45°, Cadeira Extensora, Mesa Flexora, Panturrilha).
3. "sets" e "reps" devem ser números inteiros.
4. "days" é um array de números inteiros de 0 a 6 (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb).
5. Escreva um "summary" amigável em português explicando o que foi planejado.`;

  // Strict Gemini response schema
  const geminiSchema = {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      clarifyingQuestion: { type: 'STRING' },
      profileUpdates: {
        type: 'OBJECT',
        properties: {
          goal: { type: 'STRING' },
          calories: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          water: { type: 'NUMBER' },
          targetWeight: { type: 'NUMBER' }
        }
      },
      plansToCreate: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            subtitle: { type: 'STRING' },
            days: { type: 'ARRAY', items: { type: 'INTEGER' } },
            exercises: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  muscle: { type: 'STRING' },
                  sets: { type: 'INTEGER' },
                  reps: { type: 'INTEGER' },
                  load: { type: 'NUMBER' },
                  rest: { type: 'INTEGER' }
                },
                required: ['name', 'sets', 'reps']
              }
            }
          },
          required: ['name', 'exercises']
        }
      },
      plansToUpdate: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            planIdOrName: { type: 'STRING' }
          },
          required: ['planIdOrName']
        }
      },
      mealsToAdd: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' }
          },
          required: ['name']
        }
      },
      bodyToAdd: {
        type: 'OBJECT',
        properties: {
          weight: { type: 'NUMBER' }
        }
      }
    },
    required: ['summary']
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Falha no provedor de IA (${res.status}). Verifique sua conexão ou tente novamente.`);
  }

  const jsonResponse = await res.json();
  const rawText = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Nenhuma resposta recebida do modelo.');
  }

  let parsedRaw: any;
  try {
    const cleanedText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsedRaw = JSON.parse(cleanedText);
  } catch {
    parsedRaw = { summary: 'Operação solicitada' };
  }

  // Normalização defensiva
  const proposal: AiProposal = normalizeRawProposal(parsedRaw, userPrompt);

  // 4. Monta os Smart Cards comparando com o estado atual
  const cards: SmartCardChange[] = [];

  // --- Metas Nutricionais & Perfil ---
  if (proposal.profileUpdates) {
    const pu = proposal.profileUpdates;

    if (pu.calories !== undefined && pu.calories !== currentState.profile.calories) {
      const diff = pu.calories - currentState.profile.calories;
      const sign = diff > 0 ? `+${diff}` : `${diff}`;
      cards.push({
        id: uid(),
        category: 'diet_macros',
        icon: 'flame',
        title: 'Meta Calórica',
        subtitle: 'Energia diária recomendada',
        badge: 'Meta Diária',
        before: `${currentState.profile.calories.toLocaleString('pt-BR')} kcal`,
        after: `${pu.calories.toLocaleString('pt-BR')} kcal (${sign} kcal)`,
        selected: true,
        apply: (s) => ({
          ...s,
          profile: { ...s.profile, calories: pu.calories! }
        })
      });
    }

    if (pu.protein !== undefined && pu.protein !== currentState.profile.protein) {
      const diff = pu.protein - currentState.profile.protein;
      const sign = diff > 0 ? `+${diff}` : `${diff}`;
      cards.push({
        id: uid(),
        category: 'diet_macros',
        icon: 'protein',
        title: 'Meta de Proteína',
        subtitle: 'Aporte proteico diário',
        badge: 'Macronutriente',
        before: `${currentState.profile.protein}g`,
        after: `${pu.protein}g (${sign}g)`,
        selected: true,
        apply: (s) => ({
          ...s,
          profile: { ...s.profile, protein: pu.protein! }
        })
      });
    }

    if (pu.carbs !== undefined || pu.fat !== undefined) {
      const newCarbs = pu.carbs ?? currentState.profile.carbs;
      const newFat = pu.fat ?? currentState.profile.fat;
      cards.push({
        id: uid(),
        category: 'diet_macros',
        icon: 'target',
        title: 'Carboidratos e Gorduras',
        subtitle: 'Balanço de macronutrientes',
        badge: 'Metas',
        before: `${currentState.profile.carbs}g carbo · ${currentState.profile.fat}g gordura`,
        after: `${newCarbs}g carbo · ${newFat}g gordura`,
        selected: true,
        apply: (s) => ({
          ...s,
          profile: { ...s.profile, carbs: newCarbs, fat: newFat }
        })
      });
    }

    if (pu.goal || pu.targetWeight) {
      const newGoal = pu.goal ?? currentState.profile.goal;
      const newTargetWeight = pu.targetWeight ?? currentState.profile.targetWeight;
      cards.push({
        id: uid(),
        category: 'profile_goal',
        icon: 'target',
        title: 'Objetivo do Perfil',
        subtitle: 'Foco principal e peso de referência',
        badge: 'Perfil',
        before: `${currentState.profile.goal} (${currentState.profile.targetWeight} kg)`,
        after: `${newGoal} (${newTargetWeight} kg)`,
        selected: true,
        apply: (s) => ({
          ...s,
          profile: { ...s.profile, goal: newGoal, targetWeight: newTargetWeight }
        })
      });
    }
  }

  // --- Novos Planos de Treino ---
  if (proposal.plansToCreate && proposal.plansToCreate.length > 0) {
    for (const p of proposal.plansToCreate) {
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const daysStr = p.days.map(d => dayNames[d]).join(', ');
      const newPlan: Plan = {
        id: uid(),
        name: p.name,
        subtitle: p.subtitle || `${p.exercises.length} exercícios · ${daysStr}`,
        days: p.days,
        origin: 'ia',
        version: 1,
        exercises: p.exercises.map(ex => ({
          id: uid(),
          name: ex.name,
          muscle: ex.muscle,
          sets: ex.sets,
          reps: ex.reps,
          load: ex.load,
          rest: ex.rest,
          origin: ex.origin || 'ia'
        }))
      };

      cards.push({
        id: uid(),
        category: 'workout_plan_new',
        icon: 'dumbbell',
        title: `Novo Plano: ${newPlan.name}`,
        subtitle: newPlan.subtitle,
        badge: 'Novo Treino',
        before: 'Nenhum plano',
        after: `${newPlan.exercises.length} exercícios · Dias: ${daysStr}`,
        details: newPlan.exercises.map(e => `${e.name} (${e.muscle}): ${e.sets} séries × ${e.reps} reps · ${e.load}kg`),
        selected: true,
        apply: (s) => ({
          ...s,
          plans: [...s.plans, newPlan]
        })
      });
    }
  }

  // --- Atualização de Treinos Existentes ---
  if (proposal.plansToUpdate && proposal.plansToUpdate.length > 0) {
    for (const updateReq of proposal.plansToUpdate) {
      const targetPlan = currentState.plans.find(
        p => p.id === updateReq.planIdOrName ||
             p.name.toLowerCase().includes(updateReq.planIdOrName.toLowerCase())
      );

      if (targetPlan) {
        const addedDetails: string[] = [];
        if (updateReq.exercisesToAdd) {
          updateReq.exercisesToAdd.forEach(ex => {
            addedDetails.push(`+ Adicionar: ${ex.name} (${ex.sets}x${ex.reps}, ${ex.load}kg)`);
          });
        }
        if (updateReq.exercisesToUpdate) {
          updateReq.exercisesToUpdate.forEach(ex => {
            addedDetails.push(`Atualizar ${ex.exerciseName}: ${ex.sets ? `${ex.sets} séries ` : ''}${ex.reps ? `× ${ex.reps} reps ` : ''}${ex.load !== undefined ? `(${ex.load}kg)` : ''}`);
          });
        }

        cards.push({
          id: uid(),
          category: 'workout_plan_update',
          icon: 'refresh',
          title: `Atualizar Treino: ${targetPlan.name}`,
          subtitle: `${targetPlan.exercises.length} exercícios atuais`,
          badge: 'Atualização',
          before: `${targetPlan.exercises.length} exercícios cadastrados`,
          after: addedDetails.join(' · ') || 'Ajustes no plano',
          details: addedDetails,
          selected: true,
          apply: (s) => {
            const updated = s.plans.map(p => {
              if (p.id !== targetPlan.id) return p;
              let nextExercises = [...p.exercises];

              if (updateReq.exercisesToUpdate) {
                nextExercises = nextExercises.map(ex => {
                  const match = updateReq.exercisesToUpdate?.find(
                    u => u.exerciseName.toLowerCase() === ex.name.toLowerCase()
                  );
                  if (match) {
                    return {
                      ...ex,
                      sets: match.sets ?? ex.sets,
                      reps: match.reps ?? ex.reps,
                      load: match.load ?? ex.load,
                      rest: match.rest ?? ex.rest
                    };
                  }
                  return ex;
                });
              }

              if (updateReq.exercisesToAdd) {
                const newExs: Exercise[] = updateReq.exercisesToAdd.map(e => ({
                  id: uid(),
                  name: e.name,
                  muscle: e.muscle,
                  sets: e.sets,
                  reps: e.reps,
                  load: e.load,
                  rest: e.rest,
                  origin: e.origin || 'ia'
                }));
                nextExercises = [...nextExercises, ...newExs];
              }

              return {
                ...p,
                name: updateReq.name ?? p.name,
                subtitle: updateReq.subtitle ?? p.subtitle,
                days: updateReq.days ?? p.days,
                version: p.version + 1,
                exercises: nextExercises
              };
            });
            return { ...s, plans: updated };
          }
        });
      }
    }
  }

  // --- Refeições Adicionadas ---
  if (proposal.mealsToAdd && proposal.mealsToAdd.length > 0) {
    for (const mealReq of proposal.mealsToAdd) {
      const mealDate = today();
      const newMeal: Meal = {
        id: uid(),
        date: mealDate,
        time: mealReq.time || '12:30',
        name: mealReq.name,
        method: 'texto',
        notes: 'Adicionado via comando inteligente com IA',
        updatedAt: new Date().toISOString(),
        items: mealReq.items.map(i => {
          const cat = foods.find(f => f.id === i.foodId);
          if (cat) return ingredient(cat, i.grams);
          return {
            foodId: i.foodId || uid(),
            name: i.name,
            grams: i.grams,
            kcal: i.kcal,
            protein: i.protein,
            carbs: i.carbs,
            fat: i.fat,
            estimated: false,
            source: 'Comando Inteligente IA'
          };
        })
      };

      const totalKcal = Math.round(newMeal.items.reduce((s, it) => s + it.kcal, 0));
      const totalProt = Math.round(newMeal.items.reduce((s, it) => s + it.protein, 0));

      cards.push({
        id: uid(),
        category: 'meal_log',
        icon: 'utensils',
        title: `Nova Refeição: ${newMeal.name}`,
        subtitle: `${newMeal.time} · ${newMeal.items.length} alimentos`,
        badge: 'Diário Alimentar',
        before: 'Nenhum registro',
        after: `${totalKcal} kcal · ${totalProt}g proteína`,
        details: newMeal.items.map(it => `${it.name}: ${it.grams}g (${Math.round(it.kcal)} kcal)`),
        selected: true,
        apply: (s) => ({
          ...s,
          meals: [...s.meals, newMeal]
        })
      });
    }
  }

  // --- Registro de Peso Corporal ---
  if (proposal.bodyToAdd) {
    const weightVal = proposal.bodyToAdd.weight;
    const dateVal = today();
    cards.push({
      id: uid(),
      category: 'body_metric',
      icon: 'scale',
      title: 'Registro de Peso Corporal',
      subtitle: `Data: ${dateVal}`,
      badge: 'Medidas',
      before: currentState.body.at(-1) ? `${currentState.body.at(-1)?.weight} kg` : 'Sem peso',
      after: `${weightVal} kg`,
      selected: true,
      apply: (s) => ({
        ...s,
        body: [
          ...s.body,
          {
            id: uid(),
            date: dateVal,
            weight: weightVal,
            fat: proposal.bodyToAdd?.fat ?? null,
            muscle: proposal.bodyToAdd?.muscle ?? null,
            waist: null,
            device: 'Comando IA',
            notes: 'Registrado via comando inteligente'
          }
        ]
      })
    });
  }

  return {
    summary: proposal.summary,
    clarifyingQuestion: proposal.clarifyingQuestion,
    jevDecision: jevResult ? {
      intent: jevResult.intent,
      confidence: jevResult.confidence,
      choiceDetails: `Modo: ${jevResult.action}`
    } : undefined,
    cards
  };
}

/**
 * 4. Aplica apenas os Smart Cards aprovados pelo usuário e registra no log de auditoria.
 */
export function applySmartCards(
  currentState: AppState,
  cards: SmartCardChange[],
  originalPrompt: string,
  jevDecision?: SmartPlanResult['jevDecision']
): { nextState: AppState; logEntry: AuditLogEntry } {
  const selectedCards = cards.filter(c => c.selected);
  if (selectedCards.length === 0) {
    throw new Error('Nenhuma alteração foi selecionada para aprovação.');
  }

  let updatedState = currentState;
  for (const card of selectedCards) {
    updatedState = card.apply(updatedState);
  }

  const validatedState = stateSchema.parse(updatedState);

  const changesSummary: FieldChangeSummary[] = selectedCards.map(c => ({
    category: c.category,
    icon: c.icon,
    label: c.title,
    description: c.subtitle,
    before: c.before,
    after: c.after
  }));

  const logEntry: AuditLogEntry = {
    id: uid(),
    timestamp: new Date().toISOString(),
    prompt: originalPrompt,
    summary: `${selectedCards.length} alteração(ões) aprovada(s) e aplicada(s) com sucesso.`,
    source: 'jev_ai',
    jevDecision,
    changes: changesSummary,
    snapshotBefore: currentState,
    snapshotAfter: validatedState,
    status: 'applied'
  };

  recordAuditEntry(logEntry);

  return {
    nextState: validatedState,
    logEntry
  };
}
