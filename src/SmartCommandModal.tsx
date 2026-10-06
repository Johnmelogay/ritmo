import { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  Target,
  Flame,
  Dumbbell,
  RefreshCw,
  Utensils,
  Scale,
  History,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Zap,
  Plus
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

  useEffect(() => {
    const trimmed = prompt.trim();
    if (trimmed.length < 2) {
      setRealtimeJev(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetchRealtimeJevSuggestions(trimmed, currentState);
        if (res && res.pills.length > 0) {
          setRealtimeJev(res);
        }
      } catch (err) {
        console.warn('Realtime Jev suggestion error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [prompt]);

  const examplePrompts = [
    {
      title: '👤 Matheus: Ganhar Massa & Perder Gordura',
      text: 'Meu nome é Matheus e eu quero ganhar massa muscular e perder gordura. Faça uma triagem completa e calcule minhas metas ideais.'
    },
    {
      title: '⚖️ Bioimpedância: 82kg, 20% gordura e 1.78m',
      text: 'Minha bioimpedância deu 82kg, 20% de gordura corporal e 1.78m de altura. Quero perder gordura, calcule as calorias e macros ideais.'
    },
    {
      title: '🏋️ Treino ABC hipertrofia completo',
      text: 'Crie uma ficha de treino ABC completa para hipertrofia: Treino A (Peito e Tríceps), Treino B (Costas e Bíceps), Treino C (Pernas completo).'
    },
    {
      title: '🔥 Calorias & Proteína (2.600 kcal · 180g P)',
      text: 'Ajuste minha meta diária para 2.600 kcal com 180g de proteína e 250g de carboidratos.'
    }
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
      case 'target': return <Target size={20} />;
      case 'flame': return <Flame size={20} />;
      case 'protein': return <Utensils size={20} />;
      case 'dumbbell': return <Dumbbell size={20} />;
      case 'refresh': return <RefreshCw size={20} />;
      case 'utensils': return <Utensils size={20} />;
      case 'scale': return <Scale size={20} />;
      default: return <Sparkles size={20} />;
    }
  }

  const selectedCount = cards.filter(c => c.selected).length;

  return (
    <Modal
      title={planResult ? 'Revisão do Planejamento' : 'Comando Inteligente'}
      subtitle={
        planResult
          ? 'Revise os campos identificados e aprove as alterações para seu treino ou dieta.'
          : 'Descreva em texto livre treinos, dietas ou metas. JEV & Gemini planejam as alterações.'
      }
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        {!planResult ? (
          /* Step 1: Input view */
          <div className="smart-input-section">
            <div className="smart-field-group">
              <div className="smart-field-label-row">
                <label htmlFor="smart-prompt-input" className="smart-field-label">
                  O que você gostaria de criar ou atualizar?
                </label>
                <span className="smart-field-badge">Linguagem Natural</span>
              </div>

              <div className="smart-textarea-wrapper">
                <textarea
                  id="smart-prompt-input"
                  className="smart-cmd-textarea"
                  placeholder="Exemplo: 'treino de perna', 'Adicione um treino de costas na quarta', 'ajuste as calorias para 2.600 kcal'..."
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setError(''); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void handleAnalyze();
                    }
                  }}
                  rows={4}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Realtime JEV Suggestions */}
            {realtimeJev && realtimeJev.pills.length > 0 && (
              <div className="jev-realtime-card">
                <div className="jev-realtime-card-header">
                  <div className="jev-realtime-title">
                    <Zap size={14} className="jev-zap-icon" />
                    <strong>Sugestões Instantâneas JEV ({realtimeJev.latencyMs}ms)</strong>
                  </div>
                  <span className="jev-confidence-pill">
                    {Math.round(realtimeJev.confidence * 100)}% de precisão
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
                      <Plus size={12} />
                      <span>{pill.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Inspiration Templates */}
            <div className="smart-templates-container">
              <span className="smart-templates-title">SUGESTÕES RÁPIDAS PARA COMEÇAR</span>
              <div className="smart-templates-grid">
                {examplePrompts.map(ex => (
                  <button
                    key={ex.title}
                    type="button"
                    className="smart-template-chip"
                    onClick={() => { setPrompt(ex.text); setError(''); }}
                    disabled={loading}
                  >
                    <span className="smart-template-name">{ex.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="error" role="alert" style={{ marginTop: '14px', marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Approval View */
          <div className="smart-approval-section">
            {/* JEV Decision Hero Banner */}
            <div className="jev-decision-hero">
              <div className="jev-decision-hero-top">
                <div className="jev-brand-badge">
                  <span className="jev-dot-pulsing" />
                  <span>Decisão Calibrada · TypeSafe JEV</span>
                </div>

                {planResult.jevDecision?.confidence && (
                  <span className="jev-confidence-hero-tag">
                    {Math.round(planResult.jevDecision.confidence * 100)}% Confiança
                  </span>
                )}
              </div>

              <h3 className="jev-summary-headline">{planResult.summary}</h3>

              <div className="jev-intent-meta">
                <span>Escopo identificado: <strong>{planResult.jevDecision?.intent || 'Operação inteligente'}</strong></span>
                {planResult.jevDecision?.choiceDetails && (
                  <span className="jev-choice-detail">({planResult.jevDecision.choiceDetails})</span>
                )}
              </div>
            </div>

            {/* Header with counter and Select All */}
            <div className="smart-cards-header-bar">
              <div className="smart-cards-counter">
                <strong>Campos Propostos</strong>
                <span className="smart-count-pill">
                  {selectedCount} de {cards.length} selecionados
                </span>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => handleSelectAll(selectedCount < cards.length)}
              >
                {selectedCount < cards.length ? 'Selecionar todos' : 'Desmarcar todos'}
              </button>
            </div>

            {error && (
              <div className="error" role="alert" style={{ margin: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Smart Cards List */}
            <div className="smart-cards-scroll-list">
              {cards.map(card => (
                <div
                  key={card.id}
                  className={`smart-card-item ${card.selected ? 'is-selected' : ''}`}
                  onClick={() => toggleCard(card.id)}
                >
                  <div className="smart-card-check-wrap">
                    <input
                      type="checkbox"
                      className="smart-card-checkbox-input"
                      checked={card.selected}
                      onChange={() => toggleCard(card.id)}
                      onClick={e => e.stopPropagation()}
                      aria-label={`Selecionar ${card.title}`}
                    />
                  </div>

                  <div className={`smart-card-avatar ${card.icon}`}>
                    {renderCardIcon(card.icon)}
                  </div>

                  <div className="smart-card-content">
                    <div className="smart-card-content-top">
                      <h4 className="smart-card-title">{card.title}</h4>
                      <span className="smart-card-type-badge">{card.badge}</span>
                    </div>

                    <p className="smart-card-subtitle">{card.subtitle}</p>

                    {(card.before || card.after) && (
                      <div className="smart-diff-row">
                        {card.before && (
                          <span className="smart-diff-tag before">
                            <small>Antes:</small> {card.before}
                          </span>
                        )}
                        {card.before && card.after && (
                          <span className="smart-diff-arrow">→</span>
                        )}
                        {card.after && (
                          <span className="smart-diff-tag after">
                            <small>Depois:</small> {card.after}
                          </span>
                        )}
                      </div>
                    )}

                    {card.details && card.details.length > 0 && (
                      <ul className="smart-card-details-list">
                        {card.details.slice(0, 6).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                        {card.details.length > 6 && (
                          <li className="smart-card-details-more">
                            +{card.details.length - 6} outros itens...
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="modal-footer">
        {!planResult ? (
          <>
            <button
              type="button"
              className="button secondary"
              onClick={onOpenAuditLogs}
            >
              <History size={16} />
              <span>Histórico & Reversão</span>
            </button>

            <button
              type="button"
              className="button primary"
              disabled={loading || !prompt.trim()}
              onClick={handleAnalyze}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Planejando com IA & JEV...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Analisar e Planejar</span>
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <div className="smart-footer-guarantee">
              <ShieldCheck size={16} className="smart-shield-icon" />
              <span>Salvo com reversão garantida no histórico</span>
            </div>

            <div className="smart-footer-button-group">
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
                <span>Aprovar e Aplicar {selectedCount > 0 ? `(${selectedCount})` : ''}</span>
              </button>
            </div>
          </>
        )}
      </footer>
    </Modal>
  );
}
