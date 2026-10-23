import { useState } from 'react';
import { Dumbbell, Droplets, Moon, Plus, Minus, ArrowUpRight, Check, RotateCcw, Target } from 'lucide-react';
import { CollapsibleCard } from './CollapsibleCard';
import { SeasonHero } from './SeasonHero';
import { dailyTotals, number, weekDates, dateFrom, type AppState, type Plan } from './domain';
import { planSchedule } from './planSchedule';
import { ProgressBar, Modal } from './components';
import { useLocalToday } from './useLocalToday';

export function HomeDashboard({
  state,
  onUpdate,
  onMeal,
  onTrain,
  onStart,
  onWeight,
  onChat,
  onCheckin,
  onDay
}: {
  state: AppState;
  onUpdate: (fn: (state: AppState) => AppState) => boolean;
  onMeal: () => void;
  onTrain: () => void;
  onStart: (plan: Plan) => void;
  onWeight: () => void;
  onChat: () => void;
  onCheckin: () => void;
  onDay: (date: string) => void;
}) {
  const date = useLocalToday();
  const total = dailyTotals(state, date);
  const meals = state.meals.filter(meal => meal.date === date);
  const water = state.water[date] ?? 0;
  const recovery = state.recovery.find(record => record.date === date);
  const next = planSchedule(state, date)[0];
  const active = state.sessions.find(session => !session.finishedAt);

  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [waterDraft, setWaterDraft] = useState(water);

  const handleOpenWaterModal = () => {
    setWaterDraft(state.water[date] ?? 0);
    setWaterModalOpen(true);
  };

  const handleSaveWater = (newMl: number) => {
    const safeMl = Math.max(0, Math.min(25000, Math.round(newMl)));
    onUpdate(current => ({
      ...current,
      water: {
        ...current.water,
        [date]: safeMl
      }
    }));
    setWaterModalOpen(false);
  };

  const stepWater = (delta: number) => {
    onUpdate(current => {
      const cur = current.water[date] ?? 0;
      const nextVal = Math.max(0, Math.min(25000, cur + delta));
      return {
        ...current,
        water: {
          ...current.water,
          [date]: nextVal
        }
      };
    });
  };

  const goalMl = state.profile.water || 2000;
  const waterPercent = Math.min(999, Math.round((water / goalMl) * 100));

  return (
    <>
      <SeasonHero
        state={state}
        onUpdate={onUpdate}
        onMeal={onMeal}
        onTrain={onTrain}
        onWeight={onWeight}
        onChat={onChat}
      />

      <div className="home-focus-grid">
        <section className="card home-workout">
          <div className="home-card-eyebrow">
            <Dumbbell size={18} />
            {active ? 'SESSÃO EM ANDAMENTO' : next?.isToday ? 'SEU TREINO DE HOJE' : 'PRÓXIMO TREINO'}
          </div>
          <h2>{active?.name ?? next?.plan.name ?? 'Seu planejamento começa aqui.'}</h2>
          <p>
            {active
              ? 'Seu progresso está salvo. Continue de onde parou.'
              : next
              ? `${next.plan.exercises.length} exercícios · ${
                  next.isToday
                    ? 'planejado para hoje'
                    : next.nextDate
                    ? dateFrom(next.nextDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
                    : 'sem dia definido'
                }`
              : 'Monte ou importe a ficha do seu personal.'}
          </p>
          <button className="button primary full" onClick={() => (active ? onTrain() : next ? onStart(next.plan) : onTrain())}>
            {active ? 'Continuar treino' : next ? 'Iniciar sessão' : 'Organizar meus treinos'}
          </button>
          <button className="text-button" onClick={onTrain}>
            Ver todos os planos<ArrowUpRight size={15} />
          </button>
        </section>

        <section className="card home-food">
          <div className="home-card-eyebrow">ALIMENTAÇÃO DE HOJE</div>
          <div className="home-intake">
            <strong>{number(total.kcal)}</strong>
            <span>/ {number(state.profile.calories)} kcal registradas</span>
          </div>
          <ProgressBar value={total.kcal} max={state.profile.calories} color="orange" />
          <div className="home-protein">
            <span>Proteína</span>
            <strong>{number(total.protein)} / {state.profile.protein} g</strong>
          </div>
          <ProgressBar value={total.protein} max={state.profile.protein} />
          <p>
            {meals.length} refeições · {state.reviewed.includes(date) ? 'registros revisados' : 'dia parcial'}
          </p>
          <button className="button secondary full" onClick={onMeal}>
            <Plus size={17} />
            Registrar refeição
          </button>
        </section>
      </div>

      <div className="home-small-actions">
        <section className="card home-water" style={{ position: 'relative' }}>
          <div
            onClick={handleOpenWaterModal}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleOpenWaterModal()}
            style={{ flex: 1, cursor: 'pointer', outline: 'none' }}
            title="Clique para ajustar ou digitar o consumo de água"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Droplets size={20} style={{ color: '#2563eb' }} />
                <strong>Água</strong>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#2563eb',
                  background: 'rgba(37,99,235,0.08)',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}
              >
                Ajustar
              </span>
            </div>
            <div>
              <span>
                {number(water / 1000, 2)} / {number(state.profile.water / 1000, 1)} L
              </span>
              <span style={{ fontSize: '11px', color: '#6d7b65', marginLeft: '6px' }}>({waterPercent}%)</span>
            </div>
            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, waterPercent)}%`,
                  background: '#2563eb',
                  borderRadius: '4px',
                  transition: 'width 0.25s ease'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
            <button
              className="icon-button"
              aria-label="Diminuir 250 ml de água"
              title="Remover 250 ml (-250ml)"
              disabled={water <= 0}
              onClick={e => {
                e.stopPropagation();
                stepWater(-250);
              }}
              style={{ opacity: water <= 0 ? 0.35 : 1, width: '34px', height: '34px' }}
            >
              <Minus size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Adicionar 250 ml de água"
              title="Adicionar 250 ml (+250ml)"
              onClick={e => {
                e.stopPropagation();
                stepWater(250);
              }}
              style={{ width: '34px', height: '34px' }}
            >
              <Plus size={18} />
            </button>
          </div>
        </section>

        <button className="card home-checkin" onClick={onCheckin}>
          <Moon size={20} />
          <div>
            <strong>{recovery ? 'Como foi sua recuperação' : 'Como você está hoje?'}</strong>
            <span>
              {recovery
                ? `${number(recovery.sleep, 1)} h de sono · energia ${recovery.energy}/10`
                : 'Sono, disposição e contexto do dia'}
            </span>
          </div>
          <ArrowUpRight size={17} />
        </button>
      </div>

      <CollapsibleCard id="home-week" title="Sua semana em um olhar" subtitle="Abra para consultar os registros de cada dia.">
        <div className="home-week-strip">
          {weekDates(date).map(day => (
            <button key={day} className={day === date ? 'today' : ''} aria-label={`Abrir diário de ${day}`} onClick={() => onDay(day)}>
              <span>{dateFrom(day).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
              <strong>{dateFrom(day).getDate()}</strong>
              <div>
                {state.meals.some(meal => meal.date === day) && <i className="orange" />}
                {state.sessions.some(session => session.date === day && session.finishedAt) && <i className="green" />}
              </div>
            </button>
          ))}
        </div>
        <p className="small muted">Dias vazios indicam ausência de registros. Não são uma avaliação do seu esforço.</p>
      </CollapsibleCard>

      {waterModalOpen && (
        <WaterAdjustModal
          currentMl={waterDraft}
          goalMl={goalMl}
          dateStr={date}
          onSave={handleSaveWater}
          onClose={() => setWaterModalOpen(false)}
        />
      )}
    </>
  );
}

function WaterAdjustModal({
  currentMl,
  goalMl,
  dateStr,
  onSave,
  onClose
}: {
  currentMl: number;
  goalMl: number;
  dateStr: string;
  onSave: (ml: number) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(currentMl);

  const add = (delta: number) => {
    setVal(v => Math.max(0, Math.min(25000, v + delta)));
  };

  const pct = Math.min(999, Math.round((val / (goalMl || 2000)) * 100));

  return (
    <Modal
      title="Ajustar Consumo de Água"
      subtitle={`${dateFrom(dateStr).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · Meta: ${number(goalMl / 1000, 1)} L`}
      onClose={onClose}
    >
      <div className="modal-body water-adjust-modal">
        <div className="water-display-card">
          <span>Total consumido hoje</span>
          <strong>{number(val / 1000, 2)} L</strong>
          <span style={{ fontWeight: 550, color: '#2563eb' }}>
            {val} ml · {pct}% da sua meta
          </span>
          <div style={{ width: '80%', height: '6px', background: '#dbeafe', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, pct)}%`,
                background: '#2563eb',
                borderRadius: '4px',
                transition: 'width 0.2s ease'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Digitar quantidade exata (ml):
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              max="25000"
              step="50"
              value={val === 0 ? '' : val}
              placeholder="0"
              onChange={e => {
                const n = parseInt(e.target.value, 10);
                setVal(isNaN(n) ? 0 : Math.max(0, Math.min(25000, n)));
              }}
              style={{
                flex: 1,
                fontSize: '18px',
                fontWeight: 600,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #d1d5db'
              }}
            />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#6b7280' }}>ml</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>
            Ajustes rápidos:
          </label>
          <div className="water-chips-grid">
            <button type="button" className="water-chip" onClick={() => add(150)}>
              +150 ml <span style={{ fontSize: '11px', color: '#6b7280' }}>☕</span>
            </button>
            <button type="button" className="water-chip" onClick={() => add(250)}>
              +250 ml <span style={{ fontSize: '11px', color: '#6b7280' }}>🥛</span>
            </button>
            <button type="button" className="water-chip" onClick={() => add(500)}>
              +500 ml <span style={{ fontSize: '11px', color: '#6b7280' }}>🍶</span>
            </button>
            <button type="button" className="water-chip" onClick={() => add(1000)}>
              +1.0 L <span style={{ fontSize: '11px', color: '#6b7280' }}>💧</span>
            </button>
            <button type="button" className="water-chip sub" onClick={() => add(-250)} disabled={val <= 0}>
              -250 ml
            </button>
            <button type="button" className="water-chip sub" onClick={() => add(-500)} disabled={val <= 0}>
              -500 ml
            </button>
          </div>
        </div>

        <div className="water-shortcuts">
          <button type="button" onClick={() => setVal(goalMl)}>
            <Target size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            Bater meta ({number(goalMl / 1000, 1)} L)
          </button>
          <button type="button" onClick={() => setVal(0)}>
            <RotateCcw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            Zerar contagem
          </button>
        </div>
      </div>

      <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button primary" onClick={() => onSave(val)}>
          <Check size={16} />
          Salvar quantidade
        </button>
      </footer>
    </Modal>
  );
}
