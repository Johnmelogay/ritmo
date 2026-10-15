import { useMemo, useState } from 'react';
import { Activity, Dumbbell, TrendingUp } from 'lucide-react';
import { formatDate, number, type AppState } from './domain';
import { exerciseHistory, normalizeExercise } from './training';

export function TrainingDashboard({ state }: { state: AppState }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const history = useMemo(() => exerciseHistory(state.sessions), [state.sessions]);
  const filtered = history.filter(group => normalizeExercise(`${group.name} ${group.muscle}`).includes(normalizeExercise(search)));
  const current = filtered.find(group => group.key === selected) ?? filtered[0];
  const doneSessions = state.sessions.filter(s => s.finishedAt);
  const totalSets = history.reduce((sum, group) => sum + group.entries.reduce((total, entry) => total + entry.sets, 0), 0);
  const first = current?.entries[0];
  const latest = current?.entries.at(-1);
  const best = current ? Math.max(...current.entries.map(entry => entry.load)) : null;
  const chartEntries = current?.entries.slice(-8) ?? [];
  const chartMax = Math.max(1, ...chartEntries.map(entry => entry.load));
  return <section className="card training-dashboard">
    <div className="section-head"><div><span className="eyebrow">SEU PAINEL DE TREINO</span><h2>Seu esforço, em perspectiva</h2><p>Somente séries concluídas de sessões finalizadas entram nas estatísticas.</p></div><Activity size={22}/></div>
    <div className="training-kpis"><div><Dumbbell size={18}/><strong>{doneSessions.length}</strong><span>treinos registrados</span></div><div><strong>{totalSets}</strong><span>séries concluídas</span></div><div><strong>{history.length}</strong><span>exercícios acompanhados</span></div></div>
    <label>Buscar no seu histórico<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou grupo muscular…"/></label>
    {!current ? <p className="muted">{history.length ? 'Nenhum exercício corresponde à busca.' : 'Finalize seu primeiro treino para acompanhar cargas, repetições e evolução aqui. Gerencie os planos logo abaixo.'}</p> : <>
      <label>Exercício acompanhado<select value={current.key} onChange={event => setSelected(event.target.value)}>{filtered.map(group => <option value={group.key} key={group.key}>{group.name}</option>)}</select></label>
      <div className="exercise-insight"><TrendingUp size={20}/><div><h3>{current.name}</h3><p>{latest && first && current.entries.length > 1 ? `Carga da melhor série: ${number(first.load, 1)} → ${number(latest.load, 1)} kg. Compare também repetições e execução, não só o peso.` : 'Primeiro ponto registrado. Novas sessões vão construir sua tendência.'}</p><small>Maior carga registrada: {number(best ?? 0, 1)} kg · Origem: {[...current.origins].map(origin => origin === 'ia' ? 'IA' : origin === 'personal' ? 'Personal' : 'Você').join(', ')}</small></div></div>
      <div className="load-chart" role="img" aria-label={`Melhor carga por registro de ${current.name}: ${chartEntries.map(entry => `${formatDate(entry.date)}: ${entry.load} kg e ${entry.reps} repetições`).join('; ')}`}>
        {chartEntries.map((entry, index) => <div key={`${entry.sessionId}-${index}`}><strong>{number(entry.load, 1)}</strong><div className="load-column"><span style={{ height: `${entry.load / chartMax * 100}%` }}/></div><small>{formatDate(entry.date, { day: '2-digit', month: '2-digit' })}</small></div>)}
      </div>
      <div className="exercise-history-list">{[...chartEntries].reverse().map((entry, index) => <div key={`${entry.sessionId}-${index}`}><span>{formatDate(entry.date, { day: 'numeric', month: 'short' })}</span><strong>{number(entry.load, 1)} kg × {entry.reps}</strong><small>{entry.sets} séries · {number(entry.volume)} kg de volume</small></div>)}</div>
      <p className="small muted">Volume = soma de carga × repetições. Carga zero pode representar peso corporal. Equipamentos e variações diferentes não são diretamente comparáveis. A evolução em carga não mede hipertrofia.</p>
    </>}
    <p className="small muted">Para editar ou administrar os exercícios, use “Editar plano” nos cartões abaixo. A revisão por IA está em Hoje e Minha evolução.</p>
  </section>;
}
