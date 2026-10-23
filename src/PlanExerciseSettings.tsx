import { useState, type FormEvent } from 'react';
import { exerciseSchema, type Exercise } from './domain';
import { applyExerciseSettings, type BiSetSettingsAction } from './planEdits';
import { ExerciseChoice } from './ExerciseComposer';
import { type DbExercise } from './workoutDb';
import { normalizeExercise } from './training';
import { Layers, Link2, Plus, Unlink } from 'lucide-react';

export function PlanExerciseSettings({
  exercise,
  planExercises = [],
  onSave,
  onCancel,
}: {
  exercise: Exercise;
  planExercises?: Exercise[];
  onSave: (updatedExercises: Exercise[]) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  const [sets, setSets] = useState(exercise.sets);
  const [rest, setRest] = useState(exercise.rest);

  // Identify if exercise is currently paired
  const currentPartner = exercise.supersetId
    ? planExercises.find(e => e.supersetId === exercise.supersetId && e.id !== exercise.id)
    : undefined;

  // Options for an existing bi-set
  const [existingAction, setExistingAction] = useState<'keep' | 'unpair' | 'change'>('keep');

  // Options for creating a bi-set (or changing partner)
  const otherExercises = planExercises.filter(e => e.id !== exercise.id);
  const unlinkedOthers = otherExercises.filter(e => !e.supersetId);

  const [wantsBiSet, setWantsBiSet] = useState(false);
  const [biSetMode, setBiSetMode] = useState<'existing' | 'new'>(
    otherExercises.length > 0 ? 'existing' : 'new'
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    unlinkedOthers[0]?.id ?? otherExercises[0]?.id ?? ''
  );

  // New partner inputs
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPicked, setNewPartnerPicked] = useState<DbExercise>();
  const [newPartnerMuscle, setNewPartnerMuscle] = useState(exercise.muscle || 'Geral');
  const [newPartnerReps, setNewPartnerReps] = useState<number>(exercise.reps || 12);
  const [newPartnerLoad, setNewPartnerLoad] = useState<string>('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const muscle = String(data.get('muscle') ?? '').trim();
    const currentSets = Number(data.get('sets'));
    const reps = Number(data.get('reps'));
    const load = Number(data.get('load') || 0);
    const currentRest = Number(data.get('rest'));

    if (!name) {
      setError('Informe o nome do exercício.');
      return;
    }

    let updatedExercise: Exercise;
    try {
      updatedExercise = exerciseSchema.parse({
        ...exercise,
        name,
        muscle,
        sets: currentSets,
        reps,
        load,
        rest: currentRest,
        ...(name !== exercise.name ? { catalogId: undefined } : {}),
      });
      if (updatedExercise.catalogId === undefined) delete updatedExercise.catalogId;
    } catch {
      setError('Confira os limites: 1–15 séries, 1–100 repetições, carga 0–1000 kg e descanso 0–1200 s.');
      return;
    }

    let action: BiSetSettingsAction = { type: 'none' };

    if (currentPartner) {
      if (existingAction === 'unpair') {
        action = { type: 'unpair' };
      } else if (existingAction === 'change') {
        if (biSetMode === 'existing') {
          if (!selectedPartnerId) {
            setError('Selecione um exercício do treino para formar a dupla.');
            return;
          }
          action = { type: 'pair_existing', partnerId: selectedPartnerId };
        } else {
          const pName = newPartnerName.trim();
          if (!pName) {
            setError('Digite o nome do novo exercício para a dupla.');
            return;
          }
          if (normalizeExercise(pName) === normalizeExercise(name)) {
            setError('Escolha um exercício diferente do atual para a dupla.');
            return;
          }
          action = {
            type: 'create_new',
            partner: {
              name: pName,
              muscle: newPartnerMuscle.trim() || muscle || 'Geral',
              reps: Number(newPartnerReps) || 12,
              load: Number(newPartnerLoad) || 0,
              catalogId: newPartnerPicked?.name === pName ? newPartnerPicked.id : undefined,
            },
          };
        }
      }
    } else if (wantsBiSet) {
      if (biSetMode === 'existing') {
        if (!selectedPartnerId) {
          setError('Selecione um exercício do treino para formar a dupla.');
          return;
        }
        action = { type: 'pair_existing', partnerId: selectedPartnerId };
      } else {
        const pName = newPartnerName.trim();
        if (!pName) {
          setError('Digite o nome do novo exercício para a dupla.');
          return;
        }
        if (normalizeExercise(pName) === normalizeExercise(name)) {
          setError('Escolha um exercício diferente do atual para a dupla.');
          return;
        }
        action = {
          type: 'create_new',
          partner: {
            name: pName,
            muscle: newPartnerMuscle.trim() || muscle || 'Geral',
            reps: Number(newPartnerReps) || 12,
            load: Number(newPartnerLoad) || 0,
            catalogId: newPartnerPicked?.name === pName ? newPartnerPicked.id : undefined,
          },
        };
      }
    }

    const baseList = planExercises.length > 0 ? planExercises : [exercise];
    const nextList = applyExerciseSettings(baseList, updatedExercise, action);
    onSave(nextList);
  }

  const showBiSetChooser = (currentPartner && existingAction === 'change') || (!currentPartner && wantsBiSet);

  return (
    <form className="duo-fields" onSubmit={submit}>
      <h3>Ajustar exercício</h3>

      <label>
        Nome do exercício
        <input name="name" defaultValue={exercise.name} maxLength={100} required />
      </label>

      <label>
        Grupo muscular
        <input name="muscle" defaultValue={exercise.muscle} maxLength={80} />
      </label>

      <div className="form-row">
        {[
          ['sets', 'Séries', sets, 1, 15],
          ['reps', 'Repetições', exercise.reps, 1, 100],
          ['load', 'Carga (kg)', exercise.load || '', 0, 1000],
          ['rest', 'Descanso (s)', rest, 0, 1200],
        ].map(([key, label, val, min, max]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              name={String(key)}
              inputMode={key === 'load' ? 'decimal' : 'numeric'}
              min={min}
              max={max}
              step={key === 'load' ? 'any' : 1}
              placeholder="0"
              defaultValue={val}
              required={key !== 'load'}
              onChange={e => {
                if (key === 'sets') setSets(Number(e.target.value));
                if (key === 'rest') setRest(Number(e.target.value));
              }}
              onFocus={event => event.currentTarget.select()}
            />
          </label>
        ))}
      </div>

      {/* --- SEÇÃO BI-SET --- */}
      {currentPartner ? (
        <div style={{ background: '#f0f5ee', border: '1px solid #c7d8c5', borderRadius: 12, padding: 14, margin: '14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#275239', fontWeight: 600 }}>
            <Layers size={18} />
            <span>Bi-set ativo com: {currentPartner.name}</span>
          </div>
          <p className="small muted" style={{ margin: '0 0 12px 0' }}>
            Ambos compartilham séries ({sets}) e descanso ({rest}s). Cargas e repetições são individuais.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`button ${existingAction === 'keep' ? 'primary' : 'secondary'}`}
              style={{ fontSize: 13, padding: '7px 12px' }}
              onClick={() => setExistingAction('keep')}
            >
              Manter bi-set
            </button>
            <button
              type="button"
              className={`button ${existingAction === 'unpair' ? 'primary' : 'secondary'}`}
              style={{ fontSize: 13, padding: '7px 12px' }}
              onClick={() => setExistingAction('unpair')}
            >
              <Unlink size={14} style={{ marginRight: 4 }} />
              Desfazer bi-set
            </button>
            <button
              type="button"
              className={`button ${existingAction === 'change' ? 'primary' : 'secondary'}`}
              style={{ fontSize: 13, padding: '7px 12px' }}
              onClick={() => setExistingAction('change')}
            >
              <Link2 size={14} style={{ marginRight: 4 }} />
              Trocar dupla
            </button>
          </div>
        </div>
      ) : (
        <label className="duo-toggle">
          <input
            type="checkbox"
            checked={wantsBiSet}
            onChange={event => setWantsBiSet(event.target.checked)}
          />
          <span>
            <strong>Transformar em Bi-set (exercício duplo)</strong>
            <small>Dois exercícios realizados seguidos sem intervalo. Descanso somente após a dupla.</small>
          </span>
        </label>
      )}

      {showBiSetChooser && (
        <div style={{ border: '1px solid #b6ccb4', background: '#f7faf6', borderRadius: 12, padding: 14, margin: '12px 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className={`button ${biSetMode === 'existing' ? 'primary' : 'secondary'}`}
              style={{ flex: 1, fontSize: 13, padding: '8px 10px' }}
              onClick={() => setBiSetMode('existing')}
              disabled={otherExercises.length === 0}
            >
              <Link2 size={15} style={{ marginRight: 5 }} />
              Exercício deste treino
            </button>
            <button
              type="button"
              className={`button ${biSetMode === 'new' ? 'primary' : 'secondary'}`}
              style={{ flex: 1, fontSize: 13, padding: '8px 10px' }}
              onClick={() => setBiSetMode('new')}
            >
              <Plus size={15} style={{ marginRight: 5 }} />
              Adicionar novo
            </button>
          </div>

          {biSetMode === 'existing' ? (
            <div>
              {otherExercises.length > 0 ? (
                <label>
                  Escolha o exercício parceiro do treino
                  <select
                    value={selectedPartnerId}
                    onChange={e => setSelectedPartnerId(e.target.value)}
                    style={{ marginTop: 6 }}
                  >
                    {otherExercises.map(other => (
                      <option key={other.id} value={other.id}>
                        {other.name} ({other.muscle}){other.supersetId ? ' · já em outro bi-set' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="small muted">Nenhum outro exercício neste treino. Use &quot;Adicionar novo&quot; para criar o parceiro.</p>
              )}
              <p className="small muted" style={{ marginTop: 8 }}>
                O exercício parceiro será movido para logo após este, herdando {sets} séries e {rest}s de descanso.
              </p>
            </div>
          ) : (
            <div className="duo-fields" style={{ background: '#ffffff', margin: 0, padding: 12 }}>
              <ExerciseChoice
                label="Segundo exercício da dupla"
                name={newPartnerName}
                setName={value => {
                  setNewPartnerName(value);
                  setNewPartnerPicked(undefined);
                }}
                onPick={ex => {
                  setNewPartnerPicked(ex);
                  setNewPartnerName(ex.name);
                  setNewPartnerMuscle(ex.muscle);
                }}
              />
              <div className="form-row" style={{ marginTop: 8 }}>
                <label>
                  Grupo muscular
                  <input
                    value={newPartnerMuscle}
                    maxLength={80}
                    onChange={event => setNewPartnerMuscle(event.target.value)}
                  />
                </label>
                <label>
                  Repetições
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newPartnerReps}
                    onChange={event => setNewPartnerReps(Number(event.target.value))}
                    required
                    onFocus={event => event.currentTarget.select()}
                  />
                </label>
                <label>
                  Carga (kg)
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={1000}
                    step="any"
                    placeholder="0"
                    value={newPartnerLoad}
                    onChange={event => setNewPartnerLoad(event.target.value)}
                    onFocus={event => event.currentTarget.select()}
                  />
                </label>
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>
                O novo exercício será adicionado logo após este, compartilhando as {sets} séries e descanso de {rest}s.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="error" style={{ color: '#b3261e', fontWeight: 500, margin: '10px 0' }}>{error}</p>}

      <div className="button-row" style={{ marginTop: 14 }}>
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancelar ajuste
        </button>
        <button className="button primary" type="submit">
          Aplicar ajuste
        </button>
      </div>
    </form>
  );
}
