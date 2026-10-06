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
  jevDecision?: {
    intent: string;
    confidence: number;
    choiceDetails?: string;
  };
  cards: SmartCardChange[];
}

/**
 * 1. Avaliação via TypeSafe / JEV System One para classificar com precisão
 * matemática as entidades e intenções da solicitação.
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

    if (!res.ok) {
      console.warn('TypeSafe Jev retornou status', res.status);
      return null;
    }

    const data = await res.json();
    return {
      intent: data?.answers?.target_area?.choice ?? 'general',
      confidence: data?.answers?.target_area?.confidence ?? 1,
      action: data?.answers?.action_mode?.choice ?? 'update_existing',
      isWorkout: (data?.answers?.is_workout_change?.noul ?? 0) > 0.5,
      isDiet: (data?.answers?.is_diet_change?.noul ?? 0) > 0.5
    };
  } catch (err) {
    console.warn('Erro ao consultar TypeSafe Jev:', err);
    return null;
  }
}

// Schema estrito para saída do Gemini
const aiProposalSchema = z.object({
  summary: z.string(),
  profileUpdates: z.object({
    goal: z.enum(['Perder gordura', 'Ganhar massa', 'Recomposição corporal', 'Manter peso']).optional(),
    calories: z.number().min(1000).max(6000).optional(),
    protein: z.number().min(30).max(400).optional(),
    carbs: z.number().min(0).max(900).optional(),
    fat: z.number().min(20).max(250).optional(),
    water: z.number().min(500).max(6000).optional(),
    targetWeight: z.number().min(30).max(300).optional(),
    trainTime: z.string().optional(),
    mealTime: z.string().optional()
  }).optional(),
  plansToCreate: z.array(z.object({
    name: z.string(),
    subtitle: z.string().default(''),
    days: z.array(z.number().int().min(0).max(6)).default([1, 3, 5]),
    exercises: z.array(z.object({
      name: z.string(),
      muscle: z.string(),
      sets: z.number().int().min(1).max(15),
      reps: z.number().int().min(1).max(100),
      load: z.number().nonnegative().max(1000).default(0),
      rest: z.number().int().min(0).max(1200).default(90),
      origin: z.enum(['personal', 'ia', 'usuario']).default('ia')
    }))
  })).default([]),
  plansToUpdate: z.array(z.object({
    planIdOrName: z.string(),
    name: z.string().optional(),
    subtitle: z.string().optional(),
    days: z.array(z.number().int().min(0).max(6)).optional(),
    exercisesToAdd: z.array(z.object({
      name: z.string(),
      muscle: z.string(),
      sets: z.number().int().min(1).max(15),
      reps: z.number().int().min(1).max(100),
      load: z.number().nonnegative().max(1000).default(0),
      rest: z.number().int().min(0).max(1200).default(90),
      origin: z.enum(['personal', 'ia', 'usuario']).default('ia')
    })).optional(),
    exercisesToUpdate: z.array(z.object({
      exerciseName: z.string(),
      sets: z.number().int().min(1).max(15).optional(),
      reps: z.number().int().min(1).max(100).optional(),
      load: z.number().nonnegative().max(1000).optional(),
      rest: z.number().int().min(0).max(1200).optional()
    })).optional()
  })).default([]),
  mealsToAdd: z.array(z.object({
    name: z.string(),
    time: z.string().default('12:30'),
    items: z.array(z.object({
      foodId: z.string().optional(),
      name: z.string(),
      grams: z.number().positive().max(10000),
      kcal: z.number().nonnegative(),
      protein: z.number().nonnegative(),
      carbs: z.number().nonnegative(),
      fat: z.number().nonnegative()
    }))
  })).default([]),
  bodyToAdd: z.object({
    weight: z.number().positive().max(500),
    fat: z.number().nonnegative().max(75).optional(),
    muscle: z.number().nonnegative().max(200).optional()
  }).optional()
});

export type AiProposal = z.infer<typeof aiProposalSchema>;

/**
 * 2. Processa o comando em linguagem natural via JEV + Gemini 2.5 Flash
 * e gera os Smart Cards com as alterações discriminadas para aprovação.
 */
