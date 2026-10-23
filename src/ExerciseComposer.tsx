import { useId, useMemo, useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { exerciseSchema, uid, type Exercise, type Origin } from './domain';
import { curatedExercises, type DbExercise } from './workoutDb';
import { normalizeExercise } from './training';

export function ExerciseChoice({ label, name, setName, onPick }: { label: string; name: string; setName: (value: string) => void; onPick: (ex: DbExercise) => void }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const query = normalizeExercise(name);
    return curatedExercises.filter(ex => normalizeExercise(`${ex.name} ${ex.muscle} ${ex.equipment}`).includes(query)).slice(0, 8);
  }, [name]);
  return <div className="exercise-choice"><label>{label}<div className="exercise-search"><Search size={18}/><input value={name} maxLength={100} required placeholder="Buscar exercício ou digitar o seu…"
    role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
    onFocus={() => setOpen(true)} onChange={event => { setName(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}/></div></label>
    {open && <div id={listId} className="exercise-results" role="listbox" aria-label={`Catálogo: ${label}`}>
      {matches.map(ex => <button role="option" aria-selected={name === ex.name} type="button" key={ex.id} onClick={() => { onPick(ex); setOpen(false); }}><strong>{ex.name}</strong><small>{ex.muscle} · {ex.equipment}</small></button>)}
      {!matches.length && <p>Sem resultado. Você pode usar o nome digitado.</p>}
      <button type="button" onClick={() => setOpen(false)}>Usar nome digitado / fechar catálogo</button>
    </div>}
  </div>;
}

export function ExerciseComposer({ onAdd, onAddMany, onCancel, defaultOrigin = 'usuario' }: { onAdd: (ex: Exercise) => void; onAddMany?: (exercises: Exercise[]) => void; onCancel?: () => void; defaultOrigin?: Origin }) {
  const [name, setName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [picked, setPicked] = useState<DbExercise>();
  const [second, setSecond] = useState<DbExercise>();
  const [muscle, setMuscle] = useState('Geral');
  const [duo, setDuo] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  function pick(ex: DbExercise) { setPicked(ex); setName(ex.name); setMuscle(ex.muscle); setRevision(v => v + 1); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    const supersetId = duo ? uid() : undefined;
    const numeric = (key: string) => Number(String(data.get(key) ?? '').replace(',', '.') || 0);
    const base = { sets: numeric('sets'), reps: numeric('reps'), load: numeric('load'), rest: numeric('rest'), origin: String(data.get('origin')) as Origin, ...(supersetId ? { supersetId } : {}) };
    const make = (exerciseName: string, selected?: DbExercise, companion = false) => exerciseSchema.parse({ ...base, id: uid(), name: exerciseName.trim(), muscle: companion ? selected?.muscle ?? 'Geral' : muscle, ...(selected && selected.name === exerciseName ? { catalogId: selected.id } : {}), ...(companion ? { load: numeric('secondLoad'), reps: numeric('secondReps') } : {}) });
    try {
      if (duo && normalizeExercise(name) === normalizeExercise(secondName)) throw new Error('Escolha dois exercícios diferentes.');
      const exercises = [make(name, picked), ...(duo ? [make(secondName, second, true)] : [])];
      if (onAddMany) onAddMany(exercises); else if (exercises.length === 1) onAdd(exercises[0]); else throw new Error('Este editor não suporta duplas.');
      setName(''); setSecondName(''); setPicked(undefined); setSecond(undefined); setDuo(false); setRevision(v => v + 1);
    } catch { setError('Revise os campos: nomes diferentes, 1–15 séries, 1–100 repetições, carga 0–1000 kg e descanso 0–1200 s.'); }
  }
  return <form className="exercise-form" onSubmit={submit}>
    <ExerciseChoice label="Exercício" name={name} setName={value => { setName(value); setPicked(undefined); }} onPick={pick}/>
    <p className="small muted">{curatedExercises.length} exercícios no catálogo local · disponível offline. Nomes personalizados também são aceitos.</p>
    <div className="form-row"><label>Grupo muscular<input value={muscle} maxLength={80} onChange={event => setMuscle(event.target.value)}/></label><label>Origem<select name="origin" key={defaultOrigin} defaultValue={defaultOrigin}><option value="usuario">Você</option><option value="personal">Personal</option></select></label></div>
    <div className="form-row" key={revision}>{[
      ['sets', 'Séries', picked?.defaultSets ?? 3, 1, 15], ['reps', 'Repetições', picked?.defaultReps ?? 12, 1, 100],
      ['load', 'Carga (kg)', '', 0, 1000], ['rest', 'Descanso após a série/dupla (s)', picked?.defaultRest ?? 90, 0, 1200],
    ].map(([key, label, initial, min, max]) => <label key={key}>{label}<input name={String(key)} type="number" inputMode={key === 'load' ? 'decimal' : 'numeric'} placeholder="0" min={min} max={max} step={key === 'load' ? 'any' : 1} defaultValue={initial} required={key !== 'load'} onFocus={event => event.currentTarget.select()}/></label>)}</div>
    {onAddMany && <label className="duo-toggle"><input type="checkbox" checked={duo} onChange={event => setDuo(event.target.checked)}/><span><strong>Exercício duplo (bi-set)</strong><small>Dois exercícios seguidos. Descanso somente após completar ambos.</small></span></label>}
    {duo && <div className="duo-fields"><ExerciseChoice label="Segundo exercício da dupla" name={secondName} setName={value => { setSecondName(value); setSecond(undefined); }} onPick={ex => { setSecond(ex); setSecondName(ex.name); }}/><div className="form-row"><label>Repetições do segundo<input name="secondReps" type="number" inputMode="numeric" min={1} max={100} defaultValue={12} required onFocus={event => event.currentTarget.select()}/></label><label>Carga do segundo (kg)<input name="secondLoad" type="number" inputMode="decimal" min={0} max={1000} step="any" placeholder="0" onFocus={event => event.currentTarget.select()}/></label></div><p className="small muted">Cada exercício terá cargas e repetições próprias no histórico. A quantidade de séries e o descanso são compartilhados.</p></div>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="button-row">{onCancel && <button type="button" className="button secondary" onClick={onCancel}>Cancelar</button>}<button className="button primary" type="submit"><Plus size={17}/>{duo ? 'Adicionar dupla' : 'Adicionar exercício'}</button></div>
  </form>;
}
