import {
  type AppState,
  type Exercise,
  type Session,
  type Plan,
  uid,
} from './domain';
import {
  normalizeExercise,
  removeSessionExercise,
  updateSessionExerciseNotes,
  replaceSessionExercise,
  syncSessionChangesToPlan,
  getMonthlyWorkoutReport,
  type MonthlyWorkoutReport,
} from './training';
import {
  applyPlanUpdate,
  matchPlan,
  matchExercise,
  createSuperset,
  removeSuperset,
} from './planEdits';

function resolveTargetPlan(plans: AppState['plans'], planIdOrName?: unknown, fallbackPlanId?: string | null): Plan | null {
  if (planIdOrName) {
    const match = matchPlan(plans, String(planIdOrName));
    return match.ok ? match.plan : null;
  }
  if (fallbackPlanId) {
    return plans.find(p => p.id === fallbackPlanId) ?? null;
  }
  return plans[0] ?? null;
}

export interface AiWorkoutToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, { type: string; description: string; items?: any; required?: boolean }>;
    required: string[];
  };
}

export const AI_WORKOUT_TOOLS: AiWorkoutToolDefinition[] = [
  {
    name: 'remove_exercise',
    description: 'Remove um exercício da sessão ativa e/ou do plano de treino base para as próximas semanas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseName: { type: 'STRING', description: 'Nome do exercício a ser removido (ex.: "Agachamento livre", "Leg Press")' },
        planIdOrName: { type: 'STRING', description: 'Nome ou ID do plano (opcional; se omitido e houver sessão ativa, usa o plano da sessão)' },
        affectActiveSession: { type: 'BOOLEAN', description: 'Se verdadeiro e houver sessão aberta, remove da sessão atual (padrão: true)' },
        persistToPlan: { type: 'BOOLEAN', description: 'Se verdadeiro, remove também da ficha de treino base para as próximas semanas (padrão: true)' },
      },
      required: ['exerciseName'],
    },
  },
  {
    name: 'replace_exercise',
    description: 'Substitui um exercício por outro na sessão aberta e/ou no plano base para as próximas semanas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        currentExerciseName: { type: 'STRING', description: 'Nome do exercício atual a ser substituído' },
        replacementName: { type: 'STRING', description: 'Nome do novo exercício' },
        muscle: { type: 'STRING', description: 'Grupo muscular do novo exercício (opcional)' },
        load: { type: 'NUMBER', description: 'Carga inicial em kg (opcional)' },
        reps: { type: 'INTEGER', description: 'Repetições por série (opcional)' },
        reason: { type: 'STRING', description: 'Motivo da substituição (ex.: "Aparelho ocupado", "Desconforto articular", "Variação")' },
        planIdOrName: { type: 'STRING', description: 'Nome ou ID do plano (opcional)' },
        affectActiveSession: { type: 'BOOLEAN', description: 'Aplica na sessão aberta (padrão: true)' },
        persistToPlan: { type: 'BOOLEAN', description: 'Persiste na ficha de treino para as próximas semanas (padrão: true)' },
      },
      required: ['currentExerciseName', 'replacementName'],
    },
  },
  {
    name: 'add_exercise',
    description: 'Adiciona um novo exercício à sessão ativa e/ou ao plano base correspondente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nome do exercício a adicionar' },
        muscle: { type: 'STRING', description: 'Grupo muscular (ex.: Peitoral, Quadríceps, Costas)' },
        sets: { type: 'INTEGER', description: 'Quantidade de séries (1 a 15)' },
        reps: { type: 'INTEGER', description: 'Repetições por série (1 a 100)' },
        load: { type: 'NUMBER', description: 'Carga inicial em kg' },
        rest: { type: 'INTEGER', description: 'Descanso em segundos (padrão: 90)' },
        planIdOrName: { type: 'STRING', description: 'Nome ou ID do plano (opcional)' },
        affectActiveSession: { type: 'BOOLEAN', description: 'Adiciona na sessão em andamento (padrão: true)' },
        persistToPlan: { type: 'BOOLEAN', description: 'Persiste na ficha para as próximas semanas (padrão: true)' },
      },
      required: ['name', 'sets', 'reps'],
    },
  },
  {
    name: 'set_exercise_notes',
    description: 'Adiciona ou atualiza uma anotação discreta em um exercício (ex.: regulagem da máquina, banco 3, pegada neutra).',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseName: { type: 'STRING', description: 'Nome do exercício' },
        note: { type: 'STRING', description: 'Texto da anotação/observação' },
        planIdOrName: { type: 'STRING', description: 'Nome ou ID do plano (opcional)' },
        affectActiveSession: { type: 'BOOLEAN', description: 'Se houver sessão ativa, atualiza a anotação na sessão atual (padrão: true)' },
      },
      required: ['exerciseName', 'note'],
    },
  },
  {
    name: 'update_exercise_load',
    description: 'Atualiza o peso/carga de um exercício na sessão aberta ou na ficha de treino.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseName: { type: 'STRING', description: 'Nome do exercício' },
        load: { type: 'NUMBER', description: 'Nova carga em kg' },
        planIdOrName: { type: 'STRING', description: 'Nome ou ID do plano (opcional)' },
        affectActiveSession: { type: 'BOOLEAN', description: 'Aplica na sessão ativa (padrão: true)' },
        persistToPlan: { type: 'BOOLEAN', description: 'Persiste na ficha de treino para as próximas semanas (padrão: true)' },
      },
      required: ['exerciseName', 'load'],
    },
  },
  {
    name: 'create_bi_set',
    description: 'Agrupa 2 exercícios em Bi-Set (série conjugada, descanso somente após a dupla).',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseNames: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Lista com exatamente 2 nomes de exercícios' },
        planIdOrName: { type: 'STRING', description: 'Nome ou ID do plano' },
        affectActiveSession: { type: 'BOOLEAN', description: 'Aplica na sessão ativa se aberta (padrão: true)' },
        persistToPlan: { type: 'BOOLEAN', description: 'Persiste na ficha base (padrão: true)' },
      },
      required: ['exerciseNames'],
    },
  },
  {
    name: 'remove_bi_set',
    description: 'Desfaz um Bi-Set, separando os exercícios em movimentos convencionais com descanso próprio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exerciseName: { type: 'STRING', description: 'Nome de um dos exercícios pertencentes ao bi-set' },
        planIdOrName: { type: 'STRING', description: 'Nome ou ID do plano' },
        affectActiveSession: { type: 'BOOLEAN', description: 'Aplica na sessão ativa se aberta (padrão: true)' },
        persistToPlan: { type: 'BOOLEAN', description: 'Persiste na ficha base (padrão: true)' },
      },
      required: ['exerciseName'],
    },
  },
  {
    name: 'get_monthly_training_report',
    description: 'Gera um relatório consolidado de treinos do mês, com volume, séries, frequência e cargas máximas atingidas ("pesos que aguenta").',
    parameters: {
      type: 'OBJECT',
      properties: {
        yearMonth: { type: 'STRING', description: 'Mês no formato AAAA-MM (ex.: "2026-10"). Se omitido, usa o mês atual.' },
      },
      required: [],
    },
  },
];