export async function planSmartCommand(
  userPrompt: string,
  currentState: AppState
): Promise<SmartPlanResult> {
  const geminiKey = getGeminiKey();
  if (!geminiKey) {
    throw new Error('Configure a chave do Google Gemini em API_KEYS.env para executar comandos inteligentes.');
  }

  // Prepara resumo do estado atual
  const existingPlansSummary = currentState.plans.length > 0
    ? currentState.plans.map(p => `"${p.name}" (ID: ${p.id}, ${p.exercises.length} exercícios: ${p.exercises.map(e => `${e.name} ${e.sets}x${e.reps}`).join(', ')})`).join('\n')
    : 'Nenhum plano cadastrado.';

  const stateContext = `
- Perfil: ${currentState.profile.name}, Objetivo: ${currentState.profile.goal}
- Metas atuais: ${currentState.profile.calories} kcal, ${currentState.profile.protein}g Proteína, ${currentState.profile.carbs}g Carbo, ${currentState.profile.fat}g Gordura, Água: ${currentState.profile.water}ml, Peso Alvo: ${currentState.profile.targetWeight}kg
- Planos de treino cadastrados atualmente:
${existingPlansSummary}
`;

  // 1. Decisão calibrada com TypeSafe JEV
  const jevResult = await evaluateJevIntent(userPrompt, stateContext);

  // 2. Extração estruturada com Gemini
  const prompt = `Você é o arquiteto inteligente do aplicativo Ritmo.
O usuário digitou um comando para atualizar seus dados, planos de treino, dietas, metas ou refeições.

Estado atual do usuário:
${stateContext}
${jevResult ? `Classificação prévia calibrada pelo JEV: Área = ${jevResult.intent} (${Math.round(jevResult.confidence * 100)}% certeza), Ação = ${jevResult.action}.` : ''}

Solicitação do usuário:
"${userPrompt}"

Instruções para geração da proposta:
1. Identifique exatamente quais campos e entidades o usuário deseja alterar, criar ou atualizar.
2. Se o usuário pediu para adicionar ou criar treinos (ex.: "Treino ABC", "Treino de peito", etc.), crie objetos em "plansToCreate" com nomes claros, dias da semana sugeridos (0=Dom a 6=Sáb) e exercícios realistas de musculação.
3. Se o usuário pediu para alterar um treino existente (ex.: adicionar exercícios, mudar cargas ou repetições), use "plansToUpdate" apontando para o nome ou ID do plano existente correspondente.
4. Se o usuário pediu para alterar metas (calorias, proteína, carboidrato, gordura, peso alvo, objetivo), preencha "profileUpdates".
5. Se o usuário pediu para registrar alimentos ou refeições, monte "mealsToAdd".
6. Se informou peso corporal, preencha "bodyToAdd".
7. Forneça um "summary" em português explicando com clareza o que está sendo proposto.

Retorne estritamente o JSON especificado pelo schema.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Falha na API Gemini ao analisar comando (${res.status})`);
  }

  const jsonResponse = await res.json();
  const rawText = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Nenhuma resposta recebida do modelo.');
  }

  let proposal: AiProposal;
  try {
    proposal = aiProposalSchema.parse(JSON.parse(rawText));
  } catch (err) {
    console.error('Falha de validação da proposta:', err, rawText);
    throw new Error('A IA gerou um formato inválido para este comando.');
  }

  // 3. Converte a proposta em Smart Cards comparando com o estado atual
  const cards: SmartCardChange[] = [];

  // --- Perfil e Metas Nutricionais ---
  if (proposal.profileUpdates) {
    const pu = proposal.profileUpdates;

    // Meta Calórica
    if (pu.calories !== undefined && pu.calories !== currentState.profile.calories) {
      const diff = pu.calories - currentState.profile.calories;
      const sign = diff > 0 ? `+${diff}` : `${diff}`;
      cards.push({
        id: uid(),
        category: 'diet_macros',
        icon: 'flame',
        title: 'Meta Calórica',
        subtitle: 'Energia diária programada',
        badge: 'Meta Nutricional',
        before: `${currentState.profile.calories.toLocaleString('pt-BR')} kcal`,
        after: `${pu.calories.toLocaleString('pt-BR')} kcal (${sign} kcal)`,
        selected: true,
        apply: (s) => ({
          ...s,
          profile: { ...s.profile, calories: pu.calories! }
        })
      });
    }

    // Proteína
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

    // Carboidratos & Gordura agrupados se houver alteração
    if ((pu.carbs !== undefined && pu.carbs !== currentState.profile.carbs) ||
        (pu.fat !== undefined && pu.fat !== currentState.profile.fat)) {
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
          profile: {
            ...s.profile,
            carbs: newCarbs,
            fat: newFat
          }
        })
      });
    }

    // Objetivo ou Peso Alvo
    if ((pu.goal && pu.goal !== currentState.profile.goal) ||
        (pu.targetWeight !== undefined && pu.targetWeight !== currentState.profile.targetWeight)) {
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
          profile: {
            ...s.profile,
            goal: newGoal,
            targetWeight: newTargetWeight
          }
        })
      });
    }

    // Água ou Horários
    if (pu.water !== undefined && pu.water !== currentState.profile.water) {
      cards.push({
        id: uid(),
        category: 'profile_goal',
        icon: 'target',
        title: 'Meta de Hidratação',
        subtitle: 'Ingestão mínima de água por dia',
        badge: 'Perfil',
        before: `${(currentState.profile.water / 1000).toFixed(1)} L`,
        after: `${(pu.water / 1000).toFixed(1)} L`,
        selected: true,
        apply: (s) => ({
          ...s,
          profile: { ...s.profile, water: pu.water! }
        })
      });
    }
  }

  // --- Novos Planos de Treino (Criação em Lote) ---
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
          origin: (ex.origin as Origin) || 'ia'
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

  // --- Atualização de Planos de Treino Existentes ---
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

              // Atualiza existentes
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

              // Adiciona novos exercícios
              if (updateReq.exercisesToAdd) {
                const newExs: Exercise[] = updateReq.exercisesToAdd.map(e => ({
                  id: uid(),
                  name: e.name,
                  muscle: e.muscle,
                  sets: e.sets,
                  reps: e.reps,
                  load: e.load,
                  rest: e.rest,
                  origin: (e.origin as Origin) || 'ia'
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
          if (cat) {
            return ingredient(cat, i.grams);
          }
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
            notes: 'Registrado via comando de voz ou texto'
          }
        ]
      })
    });
  }

  return {
    summary: proposal.summary,
    jevDecision: jevResult ? {
      intent: jevResult.intent,
      confidence: jevResult.confidence,
      choiceDetails: `Modo: ${jevResult.action}`
    } : undefined,
    cards
  };
}

/**
 * 3. Aplica apenas os Smart Cards que o usuário manteve selecionados,
 * valida o novo estado e cria uma entrada no histórico de logs para permitir rollback.
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

  // Aplica cumulativamente cada card selecionado
  let updatedState = currentState;
  for (const card of selectedCards) {
    updatedState = card.apply(updatedState);
  }

  // Valida integridade do novo estado
  const validatedState = stateSchema.parse(updatedState);

  // Prepara o sumário das alterações aplicadas
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

  // Salva no log de auditoria
  recordAuditEntry(logEntry);

  return {
    nextState: validatedState,
    logEntry
  };
}
