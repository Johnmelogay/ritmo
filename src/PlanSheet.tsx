import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Download, Pencil, Play } from 'lucide-react';
import { Badge } from './components';
import { download, formatDate, number, today, type Exercise, type Plan, type Session } from './domain';
import type { DiffIndex, ExerciseField } from './planDiff';
import { editPlanCell, exportPlansSheet, parseCell, setSupersetPartner, type EditableField, type LoadHistory } from './planSheet';
import { normalizeExercise } from './training';

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Letter per bi-set group so paired rows are easy to spot (A, B, C…). */
function supersetLetters(exercises: Exercise[]) {
  const letters = new Map<string, string>();
  for (const ex of exercises) if (ex.supersetId && !letters.has(ex.supersetId)) letters.set(ex.supersetId, String.fromCharCode(65 + letters.size));
  return letters;
}

function Diff({ change, children }: { change?: { before: string }; children: ReactNode }) {
  if (!change) return <>{children}</>;
  return <span className="sheet-diff"><del>{change.before}</del><ins>{children}</ins></span>;
}

function NumberCell({ value, field, suffix, disabled, label, onCommit }: { value: number; field: EditableField; suffix?: string; disabled: boolean; label: string; onCommit: (value: number) => void }) {
  const [invalid, setInvalid] = useState(false);
  const commit = (input: HTMLInputElement) => {
    const parsed = parseCell(field, input.value);
    if (parsed === null) { setInvalid(true); input.value = String(value); window.setTimeout(() => setInvalid(false), 1600); return; }
    setInvalid(false);
    if (parsed !== value) onCommit(parsed);
  };
  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') { event.currentTarget.value = String(value); event.currentTarget.blur(); }
  };
  return <span className={`sheet-input ${invalid ? 'invalid' : ''}`}>
    <input key={value} aria-label={label} inputMode={field === 'load' ? 'decimal' : 'numeric'} defaultValue={String(value)} disabled={disabled} onBlur={event => commit(event.currentTarget)} onKeyDown={keydown} onFocus={event => event.currentTarget.select()} />
    {suffix && <small>{suffix}</small>}
  </span>;
}