export interface ToolCallResult {
  success: boolean;
  state: AppState;
  message: string;
  data?: any;
}

/**
 * Universal Toolcall Dispatcher for AI agents controlling Ritmo workouts and training sessions.
 */
export function executeWorkoutToolCall(
  currentState: AppState,
  toolName: string,
  args: Record<string, any>
): ToolCallResult {
  let state = currentState;
  const activeSession = state.sessions.find(s => !s.finishedAt);
  const affectActive = args.affectActiveSession !== false && Boolean(activeSession);
  const persistPlan = args.persistToPlan !== false;

  switch (toolName) {
    case 'remove_exercise': {
      const exName = String(args.exerciseName || '').trim();
      if (!exName) return { success: false, state, message: 'Nome do exercício é obrigatório.' };
      const norm = normalizeExercise(exName);
      let removedFromSession = false;
      let removedFromPlan = false;
      let actualName = exName;

      // 1. Remove from active session if requested
      if (affectActive && activeSession) {
        const sTarget = activeSession.exercises.find(e => normalizeExercise(e.name) === norm || normalizeExercise(e.name).includes(norm));
        if (sTarget) {
          actualName = sTarget.name;
          const updatedSession = removeSessionExercise(activeSession, sTarget.id);
          state = {
            ...state,
            sessions: state.sessions.map(s => s.id === activeSession.id ? updatedSession : s),
          };
          removedFromSession = true;
        }
      }

      // 2. Remove from plan
      if (persistPlan) {
        const targetPlan = resolveTargetPlan(state.plans, args.planIdOrName, activeSession?.planId);

        if (targetPlan) {
          const outcome = applyPlanUpdate(targetPlan, {
            planIdOrName: targetPlan.id,
            exercisesToRemove: [actualName],
          });
          if (outcome.changed) {
            state = {
              ...state,
              plans: state.plans.map(p => p.id === targetPlan.id ? outcome.plan : p),
            };
            removedFromPlan = true;
          }
        }
      }

      if (!removedFromSession && !removedFromPlan) {
        return { success: false, state, message: `Exercício "${exName}" não encontrado para remoção.` };
      }

      return {
        success: true,
        state,
        message: `Exercício "${actualName}" removido com sucesso${removedFromSession ? ' da sessão aberta' : ''}${removedFromPlan ? ' e da ficha para os próximos treinos' : ''}.`,
      };
    }

    case 'replace_exercise': {
      const curName = String(args.currentExerciseName || '').trim();
      const newName = String(args.replacementName || '').trim();
      if (!curName || !newName) {
        return { success: false, state, message: 'Exercício atual e novo exercício são obrigatórios.' };
      }
      const norm = normalizeExercise(curName);
      let replacedInSession = false;
      let replacedInPlan = false;
      let actualOrigName = curName;

      // 1. Replace in active session
      if (affectActive && activeSession) {
        const sTarget = activeSession.exercises.find(e => normalizeExercise(e.name) === norm || normalizeExercise(e.name).includes(norm));
        if (sTarget) {
          actualOrigName = sTarget.name;
          const updatedSession = replaceSessionExercise(activeSession, sTarget.id, {
            name: newName,
            muscle: args.muscle || sTarget.muscle,
            load: args.load ?? sTarget.load,
            reps: args.reps ?? sTarget.reps,
            reason: args.reason || 'Variação pelo assistente IA',
          });
          state = {
            ...state,
            sessions: state.sessions.map(s => s.id === activeSession.id ? updatedSession : s),
          };
          replacedInSession = true;
        }
      }

      // 2. Persist in plan
      if (persistPlan) {
        const targetPlan = resolveTargetPlan(state.plans, args.planIdOrName, activeSession?.planId);

        if (targetPlan) {
          const outcome = applyPlanUpdate(targetPlan, {
            planIdOrName: targetPlan.id,
            exercisesToReplace: [{
              exerciseName: actualOrigName,
              replacement: {
                name: newName,
                muscle: args.muscle ? String(args.muscle) : undefined,
                load: args.load !== undefined ? Number(args.load) : undefined,
                reps: args.reps !== undefined ? Number(args.reps) : undefined,
              },
            }],
          });
          if (outcome.changed) {
            state = {
              ...state,
              plans: state.plans.map(p => p.id === targetPlan.id ? outcome.plan : p),
            };
            replacedInPlan = true;
          }
        }
      }

      if (!replacedInSession && !replacedInPlan) {
        return { success: false, state, message: `Exercício "${curName}" não encontrado para substituição.` };
      }

      return {
        success: true,
        state,
        message: `"${actualOrigName}" substituído por "${newName}"${replacedInSession ? ' na sessão atual' : ''}${replacedInPlan ? ' e salvo para os próximos treinos' : ''}.`,
      };
    }

    case 'add_exercise': {
      const name = String(args.name || '').trim();
      const muscle = String(args.muscle || 'Geral').trim();
      const sets = Math.max(1, Math.min(15, Number(args.sets) || 3));
      const reps = Math.max(1, Math.min(100, Number(args.reps) || 12));
      const load = Math.max(0, Math.min(1000, Number(args.load) || 0));
      const rest = Math.max(0, Math.min(1200, Number(args.rest) || 90));

      if (!name) return { success: false, state, message: 'Nome do exercício é obrigatório.' };

      let addedToSession = false;
      let addedToPlan = false;

      const newExercise: Exercise = {
        id: uid(),
        name,
        muscle,
        sets,
        reps,
        load,
        rest,
        origin: 'ia',
      };

      if (affectActive && activeSession) {
        state = {
          ...state,
          sessions: state.sessions.map(s => s.id === activeSession.id ? {
            ...s,
            exercises: [
              ...s.exercises,
              {
                ...newExercise,
                logs: Array.from({ length: sets }, () => ({
                  id: uid(),
                  reps,
                  load,
                  done: false,
                  rir: 2,
                })),
                reason: 'Adicionado pelo assistente IA',
              },
            ],
          } : s),
        };
        addedToSession = true;
      }

      if (persistPlan) {
        const targetPlan = resolveTargetPlan(state.plans, args.planIdOrName, activeSession?.planId);

        if (targetPlan) {
          const outcome = applyPlanUpdate(targetPlan, {
            planIdOrName: targetPlan.id,
            exercisesToAdd: [{
              name,
              muscle,
              sets,
              reps,
              load,
              rest,
              origin: 'ia',
            }],
          });
          if (outcome.changed) {
            state = {
              ...state,
              plans: state.plans.map(p => p.id === targetPlan.id ? outcome.plan : p),
            };
            addedToPlan = true;
          }
        }
      }

      return {
        success: true,
        state,
        message: `Exercício "${name}" (${sets}×${reps} · ${load}kg) adicionado com sucesso${addedToSession ? ' ao treino em andamento' : ''}${addedToPlan ? ' e à ficha para os próximos treinos' : ''}.`,
      };
    }

    case 'set_exercise_notes': {
      const exName = String(args.exerciseName || '').trim();
      const note = String(args.note || '').trim();
      if (!exName) return { success: false, state, message: 'Nome do exercício é obrigatório.' };

      const norm = normalizeExercise(exName);
      let updated = false;

      if (activeSession) {
        const target = activeSession.exercises.find(e => normalizeExercise(e.name) === norm || normalizeExercise(e.name).includes(norm));
        if (target) {
          const updatedSession = updateSessionExerciseNotes(activeSession, target.id, note);
          state = {
            ...state,
            sessions: state.sessions.map(s => s.id === activeSession.id ? updatedSession : s),
          };
          updated = true;
        }
      }

      // Also set note in matching plan
      for (const plan of state.plans) {
        const pEx = plan.exercises.find(e => normalizeExercise(e.name) === norm || normalizeExercise(e.name).includes(norm));
        if (pEx) {
          state = {
            ...state,
            plans: state.plans.map(p => p.id === plan.id ? {
              ...p,
              exercises: p.exercises.map(e => e.id === pEx.id ? { ...e, notes: note || undefined } : e),
            } : p),
          };
          updated = true;
        }
      }

      if (!updated) {
        return { success: false, state, message: `Exercício "${exName}" não encontrado para registrar nota.` };
      }

      return {
        success: true,
        state,
        message: `Observação salva para "${exName}": "${note}".`,
      };
    }

    case 'update_exercise_load': {
      const exName = String(args.exerciseName || '').trim();
      const load = Number(args.load);
      if (!exName || isNaN(load) || load < 0) {
        return { success: false, state, message: 'Nome do exercício e carga válida são obrigatórios.' };
      }

      const norm = normalizeExercise(exName);
      let updatedSession = false;
      let updatedPlan = false;

      if (affectActive && activeSession) {
        const target = activeSession.exercises.find(e => normalizeExercise(e.name) === norm || normalizeExercise(e.name).includes(norm));
        if (target) {
          state = {
            ...state,
            sessions: state.sessions.map(s => s.id === activeSession.id ? {
              ...s,
              exercises: s.exercises.map(e => e.id === target.id ? {
                ...e,
                load,
                logs: e.logs.map(l => ({ ...l, load })),
              } : e),
            } : s),
          };
          updatedSession = true;
        }
      }

      if (persistPlan) {
        const targetPlan = resolveTargetPlan(state.plans, args.planIdOrName, activeSession?.planId);

        if (targetPlan) {
          const outcome = applyPlanUpdate(targetPlan, {
            planIdOrName: targetPlan.id,
            exercisesToUpdate: [{ exerciseName: exName, load }],
          });
          if (outcome.changed) {
            state = {
              ...state,
              plans: state.plans.map(p => p.id === targetPlan.id ? outcome.plan : p),
            };
            updatedPlan = true;
          }
        }
      }

      return {
        success: true,
        state,
        message: `Carga de "${exName}" atualizada para ${load} kg${updatedSession ? ' na sessão atual' : ''}${updatedPlan ? ' e na ficha de treino' : ''}.`,
      };
    }

    case 'create_bi_set': {
      const names = Array.isArray(args.exerciseNames) ? args.exerciseNames : [];
      if (names.length < 2) return { success: false, state, message: 'Indique pelo menos 2 exercícios para formar um Bi-set.' };

      const targetPlan = resolveTargetPlan(state.plans, args.planIdOrName, activeSession?.planId);

      if (!targetPlan) return { success: false, state, message: 'Nenhum plano de treino correspondente encontrado.' };

      const outcome = applyPlanUpdate(targetPlan, {
        planIdOrName: targetPlan.id,
        supersetsToCreate: [names],
      });

      if (!outcome.changed) {
        return { success: false, state, message: outcome.warnings[0] || 'Não foi possível agrupar os exercícios em Bi-set.' };
      }

      state = {
        ...state,
        plans: state.plans.map(p => p.id === targetPlan.id ? outcome.plan : p),
      };

      // If active session belongs to this plan, update supersetId in session as well
      if (affectActive && activeSession && activeSession.planId === targetPlan.id) {
        const sIds = new Set<string>();
        const supersetId = uid();
        const normNames = new Set(names.map(normalizeExercise));
        state = {
          ...state,
          sessions: state.sessions.map(s => s.id === activeSession.id ? {
            ...s,
            exercises: s.exercises.map(e => normNames.has(normalizeExercise(e.name)) ? { ...e, supersetId } : e),
          } : s),
        };
      }

      return {
        success: true,
        state,
        message: `Bi-set criado entre ${names.join(' + ')} com sucesso!`,
      };
    }

    case 'remove_bi_set': {
      const exName = String(args.exerciseName || '').trim();
      if (!exName) return { success: false, state, message: 'Nome do exercício é obrigatório.' };

      const targetPlan = resolveTargetPlan(state.plans, args.planIdOrName, activeSession?.planId);

      if (!targetPlan) return { success: false, state, message: 'Nenhum plano encontrado.' };

      const outcome = applyPlanUpdate(targetPlan, {
        planIdOrName: targetPlan.id,
        supersetsToRemove: [exName],
      });

      if (!outcome.changed) {
        return { success: false, state, message: outcome.warnings[0] || 'Bi-set não encontrado ou já desfeito.' };
      }

      state = {
        ...state,
        plans: state.plans.map(p => p.id === targetPlan.id ? outcome.plan : p),
      };

      return {
        success: true,
        state,
        message: `Bi-set contendo "${exName}" desfeito com sucesso.`,
      };
    }

    case 'get_monthly_training_report': {
      const report = getMonthlyWorkoutReport(state.sessions, args.yearMonth);
      return {
        success: true,
        state,
        message: `Relatório de ${report.monthLabel}: ${report.totalSessions} treinos, ${report.totalSets} séries concluídas, ${report.totalVolume.toLocaleString('pt-BR')} kg de volume total. Cargas máximas registradas em ${report.exercises.length} exercícios.`,
        data: report,
      };
    }

    default:
      return { success: false, state, message: `Ferramenta desconhecida: "${toolName}".` };
  }
}
