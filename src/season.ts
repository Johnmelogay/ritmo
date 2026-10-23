import { dailyTotals, dateFrom, shiftDate, type AppState, type Season } from './domain';
import { sortedBody } from './bioimpedance';

export const daysBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

export interface SeasonMetric {
  pct: number;
  label: string;
  detail: string;
}

export interface SeasonProgress {
  season: Season;
  day: number;
  total: number;
  remaining: number;
  ended: boolean;
  notStarted: boolean;
  timePct: number;
  endDate: string;
  training: SeasonMetric & { done: number; expected: number; target: number };
  weight: SeasonMetric & { start: number | null; current: number | null; target: number | null; available: boolean };
  nutrition: SeasonMetric & { reviewed: number; logged: number; considered: number };
  insight: string;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/** Default weekly workouts = how many distinct weekdays the plans cover (fallback 3). */
export function defaultWorkoutsPerWeek(state: AppState) {
  const days = new Set(state.plans.flatMap(p => p.days));
  return days.size || 3;
}

export function seasonProgress(state: AppState, today: string): SeasonProgress | null {
  const season = state.profile.season;
  if (!season) return null;
  const endDate = shiftDate(season.startDate, season.days - 1);
  const offset = daysBetween(season.startDate, today);
  const notStarted = offset < 0;
  const ended = today > endDate;
  const day = clamp(offset + 1, notStarted ? 0 : 1, season.days);
  const remaining = Math.max(0, season.days - day);
  const lastDay = ended ? endDate : today;
  const elapsedDays = Math.max(0, daysBetween(season.startDate, lastDay) + 1);
  const inSeason = (d: string) => d >= season.startDate && d <= lastDay;

  // Training: finished sessions vs. expected pace
  const perWeek = season.workoutsPerWeek ?? defaultWorkoutsPerWeek(state);
  const done = state.sessions.filter(s => s.finishedAt && inSeason(s.date)).length;
  const expected = Math.max(1, Math.round(perWeek * elapsedDays / 7));
  const target = Math.max(1, Math.round(perWeek * season.days / 7));
  const trainingPct = notStarted ? 0 : clamp(done / target * 100);

  // Weight: progress from start weight towards target
  const weights = sortedBody(state.body).filter(b => typeof b.weight === 'number' && b.weight > 0 && b.date <= lastDay);
  const startWeight = season.startWeight
    ?? weights.filter(w => w.date <= season.startDate).at(-1)?.weight
    ?? weights.find(w => w.date >= season.startDate)?.weight
    ?? null;
  const currentWeight = weights.filter(w => w.date >= season.startDate).at(-1)?.weight ?? null;
  const targetWeight = season.targetWeight === undefined ? state.profile.targetWeight : season.targetWeight;
  const weightAvailable = !notStarted && startWeight != null && currentWeight != null && targetWeight != null && Math.abs(startWeight-targetWeight)>=0.05;
  let weightPct = 0;
  if (weightAvailable && startWeight != null && currentWeight != null && targetWeight != null) {
    const span = startWeight - targetWeight;
    weightPct = Math.abs(span) < 0.05 ? (Math.abs(currentWeight - targetWeight) < 0.5 ? 100 : 0) : clamp((startWeight - currentWeight) / span * 100);
  }

  // This bar describes logging coverage, not a claim about dietary adherence.
  let reviewed = 0, logged = 0, considered = 0;
  for (let i = 0; i < elapsedDays; i++) {
    const d = shiftDate(season.startDate, i);
    const hasMeals = state.meals.some(m => m.date === d);
    considered++;
    if (!hasMeals) continue;
    logged++;
    if (state.reviewed.includes(d)) reviewed++;
  }
  const nutritionPct = considered ? clamp(logged / considered * 100) : 0;

  let insight: string;
  if (notStarted) insight = `Começa em ${Math.abs(offset)} dia${Math.abs(offset) === 1 ? '' : 's'}. Prepare seus planos e metas.`;
  else if (ended) insight = `Ciclo encerrado: ${done} sessões e ${logged} dias com refeições registradas. Revise o contexto antes de definir o próximo.`;
  else if (!done && !logged) insight = 'Seu ciclo já começou. Registre uma refeição ou um treino para construir seu acompanhamento.';
  else insight = `${done} sessões concluídas e ${logged} dias com refeições no ciclo. Registros parciais não contam a história inteira; cada novo log atualiza este resumo.`;

  return {
    season, day, total: season.days, remaining, ended, notStarted, endDate,
    timePct: clamp(day / season.days * 100),
    training: { pct: trainingPct, done, expected, target, label: 'Treino', detail: `${done} de ${target} sessões planejadas no ciclo` },
    weight: {
      pct: weightPct, start: startWeight, current: currentWeight, target: targetWeight, available: weightAvailable, label: 'Peso',
      detail: currentWeight == null ? 'Sem pesagem neste ciclo' : `${currentWeight.toLocaleString('pt-BR')} kg${targetWeight==null?' · sem meta de peso':` · referência ${targetWeight.toLocaleString('pt-BR')} kg`}`,
    },
    nutrition: { pct: nutritionPct, reviewed, logged, considered, label: 'Nutrição', detail: `${logged} de ${considered} dias com refeições · ${reviewed} revisados` },
    insight,
  };
}
