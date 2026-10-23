import { useMemo, useState } from 'react';
import { Activity, Calendar, Download, Dumbbell, RefreshCw, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { csv, download, formatDate, number, type AppState } from './domain';
import { exerciseHistory, getMonthlyWorkoutReport, normalizeExercise, sessionAdaptations } from './training';

export function TrainingDashboard({ state }: { state: AppState }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const history = useMemo(() => exerciseHistory(state.sessions), [state.sessions]);
  const adaptations = useMemo(() => sessionAdaptations(state.sessions), [state.sessions]);
  const filtered = history.filter(group => normalizeExercise(`${group.name} ${group.muscle}`).includes(normalizeExercise(search)));
  const current = filtered.find(group => group.key === selected) ?? filtered[0];
  const doneSessions = state.sessions.filter(s => s.finishedAt);
  const totalSets = history.reduce((sum, group) => sum + group.entries.reduce((total, entry) => total + entry.sets, 0), 0);
  const first = current?.entries[0];
  const latest = current?.entries.at(-1);
  const best = current ? Math.max(...current.entries.map(entry => entry.load)) : null;
  const chartEntries = current?.entries.slice(-8) ?? [];
  const chartMax = Math.max(1, ...chartEntries.map(entry => entry.load));

  // Extract available months from finished sessions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthKey);
    state.sessions.filter(s => s.finishedAt).forEach(s => {
      if (s.date && s.date.length >= 7) set.add(s.date.slice(0, 7));
    });
    return [...set].sort().reverse();
  }, [state.sessions, currentMonthKey]);

  const monthlyReport = useMemo(() => {
    return getMonthlyWorkoutReport(state.sessions, selectedMonth);
  }, [state.sessions, selectedMonth]);

  function exportMonthlyCsv() {
    const rows: (string | number | boolean | null)[][] = [
      ['mes', 'exercicio', 'grupo_muscular', 'carga_maxima_kg', 'ultima_carga_kg', 'ultimas_reps', 'series_no_mes', 'volume_total_kg'],
      ...monthlyReport.exercises.map(ex => [
        monthlyReport.yearMonth,
        ex.name,
        ex.muscle,
        ex.bestLoad,
        ex.lastLoad,
        ex.lastReps,
        ex.totalSets,
        ex.totalVolume
      ])
    ];
    download(`ritmo-relatorio-mensal-${monthlyReport.yearMonth}.csv`, csv(rows), 'text/csv;charset=utf-8');
  }

  return <section className="card training-dashboard">
    <div className="section-head"><div><span className="eyebrow">SEU PAINEL DE TREINO</span><h2>Seu esforço, em perspectiva</h2><p>Somente séries concluídas de sessões finalizadas entram nas estatísticas.</p></div><Activity size={22}/></div>
    <div className="training-kpis"><div><Dumbbell size={18}/><strong>{doneSessions.length}</strong><span>treinos registrados</span></div><div><strong>{totalSets}</strong><span>séries concluídas</span></div><div><strong>{history.length}</strong><span>exercícios acompanhados</span></div></div>
    
    {/* --- RELATÓRIO MENSAL E PESOS CONSOLIDADOS --- */}
    <div className="monthly-report-card">
      <div className="monthly-report-header">
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={13} /> RELATÓRIO DO MÊS
          </span>
          <h3 style={{ fontSize: 18, marginTop: 4 }}>Fechamento Mensal · {monthlyReport.monthLabel}</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            Pesos consolidados que você já aguenta e volume executado para planejar seu próximo ciclo.
          </p>
        </div>
        <div className="monthly-report-controls">
          <select
            className="month-selector-dropdown"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            aria-label="Selecionar mês do relatório"
          >
            {availableMonths.map(m => {
              const [y, mo] = m.split('-');
              const d = new Date(Number(y), Number(mo) - 1, 15);
              const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
            })}
          </select>
          {monthlyReport.exercises.length > 0 && (
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: 12, padding: '7px 12px', minHeight: 36 }}
              onClick={exportMonthlyCsv}
              title="Baixar planilha deste mês em CSV"
            >
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>

      <div className="monthly-stats-strip">
        <div className="stat-pill">
          <strong>{monthlyReport.totalSessions}</strong>
          <span>treinos feitos</span>
        </div>
        <div className="stat-pill">
          <strong>{monthlyReport.totalSets}</strong>
          <span>séries concluídas</span>
        </div>
        <div className="stat-pill highlight">
          <strong>{number(monthlyReport.totalVolume)} kg</strong>
          <span>volume total</span>
        </div>
        <div className="stat-pill">
          <strong>{monthlyReport.exercises.length}</strong>
          <span>exercícios ativos</span>
        </div>
      </div>

      {monthlyReport.exercises.length > 0 ? (
        <div className="monthly-exercises-table-wrapper">
          <table className="monthly-exercises-table">
            <thead>
              <tr>
                <th>Exercício</th>
                <th>Carga Máxima</th>
                <th>Último Peso</th>
                <th>Séries</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {monthlyReport.exercises.map(ex => (
                <tr key={ex.key}>
                  <td>
                    <strong>{ex.name}</strong>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>{ex.muscle}</span>
                  </td>
                  <td>
                    <span className="trophy-tag">
                      <Trophy size={11} /> {number(ex.bestLoad, 1)} kg
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {number(ex.lastLoad, 1)} kg <small className="muted">× {ex.lastReps}</small>
                    </span>
                  </td>
                  <td>{ex.totalSets}</td>
                  <td><strong>{number(ex.totalVolume)} kg</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="monthly-empty-note">
          <p className="muted">Nenhum treino concluído em {monthlyReport.monthLabel}. Finalize suas sessões para registrar seus pesos.</p>
        </div>
      )}
    </div>

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

    {adaptations.length > 0 && (
      <div className="adaptations-summary-card">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <div>
            <span className="eyebrow">RELATÓRIO DE VARIAÇÕES</span>
            <h3 style={{ fontSize: 16 }}>Variações e adaptações nos treinos ({adaptations.length})</h3>
            <p>Exercícios substituídos durante as sessões e motivos registrados para o acompanhamento do mês.</p>
          </div>
          <RefreshCw size={18} style={{ color: '#285b49' }} />
        </div>
        <div className="adaptations-list">
          {adaptations.map((item, idx) => (
            <div key={`${item.sessionId}-${idx}`} className="adaptation-item">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong>{item.newName}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>({item.muscle})</span>
                </div>
                <p style={{ margin: '3px 0', fontSize: 11, color: '#576755' }}>
                  Substituiu <s>{item.originalName}</s> · {formatDate(item.date, { day: 'numeric', month: 'short' })} em <em>{item.sessionName}</em>
                </p>
                <span style={{ display: 'inline-block', background: '#f5efe0', color: '#7a5a1e', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500 }}>
                  Motivo: {item.reason}
                </span>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 80 }}>
                <strong style={{ display: 'block', fontSize: 13, color: '#285b49' }}>{number(item.maxLoad, 1)} kg</strong>
                <small className="muted">{item.sets} séries feitas</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    <p className="small muted" style={{ marginTop: 14 }}>Para editar ou administrar os exercícios, use “Editar plano” nos cartões abaixo. A revisão por IA está em Hoje e Minha evolução.</p>
  </section>;
}


