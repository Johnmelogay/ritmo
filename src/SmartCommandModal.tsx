import { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  X,
  Target,
  Flame,
  Dumbbell,
  RefreshCw,
  Utensils,
  Scale,
  History,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Zap,
  HelpCircle
} from 'lucide-react';
import { type AppState } from './domain';
import {
  planSmartCommand,
  applySmartCards,
  fetchRealtimeJevSuggestions,
  type SmartPlanResult,
  type SmartCardChange,
  type SmartIcon,
  type RealtimeJevResult
} from './smartCommand';
import { type AuditLogEntry } from './auditLog';
import { Modal } from './components';
import './smartCommand.css';

interface SmartCommandModalProps {
  currentState: AppState;
  onApply: (nextState: AppState, logEntry: AuditLogEntry) => void;
  onClose: () => void;
  onOpenAuditLogs: () => void;
}

export function SmartCommandModal({
  currentState,
  onApply,
  onClose,
  onOpenAuditLogs
}: SmartCommandModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [planResult, setPlanResult] = useState<SmartPlanResult | null>(null);
  const [cards, setCards] = useState<SmartCardChange[]>([]);
  const [realtimeJev, setRealtimeJev] = useState<RealtimeJevResult | null>(null);
  const [jevBusy, setJevBusy] = useState(false);

  useEffect(() => {
    const trimmed = prompt.trim();
    if (trimmed.length < 2) {
      setRealtimeJev(null);
      return;
    }

    const timer = setTimeout(async () => {
      setJevBusy(true);
      try {
        const res = await fetchRealtimeJevSuggestions(trimmed, currentState);
        if (res && res.pills.length > 0) {
          setRealtimeJev(res);
        }
      } catch (err) {
        console.warn('Realtime Jev suggestion error:', err);
      } finally {
        setJevBusy(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [prompt]);

  const examplePrompts = [
    { label: '🏋️ Treino ABC completo', text: 'Crie uma ficha de treino ABC completa para hipertrofia: Treino A (Peito e Tríceps), Treino B (Costas e Bíceps), Treino C (Pernas completo).' },
    { label: '🦵 Treino de Perna', text: 'Treino de perna completo para hipertrofia com agachamento livre, leg press e flexora' },
    { label: '🔥 Ajustar calorias e proteína', text: 'Ajuste minha meta diária para 2.600 kcal com 180g de proteína e 250g de carboidratos.' },
    { label: '🎯 Mudar objetivo e peso alvo', text: 'Mude meu objetivo para Ganhar massa e peso de referência para 82 kg.' }
  ];

  async function handleAnalyze() {
    if (!prompt.trim()) {
      setError('Digite ou selecione uma instrução antes de continuar.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await planSmartCommand(prompt, currentState);
      if (res.cards.length === 0) {
        setError('Nenhuma alteração foi identificada para este comando. Tente especificar nomes de treinos ou metas.');
        return;
      }
      setPlanResult(res);
      setCards(res.cards);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha ao processar o comando com IA.');
    } finally {
      setLoading(false);
    }
  }

  function toggleCard(id: string) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  function handleSelectAll(select: boolean) {
    setCards(prev => prev.map(c => ({ ...c, selected: select })));
  }

  function handleApprove() {
    try {
      const { nextState, logEntry } = applySmartCards(
        currentState,
        cards,
        prompt,
        planResult?.jevDecision
      );
      onApply(nextState, logEntry);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar alterações.');
    }
  }

  function renderCardIcon(icon: SmartIcon) {
    switch (icon) {
      case 'target': return <Target size={22} />;
      case 'flame': return <Flame size={22} />;
      case 'protein': return <Utensils size={22} />;
      case 'dumbbell': return <Dumbbell size={22} />;
      case 'refresh': return <RefreshCw size={22} />;
      case 'utensils': return <Utensils size={22} />;
      case 'scale': return <Scale size={22} />;
      default: return <Sparkles size={22} />;
    }
  }

  const selectedCount = cards.filter(c => c.selected).length;

  return (
    <Modal
      title="Comando Inteligente com IA"
      subtitle="Decisão calibrada via TypeSafe JEV e execução de alta fidelidade"
      onClose={onClose}
    >
      <div className="smart-cmd-container">
        {/* Step 1: Input view */}
        {!planResult ? (
          <>
            <div className="smart-cmd-prompt-box">
              <label htmlFor="smart-prompt-input" style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                O que você gostaria de criar ou atualizar?
              </label>
              <textarea
                id="smart-prompt-input"
                className="smart-cmd-textarea"
                placeholder="Exemplo: 'treino de perna', 'Adicione um treino de costas na quarta', 'ajuste as calorias para 2.600 kcal'..."
                value={prompt}
                onChange={e => { setPrompt(e.target.value); setError(''); }}
                rows={3}
                disabled={loading}
              />

              {realtimeJev && realtimeJev.pills.length > 0 && (
                <div className="jev-realtime-panel">
                  <div className="jev-realtime-badge">
                    <Zap size={13} style={{ color: '#fbbf24' }} />
                    <span>
                      JEV Instantâneo ({realtimeJev.latencyMs}ms) · {Math.round(realtimeJev.confidence * 100)}% certeza
                    </span>
                  </div>
                  <div className="jev-realtime-pills">
                    {realtimeJev.pills.map((pill, i) => (
                      <button
                        key={i}
                        type="button"
                        className="jev-realtime-pill"
                        onClick={() => {
                          setPrompt(prev => prev.trim() + (pill.appendText.startsWith(' ') ? '' : ' ') + pill.appendText);
                          setError('');
                        }}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="smart-cmd-examples">
                <span>Modelos prontos:</span>
                {examplePrompts.map(ex => (
                  <button
                    key={ex.label}
                    type="button"
                    className="smart-cmd-pill"
                    onClick={() => { setPrompt(ex.text); setError(''); }}
                    disabled={loading}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="global-error" role="alert" style={{ margin: 0 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="smart-cmd-footer">
              <button
                type="button"
                className="button secondary"
                onClick={onOpenAuditLogs}
              >
                <History size={16} />
                Histórico & Reversão
              </button>

              <button
                type="button"
                className="button primary"
                disabled={loading || !prompt.trim()}
                onClick={handleAnalyze}
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="spin" />
                    Analisando com JEV & Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles size={17} />
                    Analisar e Planejar Alterações
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Step 2: Smart Cards Approval view */
          <>
            {/* JEV Decision banner */}
            <div className="jev-decision-banner">
              <div className="jev-decision-left">
                <span className="jev-glow-dot" />
                <div className="jev-decision-text">
                  <strong>Decisão Calibrada · TypeSafe JEV</strong>
                  <small>
                    Área identificada: {planResult.jevDecision?.intent || 'Operação inteligente'}
                    {planResult.jevDecision?.choiceDetails ? ` (${planResult.jevDecision.choiceDetails})` : ''}
                  </small>
                </div>
              </div>
              {planResult.jevDecision?.confidence && (
                <span className="jev-confidence-tag">
                  {Math.round(planResult.jevDecision.confidence * 100)}% Confiança JEV
                </span>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1' }}>
              {planResult.summary}
            </p>

            <div className="smart-cards-header">
              <h3>Campos a serem alterados ({selectedCount} de {cards.length})</h3>
              <button
                type="button"
                className="smart-cards-select-all"
                onClick={() => handleSelectAll(selectedCount < cards.length)}
              >
                {selectedCount < cards.length ? 'Selecionar todos' : 'Desmarcar todos'}
              </button>
            </div>

            {error && (
              <div className="global-error" role="alert" style={{ margin: 0 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Smart Cards list */}
            <div className="smart-cards-list">
              {cards.map(card => (
                <div
                  key={card.id}
                  className={`smart-card ${card.selected ? 'selected' : ''}`}
                  onClick={() => toggleCard(card.id)}
                >
                  <input
                    type="checkbox"
                    className="smart-card-checkbox"
                    checked={card.selected}
                    onChange={() => toggleCard(card.id)}
                    onClick={e => e.stopPropagation()}
                  />

                  <div className={`smart-card-icon-wrap ${card.icon}`}>
                    {renderCardIcon(card.icon)}
                  </div>

                  <div className="smart-card-body">
                    <div className="smart-card-top">
                      <h4>{card.title}</h4>
                      <span className="smart-card-badge-pill">{card.badge}</span>
                    </div>

                    <p className="smart-card-sub">{card.subtitle}</p>

                    {(card.before || card.after) && (
                      <div className="smart-card-diff">
                        {card.before && (
                          <span className="smart-diff-before">{card.before}</span>
                        )}
                        {card.before && card.after && (
                          <span className="smart-diff-arrow">➔</span>
                        )}
                        {card.after && (
                          <span className="smart-diff-after">{card.after}</span>
                        )}
                      </div>
                    )}

                    {card.details && card.details.length > 0 && (
                      <ul className="smart-card-details-list">
                        {card.details.slice(0, 5).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                        {card.details.length > 5 && (
                          <li style={{ color: '#94a3b8' }}>
                            +{card.details.length - 5} outros itens...
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with rollback promise & action */}
            <div className="smart-cmd-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                <ShieldCheck size={14} color="#10b981" />
                <span>Salvo em log de auditoria com reversão garantida</span>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setPlanResult(null)}
                >
                  Editar Comando
                </button>

                <button
                  type="button"
                  className="button primary"
                  disabled={selectedCount === 0}
                  onClick={handleApprove}
                >
                  <Check size={16} />
                  Aprovar e Aplicar {selectedCount > 0 ? `(${selectedCount})` : ''}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
