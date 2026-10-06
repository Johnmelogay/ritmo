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
  type Profile,
  type BodyRecord
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

export interface AttachedMedia {
  data: string;
  mimeType: string;
  name?: string;
  previewUrl?: string;
  sizeBytes?: number;
}

export interface RealtimeJevResult {
  latencyMs: number;
  domain: string;
  confidence: number;
  pills: JevSuggestionPill[];
}

/**
 * Motor de Cálculo Metabólico & Nutricional Científico (Katch-McArdle / Mifflin-St Jeor)
 * Estima TMB, Gasto Energético Total (TDEE), déficit/superávit por objetivo,
 * aporte proteico ideal, carboidratos, gorduras e hidratação.
 */
export interface MetabolicCalculation {
  weight: number;
  fatPercent: number | null;
  height: number | null;
  muscleKg: number | null;
  fatMass: number | null;
  fatFreeMass: number;
  tmb: number;
  tdee: number;
  targetKcal: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  targetWeight: number;
  bmi: number | null;
  goal: Profile['goal'];
  explanation: string[];
}

export function calculateMetabolicProfile(params: {
  weight?: number;
  fatPercent?: number | null;
  muscleKg?: number | null;
  height?: number | null;
  goal?: Profile['goal'];
  currentState: AppState;
}): MetabolicCalculation {
  const latestBody = params.currentState.body.at(-1);
  const weight = params.weight ?? latestBody?.weight ?? params.currentState.profile.targetWeight ?? 75;
  const fatPercent = params.fatPercent !== undefined ? params.fatPercent : (latestBody?.fat ?? null);
  const muscleKg = params.muscleKg !== undefined ? params.muscleKg : (latestBody?.muscle ?? null);
  const height = params.height ?? latestBody?.height ?? 175;
  const goal = params.goal ?? params.currentState.profile.goal ?? 'Recomposição corporal';

  // 1. Massa Livre de Gordura (Massa Magra / FFM)
  let fatFreeMass: number;
  let fatMass: number | null = null;
  if (fatPercent !== null && fatPercent > 0 && fatPercent < 100) {
    fatMass = Number(((weight * fatPercent) / 100).toFixed(1));
    fatFreeMass = Number((weight - fatMass).toFixed(1));
  } else if (muscleKg && muscleKg > 10 && muscleKg < weight) {
    fatFreeMass = Math.min(weight * 0.9, Number((muscleKg * 1.25).toFixed(1)));
    fatMass = Number((weight - fatFreeMass).toFixed(1));
  } else {
    fatMass = Number((weight * 0.20).toFixed(1));
    fatFreeMass = Number((weight * 0.80).toFixed(1));
  }

  // 2. Taxa Metabólica Basal (TMB)
  // Katch-McArdle se % gordura for fornecido: TMB = 370 + (21.6 * FFM)
  let tmb: number;
  if (fatPercent !== null) {
    tmb = Math.round(370 + 21.6 * fatFreeMass);
  } else {
    // Mifflin-St Jeor com estimativa de idade ~28 anos
    tmb = Math.round(10 * weight + 6.25 * height - 5 * 28 + 5);
  }

  // 3. Gasto Energético Total (GET / TDEE) com fator moderado (musculação 3-5x/sem = 1.45)
  const tdee = Math.round(tmb * 1.45);

  // 4. Meta Calórica conforme Objetivo
  let targetKcal: number;
  const explanation: string[] = [];

  if (goal === 'Perder gordura') {
    targetKcal = Math.max(1300, Math.round(tdee - 450));
    explanation.push(`TMB: ${tmb} kcal/dia · Gasto Energético Total Estimado: ${tdee} kcal/dia.`);
    explanation.push(`Déficit calórico de 450 kcal para queima de gordura preservando massa muscular.`);
  } else if (goal === 'Ganhar massa') {
    targetKcal = Math.min(5000, Math.round(tdee + 350));
    explanation.push(`TMB: ${tmb} kcal/dia · Gasto Energético Total Estimado: ${tdee} kcal/dia.`);
    explanation.push(`Superávit calórico de 350 kcal para fornecer substrato à hipertrofia.`);
  } else if (goal === 'Recomposição corporal') {
    targetKcal = Math.max(1400, Math.round(tdee - 180));
    explanation.push(`TMB: ${tmb} kcal/dia · Gasto Energético Total Estimado: ${tdee} kcal/dia.`);
    explanation.push(`Leve déficit de 180 kcal aliado a alta proteína para ganhar músculo e secar gordura simultaneamente.`);
  } else {
    targetKcal = Math.round(tdee);
    explanation.push(`Meta em nível de manutenção energética (${tdee} kcal/dia).`);
  }

  // 5. Distribuição de Macronutrientes
  // Proteína: 2.2 a 2.4 g/kg de massa magra (ou ~2.0 g/kg peso)
  const protein = Math.round(Math.min(320, Math.max(120, fatFreeMass * 2.3)));
  // Gorduras: ~0.8g por kg peso total
  const fat = Math.round(Math.min(120, Math.max(45, weight * 0.8)));
  // Carboidratos: saldo restante dividido por 4
  const calsRemaining = targetKcal - (protein * 4 + fat * 9);
  const carbs = Math.round(Math.max(80, calsRemaining / 4));

  // Água: 40 ml por kg de peso
  const water = Math.round(Math.min(6000, Math.max(2000, weight * 40)));

  // Peso de referência alvo
  let targetWeight = weight;
  if (goal === 'Perder gordura') {
    targetWeight = Math.round(fatFreeMass / 0.87); // Mira em ~13% de BF
  } else if (goal === 'Ganhar massa') {
    targetWeight = Math.round(weight + 4);
  } else {
    targetWeight = Math.round(weight);
  }

  const bmi = height ? Number((weight / Math.pow(height / 100, 2)).toFixed(1)) : null;

  return {
    weight,
    fatPercent,
    height,
    muscleKg,
    fatMass,
    fatFreeMass,
    tmb,
    tdee,
    targetKcal,
    protein,
    carbs,
    fat,
    water,
    targetWeight,
    bmi,
    goal,
    explanation
  };
}