export function PlanSheet({ plan, allSessions, removed, diff, focusId, history, readOnly, onChange, onStart, onEdit }: {
  plan: Plan; allSessions?: Session[]; removed: Exercise[]; diff: DiffIndex; focusId?: string; history: { get: (ex: Pick<Exercise, 'name' | 'catalogId'>) => LoadHistory }; readOnly: boolean;
  onChange: (plan: Plan) => void; onStart: () => void; onEdit: () => void;
}) {
  const letters = supersetLetters(plan.exercises);
  const planDiff = diff.plan(plan.id);
  const field = (ex: Exercise, key: ExerciseField) => diff.field(plan.id, ex.id, key);
  const days = [...plan.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => dayNames[d]).join(' · ') || 'Sem dia definido';
  const planFocusId = `plan-${plan.id}`;
  return <section className={`card plan-sheet ${planDiff ? 'ai-touched' : ''} ${focusId === planFocusId ? 'ai-focus' : ''}`} data-change={planFocusId}>
    <header className="plan-sheet-head">
      <div>
        <div className="plan-sheet-meta"><Badge origin={plan.origin} /><small>Versão {plan.version}</small><small>{days}</small></div>
        <h3>{plan.name}</h3>
        <p>{plan.exercises.length} exercícios · {plan.exercises.reduce((sum, ex) => sum + ex.sets, 0)} séries{readOnly ? ' · prévia da IA, edição bloqueada' : ' · clique em um número para editar'}</p>
      </div>
      <div className="plan-sheet-actions">
        <button className="button secondary" title="Exportar este plano em CSV" onClick={() => download(`ritmo-plano-${normalizeExercise(plan.name).replace(/\s+/g, '-')}-${today()}.csv`, exportPlansSheet({ plans: [plan], sessions: allSessions ?? [] }, plan.id), 'text/csv;charset=utf-8')}><Download size={16} />CSV</button>
        <button className="button secondary" disabled={readOnly} onClick={onEdit}><Pencil size={16} />Editar</button>
        <button className="button primary" disabled={readOnly} onClick={onStart}><Play size={16} />Iniciar</button>
      </div>
    </header>
    <div className="plan-sheet-scroll">
      <table className="plan-sheet-table">
        <thead><tr>
          <th scope="col">#</th><th scope="col">Exercício</th><th scope="col">Grupo</th><th scope="col">Bi-set</th>
          <th scope="col" className="num">Séries</th><th scope="col" className="num">Reps</th><th scope="col" className="num">Carga plano</th>
          <th scope="col" className="num">Carga inicial</th><th scope="col" className="num">Última carga</th><th scope="col" className="num">Descanso</th><th scope="col">Obs.</th>
        </tr></thead>
        <tbody>
          {plan.exercises.map((ex, index) => {
            const exDiff = diff.exercise(plan.id, ex.id);
            const rowId = `ex-${plan.id}-${ex.id}`;
            const past = history.get(ex);
            const letter = ex.supersetId ? letters.get(ex.supersetId) : undefined;
            const partnerId = ex.supersetId ? plan.exercises.find(other => other.id !== ex.id && other.supersetId === ex.supersetId)?.id ?? '' : '';
            const cell = (key: EditableField, suffix?: string) => <td className={`num ${field(ex, key) ? 'changed' : ''}`}>
              {readOnly ? <Diff change={field(ex, key)}>{key === 'load' ? number(ex[key], 1) : ex[key]}{suffix ? ` ${suffix}` : ''}</Diff>
                : <NumberCell value={ex[key]} field={key} suffix={suffix} disabled={readOnly} label={`${key} de ${ex.name}`} onCommit={value => onChange(editPlanCell(plan, ex.id, key, value))} />}
            </td>;
            return <tr key={ex.id} data-change={rowId} className={`${exDiff ? `row-${exDiff.status}` : ''} ${focusId === rowId ? 'ai-focus' : ''} ${letter ? 'in-superset' : ''}`}>
              <td className="muted">{field(ex, 'order') ? <Diff change={field(ex, 'order')}>{index + 1}º</Diff> : index + 1}</td>
              <td className={`sheet-name ${field(ex, 'name') ? 'changed' : ''}`}><Diff change={field(ex, 'name')}>{ex.name}</Diff>{exDiff?.status === 'added' && <em className="sheet-tag">novo</em>}</td>
              <td className={field(ex, 'muscle') ? 'changed' : ''}><Diff change={field(ex, 'muscle')}>{ex.muscle}</Diff></td>
              <td className={field(ex, 'superset') ? 'changed' : ''}>
                {readOnly ? <Diff change={field(ex, 'superset')}>{letter ? <span className="superset-chip">{letter}</span> : '—'}</Diff>
                  : <span className="sheet-superset">{letter && <span className="superset-chip">{letter}</span>}<select aria-label={`Bi-set de ${ex.name}`} value={partnerId} onChange={event => onChange(setSupersetPartner(plan, ex.id, event.target.value))}>
                    <option value="">Não</option>
                    {plan.exercises.filter(other => other.id !== ex.id).map(other => <option key={other.id} value={other.id}>com {other.name}</option>)}
                  </select></span>}
              </td>
              {cell('sets')}
              {cell('reps')}
              {cell('load', 'kg')}
              <td className="num muted" title={past.initial ? `Primeiro registro em ${formatDate(past.initial.date)}` : 'Sem registros ainda'}>{past.initial ? `${number(past.initial.load, 1)} kg` : '—'}</td>
              <td className="num" title={past.last ? `${past.last.reps} reps em ${formatDate(past.last.date)}` : 'Sem registros ainda'}>{past.last ? <><strong>{number(past.last.load, 1)} kg</strong><small className="sheet-sub">{past.last.reps} reps · {formatDate(past.last.date, { day: 'numeric', month: 'short' })}</small></> : '—'}</td>
              {cell('rest', 's')}
              <td className={`sheet-notes ${field(ex, 'notes') ? 'changed' : ''}`}><Diff change={field(ex, 'notes')}>{ex.notes?.trim() || '—'}</Diff></td>
            </tr>;
          })}
          {removed.map(ex => { const rowId = `ex-${plan.id}-${ex.id}`; return <tr key={ex.id} data-change={rowId} className={`row-removed ${focusId === rowId ? 'ai-focus' : ''}`}>
            <td className="muted">—</td><td className="sheet-name"><del>{ex.name}</del><em className="sheet-tag">removido</em></td><td>{ex.muscle}</td><td>—</td>
            <td className="num">{ex.sets}</td><td className="num">{ex.reps}</td><td className="num">{number(ex.load, 1)} kg</td><td className="num">—</td><td className="num">—</td><td className="num">{ex.rest} s</td><td>—</td>
          </tr>; })}
        </tbody>
      </table>
    </div>
  </section>;
}
