import { ProfessionalTimer, SessionClock } from './ProfessionalTimer';
import { memo, useEffect, useState } from 'react';
import { Check, Clock3, Plus, X } from 'lucide-react';
import { Badge } from './components';
import { completedSets, type Session } from './domain';
import { TrainingNumber } from './TrainingNumber';
import { shouldStartRest } from './training';

export type SessionPatch = (change: (session: Session) => Session) => void;

const ExerciseCard = memo(function ExerciseCard({ exercise: ex, index, onPatch, round }: { exercise: Session['exercises'][number]; index: number; onPatch: SessionPatch; round?: number }) {
  return <section className={`card session-exercise ${ex.supersetId ? 'is-superset' : ''} ${round !== undefined ? 'compact-round' : ''}`}>
    <div className="exercise-heading"><span className="exercise-index">{String(index + 1).padStart(2, '0')}</span><div><h3>{ex.name}</h3><p>{ex.muscle} · {ex.rest}s {ex.supersetId ? 'após a dupla' : 'de descanso'}</p>{ex.supersetId && <span className="duo-label">Bi-set · complete os dois antes de descansar</span>}</div><Badge origin={ex.origin}/></div>
    <div className="sets-table"><div className="set-head"><span>Série</span><span>kg</span><span>Reps</span><span>RIR</span><span>Feita</span></div>
      {ex.logs.map((log, logIndex) => round !== undefined && round !== logIndex ? null : <div key={log.id} className={`set-row ${log.done ? 'completed' : ''}`}><strong>{logIndex + 1}</strong>
        {(['load', 'reps', 'rir'] as const).map(field => <TrainingNumber key={field} value={log[field]} max={field === 'load' ? 1000 : field === 'rir' ? 10 : 200} integer={field !== 'load'} label={`${ex.name}, série ${logIndex + 1}, ${field === 'load' ? 'carga' : field === 'reps' ? 'repetições' : 'RIR'}`} onCommit={value => onPatch(session => ({ ...session, exercises: session.exercises.map(item => item.id !== ex.id ? item : { ...item, logs: item.logs.map(row => row.id !== log.id ? row : { ...row, [field]: value }) }) }))}/>)}
        <button className={`set-check ${log.done ? 'checked' : ''}`} aria-pressed={log.done} aria-label={`${log.done ? 'Desmarcar' : 'Concluir'} série ${logIndex + 1} de ${ex.name}`} onClick={() => onPatch(session => {
          const current = session.exercises.find(item => item.id === ex.id)?.logs.find(row => row.id === log.id);
          if (!current || !current.done && current.reps === 0) return session;
          const start = !current.done && shouldStartRest(session, ex.id, logIndex);
          return { ...session, restEnd: start ? Date.now() + ex.rest * 1000 : session.restEnd, ...(start ? {restPausedSeconds:null,restDuration:ex.rest} : {}), exercises: session.exercises.map(item => item.id !== ex.id ? item : { ...item, logs: item.logs.map(row => row.id !== log.id ? row : { ...row, done: !row.done }) }) };
        })}><Check size={20}/></button>
      </div>)}
    </div>
    <p className="small muted">Campos vazios representam zero. Toque no ✓ para concluir. RIR = repetições que ainda conseguiria fazer.</p>
  </section>;
});

function SupersetBlock({ exercises, index, onPatch }: { exercises: Session['exercises']; index: number; onPatch: SessionPatch }) {
  const [manualRound, setManualRound] = useState<number | null>(null);
  const rounds = Math.max(...exercises.map(ex => ex.logs.length));
  const firstIncomplete = Array.from({ length: rounds }, (_, round) => round).find(round => exercises.some(ex => ex.logs[round] && !ex.logs[round].done));
  const currentRound = manualRound ?? firstIncomplete ?? rounds - 1;
  return <section className="superset-block"><div className="superset-title"><div><span className="eyebrow">EXERCÍCIO DUPLO</span><h3>Rodada {currentRound + 1} de {rounds}</h3></div><span>Faça os dois; depois descanse.</span></div>
    <div className="round-tabs" aria-label="Rodadas da dupla">{Array.from({ length: rounds }, (_, round) => <button key={round} className={currentRound === round ? 'selected' : ''} aria-label={`Ver rodada ${round + 1} da dupla`} aria-pressed={currentRound === round} onClick={() => setManualRound(round)}>{exercises.every(ex => !ex.logs[round] || ex.logs[round].done) ? <Check size={16}/> : round + 1}</button>)}<button onClick={() => setManualRound(null)}>Próxima pendente</button></div>
    {exercises.map((ex, offset) => ex.logs[currentRound] && <ExerciseCard key={ex.id} exercise={ex} index={index + offset} round={currentRound} onPatch={onPatch}/>)}
  </section>;
}

export function TrainingSession({ session, onPatch, onFinish, onAdd, onDiscard }: { session: Session; onPatch: SessionPatch; onFinish: () => void; onAdd: () => void; onDiscard: () => void }) {
  const completed = completedSets(session);
  const total = session.exercises.reduce((sum, ex) => sum + ex.logs.length, 0);
  const renderedGroups = new Set<string>();
  return <><div className="active-header"><div><span className="eyebrow">SESSÃO EM ANDAMENTO</span><h2>{session.name}</h2><SessionClock startedAt={session.startedAt}/><p>{completed}/{total} séries concluídas · salvas ao confirmar cada campo</p></div><button className="button primary" onClick={onFinish}><Check size={18}/>Finalizar treino</button></div>
    <div className="training-progress" role="progressbar" aria-label="Séries concluídas" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}><span style={{ width: `${total ? completed / total * 100 : 0}%` }}/></div>
    <ProfessionalTimer session={session} onPatch={onPatch}/><div className="session-exercises">{session.exercises.map((ex, index) => {
      if (!ex.supersetId) return <ExerciseCard key={ex.id} exercise={ex} index={index} onPatch={onPatch}/>;
      if (renderedGroups.has(ex.supersetId)) return null;
      renderedGroups.add(ex.supersetId);
      return <SupersetBlock key={ex.supersetId} exercises={session.exercises.filter(item => item.supersetId === ex.supersetId)} index={index} onPatch={onPatch}/>;
    })}</div>
    <div className="toolbar"><button className="button secondary" onClick={onAdd}><Plus size={18}/>Adicionar exercício ou dupla</button><button className="text-button danger" onClick={onDiscard}>Descartar sessão</button></div></>;
}