/**
 * Extrai entidades em português (Nome, Objetivo, Bioimpedância, Peso, Gordura, Altura)
 */
function extractProfileAndBioFromPrompt(prompt: string) {
  const p = prompt.toLowerCase();

  // 1. Nome
  let name: string | undefined = undefined;
  const nameMatch = prompt.match(/(?:meu\s+nome\s+(?:é|e)|sou\s+(?:o|a)|me\s+chamo|nome\s*[:=])\s+([A-Za-zÀ-ÿ]+)/i);
  if (nameMatch && nameMatch[1]) {
    const raw = nameMatch[1].trim();
    name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }

  // 2. Objetivo
  let goal: Profile['goal'] | undefined = undefined;
  if (
    (p.includes('ganhar massa') || p.includes('massa muscular') || p.includes('hipertrofia') || p.includes('crescer')) &&
    (p.includes('perder gordura') || p.includes('queimar gordura') || p.includes('secar') || p.includes('emagrecer'))
  ) {
    goal = 'Recomposição corporal';
  } else if (p.includes('recomposi') || p.includes('recompor')) {
    goal = 'Recomposição corporal';
  } else if (p.includes('perder gordura') || p.includes('emagrecer') || p.includes('secar') || p.includes('cutting') || p.includes('queimar gordura')) {
    goal = 'Perder gordura';
  } else if (p.includes('ganhar massa') || p.includes('hipertrofia') || p.includes('crescer') || p.includes('bulking') || p.includes('massa muscular')) {
    goal = 'Ganhar massa';
  } else if (p.includes('manter peso') || p.includes('manuten')) {
    goal = 'Manter peso';
  }

  // 3. Peso: "80kg", "80 kg", "peso 80", "peso: 80"
  let weight: number | undefined = undefined;
  const weightMatch = p.match(/(?:peso(?:\s+corporal)?(?:\s*[:=]|\s+(?:é|e|de))?\s*|tenho\s+)?(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|quilos)\b/i) ||
                      p.match(/\bpeso\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)\b/i);
  if (weightMatch) {
    weight = parseFloat(weightMatch[1].replace(',', '.'));
  }

  // 4. Gordura %: "18% de gordura", "18% bf", "bf 18%", "gordura 18%"
  let fat: number | undefined = undefined;
  const fatMatch = p.match(/(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:gordura|bf|massa\s+gorda)?/i) ||
                   p.match(/(?:bf|gordura(?:\s+corporal)?)\s*[:=]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%?/i);
  if (fatMatch) {
    const val = parseFloat(fatMatch[1].replace(',', '.'));
    if (val >= 3 && val <= 65) fat = val;
  }

  // 5. Massa muscular: "38kg de músculo", "massa muscular 38kg"
  let muscle: number | undefined = undefined;
  const muscleMatch = p.match(/(\d{2}(?:[.,]\d+)?)\s*kg\s*(?:de\s+)?(?:massa\s+(?:muscular|magra)|m[uú]sculo)/i) ||
                      p.match(/(?:massa\s+(?:muscular|magra)|m[uú]sculo)\s*[:=]?\s*(\d{2}(?:[.,]\d+)?)\s*kg/i);
  if (muscleMatch) {
    muscle = parseFloat(muscleMatch[1].replace(',', '.'));
  }

  // 6. Altura: "1.78m", "1,78m", "178cm"
  let height: number | undefined = undefined;
  const heightMatch = p.match(/(?:altura\s*[:=]?\s*)?(\d(?:[.,]\d{2}))\s*m\b/i) ||
                      p.match(/(?:altura\s*[:=]?\s*)?(\d{3})\s*cm\b/i);
  if (heightMatch) {
    const val = parseFloat(heightMatch[1].replace(',', '.'));
    height = val < 3 ? Math.round(val * 100) : Math.round(val);
  }

  return { name, goal, weight, fat, muscle, height };
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
              profile_bioimpedance: 'Identificação do usuário, dados de bioimpedância, percentual de gordura, recomposição corporal ou triagem',
              meal_log: 'Alimento específico consumido (ex: arroz, frango, ovos, almoço)',
              general: 'Outro ou genérico'
            }
          },
          subintent: {
            type: 'choice',
            instructions: 'Qual é a especificidade ou ação pretendida?',
            criteria: {
              profile_triage: 'Configurar perfil completo, nome e metas integradas',
              bioimpedance_calc: 'Cálculo de déficit ou calorias a partir de peso e gordura',
              create_leg_workout: 'Ficha ou treino de pernas / membros inferiores',
              create_upper_workout: 'Ficha de peito, costas ou membros superiores',
              adjust_calories: 'Ajuste calórico ou macronutrientes'
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

    const pills: JevSuggestionPill[] = [];

    if (domainChoice === 'profile_bioimpedance' || subintent.includes('profile') || subintent.includes('bioimpedance')) {
      pills.push({ label: '🎯 Recomposição Corporal + Cálculo de Metas', appendText: ' e calcular metas completas para recomposição corporal' });
      pills.push({ label: '⚖️ Estimar Déficit Calórico com Bioimpedância', appendText: ' com cálculo metabólico para queima de gordura' });
      pills.push({ label: '💧 Adicionar Meta Hídrica (40ml/kg)', appendText: ' e meta de água ideal' });
    } else if (domainChoice === 'workout' || subintent.includes('workout')) {
      if (trimmed.toLowerCase().includes('perna') || subintent === 'create_leg_workout') {
        pills.push({ label: '🦵 Treino Completo (Agachamento, Leg Press, Extensora)', appendText: ' completo para hipertrofia com 4 séries de 10 a 12 reps' });
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
      pills.push({ label: '🎯 Déficit Calórico (-450 kcal)', appendText: ' com déficit calibrado para perda de gordura' });
      pills.push({ label: '🥩 Superávit para Ganho de Massa', appendText: ' com superávit de 350 kcal para ganho de massa' });
    } else {
      pills.push(...localPills);
    }

    if (pills.length === 0) pills.push(...localPills);

    return {
      latencyMs: elapsed,
      domain: domainChoice,
      confidence: domainConfidence,
      pills: pills.slice(0, 4)
    };
  } catch {
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
  if (q.includes('nome') || q.includes('matheus') || q.includes('perfil') || q.includes('triagem')) {
    return [
      { label: '🎯 Recomposição (Ganhar Massa & Perder Gordura)', appendText: ' e meu objetivo é recomposição corporal' },
      { label: '🔥 Estimar Calorias & Macros Completos', appendText: ' calcular metas de calorias e macros ideais' },
      { label: '💧 Meta Hídrica (3L de água)', appendText: ' com meta de 3 litros de água' }
    ];
  }
  if (q.includes('bioimpedancia') || q.includes('gordura') || q.includes('massa') || q.includes('bf')) {
    return [
      { label: '⚖️ Estimar Déficit Calórico com Bioimpedância', appendText: ' estimar calorias para perda de gordura baseada na minha TMB' },
      { label: '🥩 Proteína Alta (2.2g/kg de massa magra)', appendText: ' com proteína alta para preservar massa magra' },
      { label: '🎯 Recomposição Corporal', appendText: ' focado em recomposição corporal' }
    ];
  }
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
              profile_and_goals: 'Identificação do usuário (nome), objetivo, peso de referência, bioimpedância ou triagem',
              diet_and_nutrition: 'Metas calóricas, macros (proteína/carbo/gordura) ou refeições consumidas',
              workout_plans: 'Criação ou atualização de planos de treino, ficha de musculação ou exercícios',
              bulk_multi_domain: 'Combinação múltipla envolvendo perfil, treinos e dieta/metas simultaneamente',
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
          }
        }
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      intent: data?.answers?.target_area?.choice ?? 'profile_and_goals',
      confidence: data?.answers?.target_area?.confidence ?? 1,
      action: data?.answers?.action_mode?.choice ?? 'update_existing'
    };
  } catch {
    return null;
  }
}

