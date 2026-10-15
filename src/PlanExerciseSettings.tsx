import { useState, type FormEvent } from 'react';
import { exerciseSchema, type Exercise } from './domain';

export function PlanExerciseSettings({ exercise, onSave, onCancel }: { exercise: Exercise; onSave: (value: Exercise) => void; onCancel: () => void }) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    try {
      const value = exerciseSchema.parse({ ...exercise, name, muscle: String(data.get('muscle')), sets: Number(data.get('sets')), reps: Number(data.get('reps')), load: Number(data.get('load') || 0), rest: Number(data.get('rest')), ...(name !== exercise.name ? { catalogId: undefined } : {}) });
      // Omit optional undefined values before storing in Firestore.
      if (value.catalogId === undefined) delete value.catalogId;
      onSave(value);
    } catch { setError('Confira os limites e preencha nome, séries e repetições.'); }
  }
  return <form className="duo-fields" onSubmit={submit}><h3>Ajustar exercício</h3><label>Nome do exercício<input name="name" defaultValue={exercise.name} maxLength={100} required/></label><label>Grupo muscular<input name="muscle" defaultValue={exercise.muscle} maxLength={80}/></label><div className="form-row">{[['sets', 'Séries', exercise.sets, 1, 15], ['reps', 'Repetições', exercise.reps, 1, 100], ['load', 'Carga (kg)', exercise.load || '', 0, 1000], ['rest', 'Descanso (s)', exercise.rest, 0, 1200]].map(([key, label, value, min, max]) => <label key={key}>{label}<input type="number" name={String(key)} inputMode={key === 'load' ? 'decimal' : 'numeric'} min={min} max={max} step={key === 'load' ? 'any' : 1} placeholder="0" defaultValue={value} required={key !== 'load'} onFocus={event => event.currentTarget.select()}/></label>)}</div>{exercise.supersetId && <p className="small muted">A alteração de séries e descanso também será aplicada ao outro exercício desta dupla. As cargas e repetições continuam individuais.</p>}{error && <p role="alert">{error}</p>}<div className="button-row"><button className="button secondary" type="button" onClick={onCancel}>Cancelar ajuste</button><button className="button primary" type="submit">Aplicar ajuste</button></div></form>;
}
