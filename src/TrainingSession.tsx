import { memo, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, GripVertical, MessageSquare, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ProfessionalTimer, SessionClock } from './ProfessionalTimer';
import { Badge, Modal } from './components';
import { completedSets, type Session, type SessionExercise } from './domain';
import { TrainingNumber } from './TrainingNumber';
import {
  reorderSessionExercises,
  reorderSessionUnits,
  replaceSessionExercise,
  removeSessionExercise,
  updateSessionExerciseNotes,
  shouldStartRest,
  swapBiSetExercises,
  parseTrainingNumber,
  normalizeExercise,
  exerciseKey,
  getLastExerciseStatsMap,
  type LastPerformance,
  type ReplaceExerciseInput,
} from './training';
import { ExerciseChoice } from './ExerciseComposer';
import { type DbExercise } from './workoutDb';

export type SessionPatch = (change: (session: Session) => Session) => void;

function ReplaceExerciseModal({
  exercise,
  onClose,
  onConfirm,
}: {
  exercise: SessionExercise;
  onClose: () => void;
  onConfirm: (
    replacement: { name: string; muscle: string; load: number; reps: number; catalogId?: string; reason: string },
    persistToPlan: boolean
  ) => void;
}) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState(exercise.muscle);
  const [load, setLoad] = useState(String(exercise.load||''));
  const [reps, setReps] = useState(String(exercise.reps));
  const [catalogId, setCatalogId] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState('Aparelho ocupado');
  const [customReason, setCustomReason] = useState('');
  const [persistToPlan, setPersistToPlan] = useState(true);
  const [error, setError] = useState('');

  const quickReasons = [
    'Aparelho ocupado',
    'Variação do treino',
    'Desconforto / dor articular',
    'Foco em outro ângulo',
    'Tempo curto',
  ];

  function pick(ex: DbExercise) {
    setName(ex.name);
    setMuscle(ex.muscle);
    setCatalogId(ex.id);
    if (ex.defaultReps) setReps(String(ex.defaultReps));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) {
      setError('Escolha ou digite o nome do novo exercício.');
      return;
    }
    if (exercise.logs.some(log=>log.done)) { setError('Este exercício já tem séries concluídas. Para preservar seu histórico, adicione o novo exercício como extra nesta sessão.'); return; }
    if (normalizeExercise(finalName)===normalizeExercise(exercise.name)) { setError('Escolha um exercício diferente do atual.'); return; }
    const parsedLoad=parseTrainingNumber(load||'0',0,1000),parsedReps=parseTrainingNumber(reps,1,100,true);
    if(parsedLoad===null||parsedReps===null){setError('Confira a carga (0–1000 kg) e as repetições (1–100).');return;}
    const finalReason = customReason.trim() || reason;
    onConfirm({
      name: finalName,
      muscle: muscle.trim() || exercise.muscle,
      load: parsedLoad,
      reps: parsedReps,
      catalogId,
      reason: finalReason,
    }, persistToPlan);
  }

  return (
    <Modal
      title="Substituir exercício"
      subtitle="Substituição rápida para esta sessão e planos futuros."
      onClose={onClose}
    >
      <form onSubmit={submit} className="modal-body replacement-form">
        <div className="replacement-current">
          <span className="eyebrow">VOCÊ VAI SUBSTITUIR</span>
          <strong>{exercise.name}</strong>
          <span className="muted"> ({exercise.muscle} · {exercise.sets} séries)</span>
        </div>

        <ExerciseChoice
          label="Novo exercício"
          name={name}
          setName={val => {
            setName(val);
            setCatalogId(undefined);
          }}
          onPick={pick}
        />

        <div className="form-row" style={{ marginTop: 10 }}>
          <label>
            Grupo muscular
            <input
              type="text"
              value={muscle}
              onChange={e => setMuscle(e.target.value)}
              placeholder="Ex.: Peitoral, Costas…"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Carga inicial (kg)
            <input
              type="text"
              inputMode="decimal"
              min={0}
              max={1000}
              step="any"
              value={load}
              onChange={e => setLoad(e.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Repetições
            <input
              type="text"
              inputMode="numeric"
              min={1}
              max={100}
              value={reps}
              onChange={e => setReps(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="replacement-reasons">
          <label>
            Motivo da substituição
          </label>
          <div className="reason-chips">
            {quickReasons.map(r => (
              <button
                type="button"
                key={r}
                aria-pressed={reason === r && !customReason}
                className={`reason-chip ${reason === r && !customReason ? 'selected' : ''}`}
                onClick={() => {
                  setReason(r);
                  setCustomReason('');
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={customReason}
            onChange={e => setCustomReason(e.target.value)}
            placeholder="Ou digite outro motivo específico…"
            maxLength={120}
          />
        </div>

        <label className="persist-plan-toggle">
          <input
            type="checkbox"
            checked={persistToPlan}
            onChange={e => setPersistToPlan(e.target.checked)}
          />
          <span>Salvar esta substituição para as próximas semanas desta ficha</span>
        </label>

        {error && <p role="alert" className="error">{error}</p>}

        <div className="button-row replacement-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button primary">
            <Check size={16} /> Confirmar substituição
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ExerciseCard = memo(function ExerciseCard({
  exercise: ex,
  displayIndex,
  unitIndex,
  totalUnits,
  onPatch,
  round,
  onStartReplace,
  onRemoveExercise,
  lastPerformance,
  draggedUnitIndex,
  dragOverUnitIndex,
  setDraggedUnitIndex,
  setDragOverUnitIndex,
  onMoveUnit,
}: {
  exercise: SessionExercise;
  displayIndex?: number;
  unitIndex?: number;
  totalUnits?: number;
  onPatch: SessionPatch;
  round?: number;
  onStartReplace: (exercise: SessionExercise) => void;
  onRemoveExercise?: (exercise: SessionExercise) => void;
  lastPerformance?: LastPerformance | null;
  draggedUnitIndex?: number | null;
  dragOverUnitIndex?: number | null;
  setDraggedUnitIndex?: (idx: number | null) => void;
  setDragOverUnitIndex?: (idx: number | null) => void;
  onMoveUnit?: (from: number, to: number) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(ex.notes));
  const isDragging = unitIndex !== undefined && draggedUnitIndex === unitIndex;
  const isDragOver = unitIndex !== undefined && dragOverUnitIndex === unitIndex;
  const doneCount = ex.logs.filter(l => l.done).length;

  if (isCollapsed) {
    return (
      <section className="card session-exercise is-collapsed" data-unit-index={unitIndex}>
        <div className="exercise-collapsed-bar" onClick={() => setIsCollapsed(false)}>
          <span className="exercise-index">{String(displayIndex ?? 1).padStart(2, '0')}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <strong>{ex.name}</strong>
              {lastPerformance && (
                <span className="last-load-tag">Últ.: {lastPerformance.load}kg</span>
              )}
            </div>
            <span className="muted" style={{ fontSize: 11 }}>
              {doneCount}/{ex.logs.length} séries {doneCount === ex.logs.length ? '✓' : ''}
            </span>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={e => { e.stopPropagation(); setIsCollapsed(false); }}
            aria-label={`Expandir ${ex.name}`}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`card session-exercise ${ex.supersetId ? 'is-superset' : ''} ${round !== undefined ? 'compact-round' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      data-unit-index={unitIndex}
      onDragOver={e => {
        if (round === undefined && onMoveUnit && unitIndex !== undefined) {
          e.preventDefault();
          if (draggedUnitIndex !== null && draggedUnitIndex !== unitIndex) {
            setDragOverUnitIndex?.(unitIndex);
          }
        }
      }}
      onDragLeave={() => {
        if (unitIndex !== undefined && dragOverUnitIndex === unitIndex) setDragOverUnitIndex?.(null);
      }}
      onDrop={e => {
        if (round === undefined && onMoveUnit && unitIndex !== undefined) {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData('text/plain'));
          if (!isNaN(from) && from !== unitIndex) {
            onMoveUnit(from, unitIndex);
          }
          setDraggedUnitIndex?.(null);
          setDragOverUnitIndex?.(null);
        }
      }}
      onDragEnd={() => {
        setDraggedUnitIndex?.(null);
        setDragOverUnitIndex?.(null);
      }}
    >
      <div className="exercise-heading">
        <div className="exercise-order-controls">
          {round === undefined && onMoveUnit && unitIndex !== undefined && totalUnits !== undefined && (
            <>
              <div
                className="exercise-drag-handle"
                title="Arrastar para reordenar"
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', String(unitIndex));
                  setDraggedUnitIndex?.(unitIndex);
                }}
                onPointerDown={e => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
                  setDraggedUnitIndex?.(unitIndex);
                }}
                onPointerMove={e => {
                  if (draggedUnitIndex === null || draggedUnitIndex === undefined) return;
                  const elem = document.elementFromPoint(e.clientX, e.clientY);
                  const targetCard = elem?.closest('[data-unit-index]') as HTMLElement | null;
                  if (targetCard && targetCard.dataset.unitIndex !== undefined) {
                    const overIdx = Number(targetCard.dataset.unitIndex);
                    if (!isNaN(overIdx) && overIdx !== draggedUnitIndex) {
                      setDragOverUnitIndex?.(overIdx);
                    }
                  }
                }}
                onPointerUp={e => {
                  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                  if (draggedUnitIndex !== null && draggedUnitIndex !== undefined && dragOverUnitIndex !== null && dragOverUnitIndex !== undefined && dragOverUnitIndex !== draggedUnitIndex) {
                    onMoveUnit(draggedUnitIndex, dragOverUnitIndex);
                  }
                  setDraggedUnitIndex?.(null);
                  setDragOverUnitIndex?.(null);
                }}
                onPointerCancel={() => {
                  setDraggedUnitIndex?.(null);
                  setDragOverUnitIndex?.(null);
                }}
              >
                <GripVertical size={16} />
              </div>
              <div className="order-buttons-col">
                <button
                  type="button"
                  className="exercise-order-btn"
                  title="Mover para cima"
                  disabled={unitIndex === 0}
                  onClick={e => {
                    e.stopPropagation();
                    onMoveUnit(unitIndex, unitIndex - 1);
                  }}
                  aria-label={`Mover ${ex.name} para cima`}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  className="exercise-order-btn"
                  title="Mover para baixo"
                  disabled={unitIndex >= totalUnits - 1}
                  onClick={e => {
                    e.stopPropagation();
                    onMoveUnit(unitIndex, unitIndex + 1);
                  }}
                  aria-label={`Mover ${ex.name} para baixo`}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </>
          )}
          <span className="exercise-index">{String(displayIndex ?? 1).padStart(2, '0')}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3>{ex.name}</h3>
            {lastPerformance && (
              <span className="last-load-tag" title={`Última sessão: ${lastPerformance.load} kg × ${lastPerformance.reps} reps em ${lastPerformance.date}`}>
                Últ.: <strong>{lastPerformance.load} kg</strong> {lastPerformance.reps ? `× ${lastPerformance.reps}` : ''}
              </span>
            )}
          </div>
          <p>{ex.muscle} · {ex.rest}s {ex.supersetId ? 'após a dupla' : 'de descanso'}</p>
          {ex.supersetId && <span className="duo-label">Bi-set · complete os dois antes de descansar</span>}
        </div>

        <div className="exercise-head-actions">
          <Badge origin={ex.origin} />
          <div className="exercise-buttons-strip">
            <button
              type="button"
              className={`exercise-chip-btn ${ex.notes ? 'has-active-note' : ''}`}
              onClick={() => setShowNotes(v => !v)}
              title="Anotação discreta (banco, carga, dor)"
              aria-label={`Observações de ${ex.name}`}
            >
              <MessageSquare size={12} />
              <span>Nota</span>
              {ex.notes && <span className="active-dot" />}
            </button>
            <button
              type="button"
              className="exercise-chip-btn"
              onClick={() => onStartReplace(ex)}
              aria-label={`Substituir exercício ${ex.name}`}
              title="Substituir exercício"
            >
              <RefreshCw size={12} />
              <span>Trocar</span>
            </button>
            {onRemoveExercise && (
              <button
                type="button"
                className="exercise-chip-btn danger"
                onClick={() => onRemoveExercise(ex)}
                aria-label={`Remover exercício ${ex.name}`}
                title="Remover exercício do treino"
              >
                <Trash2 size={12} />
              </button>
            )}
            <button
              type="button"
              className="exercise-chip-btn"
              onClick={() => setIsCollapsed(true)}
              aria-label="Recolher exercício"
              title="Recolher este exercício"
            >
              <ChevronUp size={14} />
            </button>
          </div>
        </div>
      </div>

      {showNotes && (
        <div className="exercise-note-inline">
          <textarea
            className="exercise-note-textarea"
            value={ex.notes || ''}
            placeholder="Anotações da execução (ex.: regulagem da máquina, banco 3, pegada neutra, dor articular)..."
            maxLength={400}
            rows={2}
            onChange={e => onPatch(session => ({
              ...session,
              exercises: session.exercises.map(item => item.id !== ex.id ? item : { ...item, notes: e.target.value })
            }))}
          />
        </div>
      )}

      {ex.replacedFrom && (
        <div className="replaced-banner">
          <RefreshCw size={13} />
          <span>Substituiu <strong>{ex.replacedFrom.name}</strong> ({ex.replacedFrom.muscle}) · Motivo: <em>{ex.reason || 'Variação do treino'}</em></span>
        </div>
      )}

      <div className="sets-table">
        <div className="set-head"><span>Série</span><span>kg</span><span>Reps</span><span>RIR</span><span>Feita</span></div>
        {ex.logs.map((log, logIndex) => round !== undefined && round !== logIndex ? null : (
          <div key={log.id} className={`set-row ${log.done ? 'completed' : ''}`}>
            <strong>{logIndex + 1}</strong>
            {(['load', 'reps', 'rir'] as const).map(field => (
              <div key={field} className="set-field-wrapper">
                <TrainingNumber
                  value={log[field]}
                  max={field === 'load' ? 1000 : field === 'rir' ? 10 : 200}
                  integer={field !== 'load'}
                  label={`${ex.name}, série ${logIndex + 1}, ${field === 'load' ? 'carga' : field === 'reps' ? 'repetições' : 'RIR'}`}
                  onCommit={value => onPatch(session => ({
                    ...session,
                    exercises: session.exercises.map(item => item.id !== ex.id ? item : {
                      ...item,
                      logs: item.logs.map(row => row.id !== log.id ? row : { ...row, [field]: value })
                    })
                  }))}
                />
                {field === 'load' && lastPerformance && lastPerformance.load > 0 && log.load === 0 && !log.done && (
                  <button
                    type="button"
                    className="copy-last-load-hint"
                    title={`Toque para usar a última carga (${lastPerformance.load} kg)`}
                    onClick={() => onPatch(session => ({
                      ...session,
                      exercises: session.exercises.map(item => item.id !== ex.id ? item : {
                        ...item,
                        logs: item.logs.map(row => row.id !== log.id ? row : { ...row, load: lastPerformance.load })
                      })
                    }))}
                  >
                    Ant. {lastPerformance.load}kg
                  </button>
                )}
              </div>
            ))}
            <button
              className={`set-check ${log.done ? 'checked' : ''}`}
              aria-pressed={log.done}
              aria-label={`${log.done ? 'Desmarcar' : 'Concluir'} série ${logIndex + 1} de ${ex.name}`}
              onClick={() => onPatch(session => {
                const current = session.exercises.find(item => item.id === ex.id)?.logs.find(row => row.id === log.id);
                if (!current || (!current.done && current.reps === 0)) return session;
                const start = !current.done && shouldStartRest(session, ex.id, logIndex);
                return {
                  ...session,
                  restEnd: start ? Date.now() + ex.rest * 1000 : session.restEnd,
                  ...(start ? { restPausedSeconds: null, restDuration: ex.rest } : {}),
                  exercises: session.exercises.map(item => item.id !== ex.id ? item : {
                    ...item,
                    logs: item.logs.map(row => row.id !== log.id ? row : { ...row, done: !row.done })
                  })
                };
              })}
            >
              <Check size={20} />
            </button>
          </div>
        ))}
      </div>
      <p className="small muted">Campos vazios representam zero. Toque no ✓ para concluir. RIR = repetições que ainda conseguiria fazer.</p>
    </section>
  );
});

function SupersetBlock({
  exercises,
  displayStartIndex,
  unitIndex,
  totalUnits,
  onPatch,
  onStartReplace,
  onRemoveExercise,
  lastStatsMap,
  draggedUnitIndex,
  dragOverUnitIndex,
  setDraggedUnitIndex,
  setDragOverUnitIndex,
  onMoveUnit,
}: {
  exercises: SessionExercise[];
  displayStartIndex: number;
  unitIndex: number;
  totalUnits: number;
  onPatch: SessionPatch;
  onStartReplace: (exercise: SessionExercise) => void;
  onRemoveExercise?: (exercise: SessionExercise) => void;
  lastStatsMap?: Map<string, LastPerformance>;
  draggedUnitIndex?: number | null;
  dragOverUnitIndex?: number | null;
  setDraggedUnitIndex?: (idx: number | null) => void;
  setDragOverUnitIndex?: (idx: number | null) => void;
  onMoveUnit: (from: number, to: number) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [manualRound, setManualRound] = useState<number | null>(null);
  const rounds = Math.max(...exercises.map(ex => ex.logs.length));
  const firstIncomplete = Array.from({ length: rounds }, (_, round) => round).find(round => exercises.some(ex => ex.logs[round] && !ex.logs[round].done));
  const currentRound = manualRound ?? firstIncomplete ?? rounds - 1;
  const isDragging = draggedUnitIndex === unitIndex;
  const isDragOver = dragOverUnitIndex === unitIndex;

  const totalSets = exercises.reduce((sum, ex) => sum + ex.logs.length, 0);
  const completedSetsCount = exercises.reduce((sum, ex) => sum + ex.logs.filter(l => l.done).length, 0);
  const allDuoDone = completedSetsCount === totalSets && totalSets > 0;

  if (isCollapsed) {
    return (
      <section
        className={`superset-block is-collapsed ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
        data-unit-index={unitIndex}
      >
        <div className="superset-collapsed-card" onClick={() => setIsCollapsed(false)}>
          <div className="superset-collapsed-header">
            <span className="duo-mini-badge">BI-SET</span>
            <span className="superset-collapsed-progress">
              {allDuoDone ? '✓ Concluído' : `${completedSetsCount}/${totalSets} séries`}
            </span>
          </div>
          <div className="superset-collapsed-names">
            <strong>{exercises.map(e => e.name).join(' + ')}</strong>
          </div>
          <button
            type="button"
            className="superset-expand-trigger"
            onClick={e => { e.stopPropagation(); setIsCollapsed(false); }}
            aria-label="Expandir bi-set"
          >
            <ChevronDown size={16} />
            <span>Expandir</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`superset-block ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      data-unit-index={unitIndex}
      onDragOver={e => {
        e.preventDefault();
        if (draggedUnitIndex !== null && draggedUnitIndex !== unitIndex) {
          setDragOverUnitIndex?.(unitIndex);
        }
      }}
      onDragLeave={() => {
        if (dragOverUnitIndex === unitIndex) setDragOverUnitIndex?.(null);
      }}
      onDrop={e => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (!isNaN(from) && from !== unitIndex) {
          onMoveUnit(from, unitIndex);
        }
        setDraggedUnitIndex?.(null);
        setDragOverUnitIndex?.(null);
      }}
      onDragEnd={() => {
        setDraggedUnitIndex?.(null);
        setDragOverUnitIndex?.(null);
      }}
    >
      <div className="superset-title">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div
              className="exercise-drag-handle"
              title="Arrastar bi-set para reordenar"
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('text/plain', String(unitIndex));
                setDraggedUnitIndex?.(unitIndex);
              }}
              onPointerDown={e => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
                setDraggedUnitIndex?.(unitIndex);
              }}
              onPointerMove={e => {
                if (draggedUnitIndex === null || draggedUnitIndex === undefined) return;
                const elem = document.elementFromPoint(e.clientX, e.clientY);
                const targetCard = elem?.closest('[data-unit-index]') as HTMLElement | null;
                if (targetCard && targetCard.dataset.unitIndex !== undefined) {
                  const overIdx = Number(targetCard.dataset.unitIndex);
                  if (!isNaN(overIdx) && overIdx !== draggedUnitIndex) {
                    setDragOverUnitIndex?.(overIdx);
                  }
                }
              }}
              onPointerUp={e => {
                try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                if (draggedUnitIndex !== null && draggedUnitIndex !== undefined && dragOverUnitIndex !== null && dragOverUnitIndex !== undefined && dragOverUnitIndex !== draggedUnitIndex) {
                  onMoveUnit(draggedUnitIndex, dragOverUnitIndex);
                }
                setDraggedUnitIndex?.(null);
                setDragOverUnitIndex?.(null);
              }}
              onPointerCancel={() => {
                setDraggedUnitIndex?.(null);
                setDragOverUnitIndex?.(null);
              }}
            >
              <GripVertical size={16} />
            </div>
            <div className="order-buttons-col">
              <button
                type="button"
                className="exercise-order-btn"
                title="Mover bi-set para cima"
                disabled={unitIndex === 0}
                onClick={e => {
                  e.stopPropagation();
                  onMoveUnit(unitIndex, unitIndex - 1);
                }}
                aria-label="Mover bi-set para cima"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                className="exercise-order-btn"
                title="Mover bi-set para baixo"
                disabled={unitIndex >= totalUnits - 1}
                onClick={e => {
                  e.stopPropagation();
                  onMoveUnit(unitIndex, unitIndex + 1);
                }}
                aria-label="Mover bi-set para baixo"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <span className="eyebrow" style={{ margin: 0 }}>EXERCÍCIO DUPLO</span>
          </div>
          <h3>Rodada {currentRound + 1} de {rounds}</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {exercises.length >= 2 && exercises[0].supersetId && (
              <button
                type="button"
                className="text-button"
                style={{ fontSize: 11, padding: 0, gap: 4 }}
                onClick={() => onPatch(s => swapBiSetExercises(s, exercises[0].supersetId!))}
                title="Trocar quem começa o bi-set"
                aria-label="Inverter ordem dos exercícios no bi-set"
              >
                <RefreshCw size={11} />
                <span>Inverter</span>
              </button>
            )}
            <button
              type="button"
              className="superset-collapse-btn"
              onClick={() => setIsCollapsed(true)}
              title="Recolher bi-set"
              aria-label="Recolher bi-set"
            >
              <ChevronUp size={14} />
              <span>Recolher</span>
            </button>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>Faça os dois; depois descanse.</span>
        </div>
      </div>

      <div className="round-tabs" aria-label="Rodadas da dupla">
        {Array.from({ length: rounds }, (_, round) => (
          <button
            key={round}
            className={currentRound === round ? 'selected' : ''}
            aria-label={`Ver rodada ${round + 1} da dupla`}
            aria-pressed={currentRound === round}
            onClick={() => setManualRound(round)}
          >
            {exercises.every(ex => !ex.logs[round] || ex.logs[round].done) ? <Check size={16} /> : round + 1}
          </button>
        ))}
        <button onClick={() => setManualRound(null)}>Próxima pendente</button>
      </div>

      {exercises.map((ex, offset) => ex.logs[currentRound] && (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          displayIndex={displayStartIndex + offset}
          round={currentRound}
          onPatch={onPatch}
          onStartReplace={onStartReplace}
          onRemoveExercise={onRemoveExercise}
          lastPerformance={lastStatsMap?.get(exerciseKey(ex)) || lastStatsMap?.get(normalizeExercise(ex.name)) || null}
        />
      ))}
    </section>
  );
}

export function TrainingSession({
  session,
  allSessions = [],
  onPatch,
  onFinish,
  onAdd,
  onDiscard,
  onRemoveExercise,
  onReplaceExercise,
}: {
  session: Session;
  allSessions?: Session[];
  onPatch: SessionPatch;
  onFinish: () => void;
  onAdd: () => void;
  onDiscard: () => void;
  onRemoveExercise?: (exercise: SessionExercise, persistToPlan: boolean) => void;
  onReplaceExercise?: (exerciseId: string, replacement: ReplaceExerciseInput, persistToPlan: boolean) => void;
}) {
  const [replacingExercise, setReplacingExercise] = useState<SessionExercise | null>(null);
  const [draggedUnitIndex, setDraggedUnitIndex] = useState<number | null>(null);
  const [dragOverUnitIndex, setDragOverUnitIndex] = useState<number | null>(null);
  const [exerciseToRemove, setExerciseToRemove] = useState<SessionExercise | null>(null);

  const completed = completedSets(session);
  const total = session.exercises.reduce((sum, ex) => sum + ex.logs.length, 0);

  // Precompute last performance map for fast rendering
  const lastStatsMap = useMemo(() => getLastExerciseStatsMap(allSessions), [allSessions]);

  // Group exercises into atomic units: standalone exercises and bi-set groups
  const units = useMemo(() => {
    const list: { id: string; supersetId?: string; exercises: SessionExercise[]; startIndex: number }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < session.exercises.length; i++) {
      const ex = session.exercises[i];
      if (!ex.supersetId) {
        list.push({ id: ex.id, exercises: [ex], startIndex: i });
      } else if (!seen.has(ex.supersetId)) {
        seen.add(ex.supersetId);
        const group = session.exercises.filter(item => item.supersetId === ex.supersetId);
        list.push({
          id: ex.supersetId,
          supersetId: ex.supersetId,
          exercises: group,
          startIndex: i,
        });
      }
    }
    return list;
  }, [session.exercises]);

  const handleMoveUnit = (fromUnit: number, toUnit: number) => {
    onPatch(s => reorderSessionUnits(s, fromUnit, toUnit));
  };

  const handleConfirmRemove = (persistToPlan: boolean) => {
    if (!exerciseToRemove) return;
    if (onRemoveExercise) {
      onRemoveExercise(exerciseToRemove, persistToPlan);
    } else {
      onPatch(s => removeSessionExercise(s, exerciseToRemove.id));
    }
    setExerciseToRemove(null);
  };

  return (
    <>
      <div className="active-header">
        <div>
          <span className="eyebrow">SESSÃO EM ANDAMENTO</span>
          <h2>{session.name}</h2>
          <SessionClock startedAt={session.startedAt} />
          <p>{completed}/{total} séries concluídas · salvas ao confirmar cada campo</p>
        </div>
        <button className="button primary" onClick={onFinish}><Check size={18} />Finalizar treino</button>
      </div>

      <div className="training-progress" role="progressbar" aria-label="Séries concluídas" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}>
        <span style={{ width: `${total ? completed / total * 100 : 0}%` }} />
      </div>

      <ProfessionalTimer session={session} onPatch={onPatch} />

      <div className="session-exercises">
        {units.map((unit, unitIdx) => {
          if (!unit.supersetId) {
            const ex = unit.exercises[0];
            return (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                displayIndex={unit.startIndex + 1}
                unitIndex={unitIdx}
                totalUnits={units.length}
                onPatch={onPatch}
                onStartReplace={setReplacingExercise}
                onRemoveExercise={exToRemove => setExerciseToRemove(exToRemove)}
                lastPerformance={lastStatsMap.get(exerciseKey(ex)) || lastStatsMap.get(normalizeExercise(ex.name)) || null}
                draggedUnitIndex={draggedUnitIndex}
                dragOverUnitIndex={dragOverUnitIndex}
                setDraggedUnitIndex={setDraggedUnitIndex}
                setDragOverUnitIndex={setDragOverUnitIndex}
                onMoveUnit={handleMoveUnit}
              />
            );
          }
          return (
            <SupersetBlock
              key={unit.id}
              exercises={unit.exercises}
              displayStartIndex={unit.startIndex + 1}
              unitIndex={unitIdx}
              totalUnits={units.length}
              onPatch={onPatch}
              onStartReplace={setReplacingExercise}
              onRemoveExercise={exToRemove => setExerciseToRemove(exToRemove)}
              lastStatsMap={lastStatsMap}
              draggedUnitIndex={draggedUnitIndex}
              dragOverUnitIndex={dragOverUnitIndex}
              setDraggedUnitIndex={setDraggedUnitIndex}
              setDragOverUnitIndex={setDragOverUnitIndex}
              onMoveUnit={handleMoveUnit}
            />
          );
        })}
      </div>

      <div className="toolbar">
        <button className="button secondary" onClick={onAdd}><Plus size={18} />Adicionar exercício ou dupla</button>
        <button className="text-button danger" onClick={onDiscard}>Descartar sessão</button>
      </div>

      {replacingExercise && (
        <ReplaceExerciseModal
          exercise={replacingExercise}
          onClose={() => setReplacingExercise(null)}
          onConfirm={(replacement, persistToPlan) => {
            if (onReplaceExercise) {
              onReplaceExercise(replacingExercise.id, replacement, persistToPlan);
            } else {
              onPatch(s => replaceSessionExercise(s, replacingExercise.id, replacement));
            }
            setReplacingExercise(null);
          }}
        />
      )}

      {exerciseToRemove && (
        <Modal
          title="Remover exercício"
          subtitle="Escolha se deseja remover apenas de hoje ou também dos próximos treinos."
          onClose={() => setExerciseToRemove(null)}
        >
          <div className="modal-body">
            <p>
              Tem certeza que deseja remover <strong>{exerciseToRemove.name}</strong> ({exerciseToRemove.muscle})?
            </p>
            {exerciseToRemove.logs.some(l => l.done) && (
              <p className="warning-note" style={{ fontSize: 12, color: '#9c5a1a' }}>
                ⚠️ Este exercício já possui séries concluídas nesta sessão.
              </p>
            )}
            <div className="button-row" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setExerciseToRemove(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button secondary danger"
                onClick={() => handleConfirmRemove(false)}
              >
                Remover só de hoje
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => handleConfirmRemove(true)}
              >
                Remover e atualizar ficha
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