// Interface defensiva da proposta gerada
export interface AiProposal {
  summary: string;
  clarifyingQuestion?: string;
  profileUpdates?: {
    name?: string;
    goal?: Profile['goal'];
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
    waist?: number;
    height?: number;
    bmi?: number;
    fatMass?: number;
    fatFreeMass?: number;
    basalMetabolism?: number;
  };
}

/**
 * Normaliza defensivamente a saída da IA com cálculos metabólicos científicos
 * e extração robusta de entidades em português.
 */
function normalizeRawProposal(
  raw: any,
  userPrompt: string,
  currentState: AppState
): AiProposal {
  if (!raw || typeof raw !== 'object') {
    raw = {};
  }

  const promptLower = userPrompt.toLowerCase();
  const extracted = extractProfileAndBioFromPrompt(userPrompt);

  // 1. Profile Updates
  let profileUpdates: AiProposal['profileUpdates'] = undefined;
  const rawPu = raw.profileUpdates && typeof raw.profileUpdates === 'object' && !Array.isArray(raw.profileUpdates)
    ? raw.profileUpdates
    : {};

  const nameVal = rawPu.name || extracted.name;
  const goalVal = rawPu.goal && ['Perder gordura', 'Ganhar massa', 'Recomposição corporal', 'Manter peso'].includes(rawPu.goal)
    ? rawPu.goal
    : extracted.goal;

  // Se o usuário informou nome, objetivo ou bioimpedância, rodamos o cálculo científico completo
  const shouldCalculateTriage = Boolean(
    nameVal ||
    goalVal ||
    extracted.weight ||
    extracted.fat ||
    promptLower.includes('caloria') ||
    promptLower.includes('meta') ||
    promptLower.includes('bioimped') ||
    promptLower.includes('triagem') ||
    promptLower.includes('perfil')
  );

  let metabolicCalc: MetabolicCalculation | undefined = undefined;
  if (shouldCalculateTriage) {
    metabolicCalc = calculateMetabolicProfile({
      weight: extracted.weight || (raw.bodyToAdd?.weight ? Number(raw.bodyToAdd.weight) : undefined),
      fatPercent: extracted.fat !== undefined ? extracted.fat : (raw.bodyToAdd?.fat ? Number(raw.bodyToAdd.fat) : undefined),
      muscleKg: extracted.muscle !== undefined ? extracted.muscle : (raw.bodyToAdd?.muscle ? Number(raw.bodyToAdd.muscle) : undefined),
      height: extracted.height !== undefined ? extracted.height : (raw.bodyToAdd?.height ? Number(raw.bodyToAdd.height) : undefined),
      goal: goalVal,
      currentState
    });
  }

  if (nameVal || goalVal || rawPu.calories || metabolicCalc) {
    profileUpdates = {
      name: nameVal || currentState.profile.name,
      goal: goalVal || metabolicCalc?.goal || currentState.profile.goal,
      calories: rawPu.calories ? Math.round(Number(rawPu.calories)) : metabolicCalc?.targetKcal,
      protein: rawPu.protein ? Math.round(Number(rawPu.protein)) : metabolicCalc?.protein,
      carbs: rawPu.carbs ? Math.round(Number(rawPu.carbs)) : metabolicCalc?.carbs,
      fat: rawPu.fat ? Math.round(Number(rawPu.fat)) : metabolicCalc?.fat,
      water: rawPu.water ? Math.round(Number(rawPu.water)) : metabolicCalc?.water,
      targetWeight: rawPu.targetWeight ? Number(rawPu.targetWeight) : metabolicCalc?.targetWeight,
      trainTime: rawPu.trainTime || currentState.profile.trainTime,
      mealTime: rawPu.mealTime || currentState.profile.mealTime
    };
  }

  // 2. Body Record To Add (Bioimpedância ou Peso)
  let bodyToAdd: AiProposal['bodyToAdd'] = undefined;
  const rawBody = raw.bodyToAdd && typeof raw.bodyToAdd === 'object' && !Array.isArray(raw.bodyToAdd) ? raw.bodyToAdd : null;
  const bodyWeight = rawBody?.weight ? Number(rawBody.weight) : extracted.weight;

  if (bodyWeight) {
    const bodyFat = rawBody?.fat !== undefined ? Number(rawBody.fat) : extracted.fat;
    const bodyMuscle = rawBody?.muscle !== undefined ? Number(rawBody.muscle) : extracted.muscle;
    const bodyHeight = rawBody?.height !== undefined ? Number(rawBody.height) : extracted.height;
    const bodyWaist = rawBody?.waist !== undefined ? Number(rawBody.waist) : undefined;

    bodyToAdd = {
      weight: bodyWeight,
      fat: bodyFat,
      muscle: bodyMuscle,
      height: bodyHeight,
      waist: bodyWaist,
      bmi: metabolicCalc?.bmi ?? (bodyHeight ? Number((bodyWeight / Math.pow(bodyHeight / 100, 2)).toFixed(1)) : undefined),
      fatMass: metabolicCalc?.fatMass ?? (bodyFat ? Number(((bodyWeight * bodyFat) / 100).toFixed(1)) : undefined),
      fatFreeMass: metabolicCalc?.fatFreeMass ?? (bodyFat ? Number((bodyWeight * (1 - bodyFat / 100)).toFixed(1)) : undefined),
      basalMetabolism: metabolicCalc?.tmb ?? (bodyFat ? Math.round(370 + 21.6 * (bodyWeight * (1 - bodyFat / 100))) : undefined)
    };
  }

  // 3. Summary
  let summary = typeof raw.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : 'Planejamento e triagem concluídos com sucesso.';

  if (profileUpdates && (nameVal || goalVal || bodyToAdd)) {
    const nameStr = profileUpdates.name ? `para **${profileUpdates.name}**` : '';
    const goalStr = profileUpdates.goal ? `focado em **${profileUpdates.goal}**` : '';
    const kcalStr = profileUpdates.calories ? `Meta diária de **${profileUpdates.calories.toLocaleString('pt-BR')} kcal**` : '';
    const protStr = profileUpdates.protein ? `com **${profileUpdates.protein}g de proteína**` : '';
    summary = `Triagem realizada ${nameStr} ${goalStr}. ${kcalStr} ${protStr} calculada com base científica.`;
  }

  // 4. Plans To Create
  let plansToCreate: AiProposal['plansToCreate'] = [];
  if (Array.isArray(raw.plansToCreate) && raw.plansToCreate.length > 0) {
    plansToCreate = raw.plansToCreate.map((p: any) => {
      const planName = p.name || 'Treino Personalizado';
      const days = Array.isArray(p.days) && p.days.length
        ? p.days.map((d: any) => Number(d) % 7)
        : [1, 3, 5];

      const exs = Array.isArray(p.exercises) ? p.exercises.map((e: any) => {
        const exName = String(e.name || 'Exercício');
        let muscle = String(e.muscle || '');
        if (!muscle || muscle === 'Geral') {
          const match = searchLocalExercises(exName)[0];
          muscle = match ? match.muscle : (planName.toLowerCase().includes('perna') ? 'Quadríceps' : 'Peitoral');
        }

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

  // Se o comando pedia treino mas IA não retornou, gera ficha de ouro de pernas
  if (plansToCreate.length === 0 && (promptLower.includes('perna') || (promptLower.includes('treino') && !promptLower.includes('perfil')))) {
    summary = 'Criação de treino completo de membros inferiores (Pernas) com base no catálogo de referência.';
    const legExercises = curatedExercises.filter(e => e.category === 'pernas' || e.category === 'gluteos').slice(0, 5);
    plansToCreate.push({
      name: 'Treino de Pernas & Glúteos',
      subtitle: '5 exercícios clássicos · Foco em hipertrofia',
      days: [2, 5],
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

  // 5. Plans To Update
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

  // 6. Meals To Add
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
  currentState: AppState,
  attachedMedia?: AttachedMedia | null
): Promise<SmartPlanResult> {
  const geminiKey = getGeminiKey();
  if (!geminiKey) {
    throw new Error('Serviço de IA indisponível temporariamente. Tente novamente em instantes.');
  }

  const effectivePrompt = (userPrompt || '').trim() || (attachedMedia
    ? 'Analise a imagem anexada (laudo de bioimpedância, ficha de treino ou plano nutricional) e extraia todos os dados relevantes para configurar perfil, metas, treinos ou refeições.'
    : '');

  if (!effectivePrompt && !attachedMedia) {
    throw new Error('Digite uma instrução ou anexe uma imagem para analisar.');
  }

  const existingPlansSummary = currentState.plans.length > 0
    ? currentState.plans.map(p => `"${p.name}" (ID: ${p.id}, ${p.exercises.length} exercícios: ${p.exercises.map(e => `${e.name} ${e.sets}x${e.reps}`).join(', ')})`).join('\n')
    : 'Nenhum plano cadastrado ainda.';

  const latestBio = currentState.body.at(-1);
  const bioSummary = latestBio
    ? `Último peso: ${latestBio.weight}kg${latestBio.fat ? `, ${latestBio.fat}% gordura` : ''}${latestBio.muscle ? `, ${latestBio.muscle}kg músculo` : ''}`
    : 'Nenhuma avaliação física cadastrada ainda.';

  const stateContext = `
- Perfil Atual: Nome="${currentState.profile.name}", Objetivo="${currentState.profile.goal}"
- Metas Diárias: ${currentState.profile.calories} kcal, ${currentState.profile.protein}g Proteína, ${currentState.profile.carbs}g Carbo, ${currentState.profile.fat}g Gordura, Água: ${currentState.profile.water}ml, Peso de Referência: ${currentState.profile.targetWeight}kg
- Avaliação Corporal: ${bioSummary}
- Planos de Treino Existentes:
${existingPlansSummary}
`;

  // 1. Decisão calibrada do TypeSafe JEV
  const jevPrompt = attachedMedia ? `[Imagem anexada: laudo/ficha] ${effectivePrompt}` : effectivePrompt;
  const jevResult = await evaluateJevIntent(jevPrompt, stateContext);

  // 2. Prompt estruturado com instruções científicas de nutrição e bioimpedância
  const exerciseExamples = curatedExercises.slice(0, 15).map(e => `${e.name} (${e.muscle})`).join(', ');

  const imageInstructions = attachedMedia ? `
==================================================
DIRETRIZES MULTIMODAIS - IMAGEM/PRINT ANEXADO:
O usuário enviou uma imagem (screenshot de bioimpedância InBody/Tanita, foto de ficha de treino ou foto de plano nutricional).
Realize OCR de alta precisão e análise visual profunda:
1. SE FOR LAUDO DE BIOIMPEDÂNCIA / EXAME FÍSICO:
   - Extraia rigorosamente:
     * weight: peso corporal total (kg)
     * fat: percentual de gordura corporal (% de gordura / PGC / BF)
     * muscle: massa muscular esquelética (kg)
     * fatFreeMass: massa livre de gordura / massa magra (kg)
     * fatMass: massa de gordura corporal (kg)
     * height: estatura / altura (cm)
     * bmi: IMC (kg/m²)
     * basalMetabolism: taxa metabólica basal / TMB / BMR (kcal)
   - Preencha "bodyToAdd" com todos esses números exatos.
   - Com base nos dados do laudo, preencha "profileUpdates" com:
     * calories: meta calórica ideal (com base na TMB e objetivo, aplicando déficit para emagrecimento/recomposição ou superávit para ganho de massa)
     * protein: meta de proteína calibrada (~2.2g/kg de massa magra)
     * carbs: carboidratos equilibrados
     * fat: lipídios saudáveis (~0.8g/kg)
     * water: ingestão hídrica (~40ml/kg de peso corporal)
     * targetWeight: peso meta
2. SE FOR FICHA DE TREINO (academia, folha ou aplicativo):
   - Extraia cada exercício, grupos musculares, séries (sets), repetições (reps) e tempo de descanso.
   - Adicione em "plansToCreate" com nomes claros e organizados.
3. SE FOR PLANO ALIMENTAR OU CARDÁPIO:
   - Extraia as refeições para "mealsToAdd" e ajuste as metas diárias de calorias e macros em "profileUpdates".
==================================================` : '';

  const prompt = `Você é o arquiteto de treinos e nutrição do aplicativo Ritmo.
O usuário enviou a seguinte instrução:
"${effectivePrompt}"

Contexto do usuário:
${stateContext}
${jevResult ? `Decisão prévia calibrada pelo JEV: Área = ${jevResult.intent} (${Math.round(jevResult.confidence * 100)}% certeza).` : ''}

Catálogo de exercícios oficiais:
${exerciseExamples}... e outros do banco WGER / TACO.

INSTRUÇÕES CRÍTICAS PARA PERFIL, METAS E BIOIMPEDÂNCIA:
1. Se o usuário informar seu nome (ex: "meu nome é Matheus", "sou o Carlos"), preencha profileUpdates.name = "Matheus".
2. Se o usuário falar sobre "ganhar massa e perder gordura" ou "recomposição", defina goal = "Recomposição corporal". Se falar em "perder gordura/emagrecer/secar/cutting", defina goal = "Perder gordura". Se falar em "ganhar massa/hipertrofia/bulking", defina goal = "Ganhar massa".
3. Se o usuário fornecer peso, % de gordura, bioimpedância ou altura:
   - Preencha bodyToAdd com weight, fat, muscle, height.
   - Calcule cientificamente as metas calóricas ideais:
     * TMB (Katch-McArdle): Massa Magra * 21.6 + 370
     * GET (TDEE): TMB * 1.45 (atividade moderada com treino de força)
     * Para Perder Gordura: Déficit de 400 a 500 kcal (GET - 450 kcal).
     * Para Recomposição Corporal: Leve déficit de 180 kcal com alta proteína.
     * Para Ganhar Massa: Superávit de 350 kcal.
   - Preencha profileUpdates com as calorias calculadas, proteína (~2.2g/kg de massa magra ou 2.0g/kg peso), gordura (~0.8g/kg), carboidratos (saldo restante / 4), água (~40ml/kg) e targetWeight.
4. Se o usuário pedir para preencher o perfil ou fizer uma triagem:
   - Preencha TODOS os campos de profileUpdates para dar uma picture completa.
5. Se o usuário pedir ficha ou treino: crie a lista de exercícios com sets e reps inteiros.
6. Escreva um "summary" amigável e explicativo em português detalhando a estratégia adotada.${imageInstructions}`;

  const geminiSchema = {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      clarifyingQuestion: { type: 'STRING' },
      profileUpdates: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          goal: { type: 'STRING' },
          calories: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          water: { type: 'NUMBER' },
          targetWeight: { type: 'NUMBER' },
          trainTime: { type: 'STRING' },
          mealTime: { type: 'STRING' }
        }
      },
      bodyToAdd: {
        type: 'OBJECT',
        properties: {
          weight: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          muscle: { type: 'NUMBER' },
          height: { type: 'NUMBER' },
          waist: { type: 'NUMBER' }
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
      }
    },
    required: ['summary']
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const contentParts: any[] = [];
  if (attachedMedia && attachedMedia.data) {
    contentParts.push({
      inlineData: {
        mimeType: attachedMedia.mimeType,
        data: attachedMedia.data
      }
    });
  }
  contentParts.push({ text: prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: contentParts }],
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

  // Normalização defensiva com motor científico
  const proposal: AiProposal = normalizeRawProposal(parsedRaw, effectivePrompt, currentState);

  // 4. Monta os Smart Cards comparando com o estado atual
  const cards: SmartCardChange[] = [];

  // --- 1. Nome do Usuário ---
  if (proposal.profileUpdates?.name && proposal.profileUpdates.name !== currentState.profile.name) {
    const newName = proposal.profileUpdates.name;
    cards.push({
      id: uid(),
      category: 'profile_goal',
      icon: 'target',
      title: 'Nome no Perfil',
      subtitle: 'Identificação do usuário no aplicativo',
      badge: 'Perfil',
      before: currentState.profile.name,
      after: newName,
      selected: true,
      apply: (s) => ({
        ...s,
        profile: { ...s.profile, name: newName }
      })
    });
  }

  // --- 2. Objetivo Principal ---
  if (proposal.profileUpdates?.goal && proposal.profileUpdates.goal !== currentState.profile.goal) {
    const newGoal = proposal.profileUpdates.goal;
    cards.push({
      id: uid(),
      category: 'profile_goal',
      icon: 'target',
      title: 'Objetivo do Perfil',
      subtitle: 'Foco principal dos treinos e da dieta',
      badge: 'Objetivo',
      before: currentState.profile.goal,
      after: newGoal,
      details: [
        newGoal === 'Recomposição corporal'
          ? 'Estratégia voltada para ganho de massa magra e redução concomitante de gordura corporal.'
          : newGoal === 'Perder gordura'
          ? 'Estratégia com déficit calórico e preservação de massa magra.'
          : 'Estratégia com superávit para maximizar a hipertrofia muscular.'
      ],
      selected: true,
      apply: (s) => ({
        ...s,
        profile: { ...s.profile, goal: newGoal }
      })
    });
  }

  // --- 3. Avaliação de Bioimpedância / Dados Corporais ---
  if (proposal.bodyToAdd) {
    const b = proposal.bodyToAdd;
    const dateVal = today();
    const detailsList: string[] = [];
    if (b.fat !== undefined) detailsList.push(`Gordura corporal: ${b.fat}%`);
    if (b.fatFreeMass !== undefined) detailsList.push(`Massa Magra (Livre de Gordura): ${b.fatFreeMass} kg`);
    if (b.fatMass !== undefined) detailsList.push(`Massa Gorda: ${b.fatMass} kg`);
    if (b.muscle !== undefined) detailsList.push(`Massa Muscular: ${b.muscle} kg`);
    if (b.height !== undefined) detailsList.push(`Altura: ${b.height} cm`);
    if (b.bmi !== undefined) detailsList.push(`IMC Calculado: ${b.bmi.toFixed(1)} kg/m²`);
    if (b.basalMetabolism !== undefined) detailsList.push(`Taxa Metabólica Basal (TMB): ${b.basalMetabolism} kcal/dia`);

    const lastBody = currentState.body.at(-1);

    cards.push({
      id: uid(),
      category: 'body_metric',
      icon: 'scale',
      title: b.fat !== undefined ? 'Nova Avaliação de Bioimpedância' : 'Registro de Peso Corporal',
      subtitle: `Registro salvo no histórico de evolução (${dateVal})`,
      badge: b.fat !== undefined ? 'Bioimpedância' : 'Peso',
      before: lastBody ? `${lastBody.weight} kg${lastBody.fat ? ` · ${lastBody.fat}% gordura` : ''}` : 'Nenhum registro anterior',
      after: `${b.weight} kg${b.fat ? ` · ${b.fat}% gordura` : ''}`,
      details: detailsList,
      selected: true,
      apply: (s) => {
        const newRecord: BodyRecord = {
          id: uid(),
          date: dateVal,
          weight: b.weight,
          fat: b.fat ?? null,
          muscle: b.muscle ?? null,
          waist: b.waist ?? null,
          height: b.height ?? null,
          bmi: b.bmi ?? (b.height ? Number((b.weight / Math.pow(b.height / 100, 2)).toFixed(1)) : null),
          fatMass: b.fatMass ?? (b.fat ? Number(((b.weight * b.fat) / 100).toFixed(1)) : null),
          fatFreeMass: b.fatFreeMass ?? (b.fat ? Number((b.weight * (1 - b.fat / 100)).toFixed(1)) : null),
          visceralFat: null,
          basalMetabolism: b.basalMetabolism ?? (b.fat ? Math.round(370 + 21.6 * (b.weight * (1 - b.fat / 100))) : null),
          kind: b.fat !== undefined ? 'bioimpedance' : 'measurement',
          device: 'Comando Inteligente IA',
          notes: 'Registrado via triagem inteligente com IA'
        };
        return {
          ...s,
          body: [...s.body, newRecord]
        };
      }
    });
  }

  // --- 4. Meta Calórica ---
  if (proposal.profileUpdates?.calories !== undefined && proposal.profileUpdates.calories !== currentState.profile.calories) {
    const newCals = proposal.profileUpdates.calories;
    const diff = newCals - currentState.profile.calories;
    const sign = diff > 0 ? `+${diff}` : `${diff}`;
    cards.push({
      id: uid(),
      category: 'diet_macros',
      icon: 'flame',
      title: 'Meta Calórica Calculada',
      subtitle: 'Energia diária estimada com base na TMB e objetivo',
      badge: 'Nutrição',
      before: `${currentState.profile.calories.toLocaleString('pt-BR')} kcal`,
      after: `${newCals.toLocaleString('pt-BR')} kcal (${sign} kcal)`,
      details: [
        `Calculado com fórmula de Katch-McArdle / TDEE para o seu peso e meta.`,
        `Déficit ou superávit calibrado para máxima preservação muscular.`
      ],
      selected: true,
      apply: (s) => ({
        ...s,
        profile: { ...s.profile, calories: newCals }
      })
    });
  }

  // --- 5. Meta de Proteína ---
  if (proposal.profileUpdates?.protein !== undefined && proposal.profileUpdates.protein !== currentState.profile.protein) {
    const newProt = proposal.profileUpdates.protein;
    const diff = newProt - currentState.profile.protein;
    const sign = diff > 0 ? `+${diff}` : `${diff}`;
    cards.push({
      id: uid(),
      category: 'diet_macros',
      icon: 'protein',
      title: 'Meta Proteica',
      subtitle: 'Aporte proteico para síntese e reparo muscular',
      badge: 'Macronutriente',
      before: `${currentState.profile.protein}g`,
      after: `${newProt}g (${sign}g)`,
      details: [
        `Baseado em ~2.2g por kg de massa magra para recomposição ou emagrecimento.`,
        `Fundamental para conter o catabolismo proteico durante a oxidação lipídica.`
      ],
      selected: true,
      apply: (s) => ({
        ...s,
        profile: { ...s.profile, protein: newProt }
      })
    });
  }

  // --- 6. Carboidratos e Gorduras ---
  if (
    (proposal.profileUpdates?.carbs !== undefined && proposal.profileUpdates.carbs !== currentState.profile.carbs) ||
    (proposal.profileUpdates?.fat !== undefined && proposal.profileUpdates.fat !== currentState.profile.fat)
  ) {
    const newCarbs = proposal.profileUpdates?.carbs ?? currentState.profile.carbs;
    const newFat = proposal.profileUpdates?.fat ?? currentState.profile.fat;
    cards.push({
      id: uid(),
      category: 'diet_macros',
      icon: 'target',
      title: 'Carboidratos & Gorduras',
      subtitle: 'Balanço energético de macronutrientes',
      badge: 'Metas',
      before: `${currentState.profile.carbs}g carbo · ${currentState.profile.fat}g gordura`,
      after: `${newCarbs}g carbo · ${newFat}g gordura`,
      details: [
        `Gorduras (~0.8g/kg): suporte hormonal e absorção de vitaminas lipossolúveis.`,
        `Carboidratos: energia para intensidade nos treinos e reposição de glicogênio.`
      ],
      selected: true,
      apply: (s) => ({
        ...s,
        profile: { ...s.profile, carbs: newCarbs, fat: newFat }
      })
    });
  }

  // --- 7. Meta Hídrica ---
  if (proposal.profileUpdates?.water !== undefined && proposal.profileUpdates.water !== currentState.profile.water) {
    const newWater = proposal.profileUpdates.water;
    cards.push({
      id: uid(),
      category: 'diet_macros',
      icon: 'target',
      title: 'Meta de Hidratação Diária',
      subtitle: 'Ingestão hídrica recomendada para o seu peso',
      badge: 'Hidratação',
      before: `${currentState.profile.water.toLocaleString('pt-BR')} ml`,
      after: `${newWater.toLocaleString('pt-BR')} ml`,
      details: [
        `Cálculo: ~40 ml por kg de peso corporal.`,
        `Essencial para transporte de nutrientes e performance neuromuscular.`
      ],
      selected: true,
      apply: (s) => ({
        ...s,
        profile: { ...s.profile, water: newWater }
      })
    });
  }

  // --- 8. Peso de Referência Alvo ---
  if (proposal.profileUpdates?.targetWeight !== undefined && proposal.profileUpdates.targetWeight !== currentState.profile.targetWeight) {
    const newTargetWeight = proposal.profileUpdates.targetWeight;
    cards.push({
      id: uid(),
      category: 'profile_goal',
      icon: 'scale',
      title: 'Peso Alvo de Referência',
      subtitle: 'Meta de peso a longo prazo',
      badge: 'Perfil',
      before: `${currentState.profile.targetWeight} kg`,
      after: `${newTargetWeight} kg`,
      selected: true,
      apply: (s) => ({
        ...s,
        profile: { ...s.profile, targetWeight: newTargetWeight }
      })
    });
  }

  // --- 9. Novos Planos de Treino ---
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
        before: 'Nenhum plano cadastrado',
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

  // --- 10. Atualização de Treinos Existentes ---
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

  // --- 11. Refeições Adicionadas ---
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
