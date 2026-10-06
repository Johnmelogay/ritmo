import { useState, useRef } from 'react';
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
  Camera,
  Upload,
  Trash2,
  FileImage
} from 'lucide-react';
import { type AppState } from './domain';
import {
  planSmartCommand,
  applySmartCards,
  type SmartPlanResult,
  type SmartCardChange,
  type SmartIcon,
  type AttachedMedia
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
  const [attachedImage, setAttachedImage] = useState<AttachedMedia | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function processImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecione um arquivo de imagem válido (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 15MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setAttachedImage({
        data: base64Data,
        mimeType: file.type || 'image/jpeg',
        name: file.name || 'documento_anexo.png',
        previewUrl: result,
        sizeBytes: file.size
      });
      setError('');
    };
    reader.onerror = () => {
      setError('Não foi possível ler o arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  }

  async function handleAnalyze() {
    const trimmed = prompt.trim();
    if (!trimmed && !attachedImage) {
      setError('Digite uma instrução ou anexe um print/foto (exame de bioimpedância, ficha de treino ou cardápio).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await planSmartCommand(trimmed, currentState, attachedImage);
      if (res.cards.length === 0) {
        setError('Nenhuma alteração foi identificada. Verifique se a instrução está clara ou se a imagem possui texto/tabelas legíveis.');
        return;
      }
      setPlanResult(res);
      setCards(res.cards);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha ao processar com IA.');
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
      const effectivePrompt = prompt.trim() || (attachedImage ? `Leitura de documento anexado (${attachedImage.name})` : 'Comando inteligente');
      const { nextState, logEntry } = applySmartCards(
        currentState,
        cards,
        effectivePrompt,
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
          ? 'Revise os campos identificados e aprove as alterações para seu treino, dieta ou perfil.'
          : 'Descreva treinos, dietas e metas em texto livre ou anexe prints de bioimpedância e fichas de academia.'
      }
      onClose={onClose}
      wide
    >
      <div className="modal-body" onPaste={handlePaste}>
        {!planResult ? (
          /* Step 1: Input view */
          <div className="smart-input-section">
            <div className="smart-field-group">
              <div className="smart-field-label-row">
                <label htmlFor="smart-prompt-input" className="smart-field-label">
                  O que você gostaria de criar ou atualizar?
                </label>
                <span className="smart-field-badge">Multimodal · Visão & Texto</span>
              </div>

              <div className="smart-textarea-wrapper">
                <textarea
                  id="smart-prompt-input"
                  className="smart-cmd-textarea"
                  placeholder="Exemplo: 'Meu laudo de bioimpedância está no print anexado, calcule minhas metas ideais para queima de gordura', 'Crie um treino ABC para hipertrofia', 'Ajuste minhas calorias para 2.400 kcal'..."
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

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            {/* Image attachment: Preview Card OR Upload Dropzone */}
            {attachedImage ? (
              <div className="smart-attachment-card">
                <div className="smart-attachment-left">
                  <img
                    src={attachedImage.previewUrl}
                    alt="Documento anexado"
                    className="smart-attachment-thumb"
                  />
                  <div className="smart-attachment-info">
                    <div className="smart-attachment-name-row">
                      <FileImage size={15} className="smart-attachment-icon" />
                      <strong className="smart-attachment-name">{attachedImage.name}</strong>
                      <span className="smart-attachment-badge">
                        <Sparkles size={11} /> Visão IA Ativa
                      </span>
                    </div>
                    <span className="smart-attachment-desc">
                      {attachedImage.sizeBytes ? `${Math.round(attachedImage.sizeBytes / 1024)} KB · ` : ''}
                      A IA fará a leitura de tabelas, números e exercícios deste documento.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="smart-attachment-remove-btn"
                  title="Remover anexo"
                  onClick={() => setAttachedImage(null)}
                  disabled={loading}
                >
                  <Trash2 size={15} />
                  <span>Remover</span>
                </button>
              </div>
            ) : (
              <div
                className={`smart-dropzone ${isDragging ? 'is-dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Anexar imagem de exame, bioimpedância ou ficha de treino"
              >
                <div className="smart-dropzone-content">
                  <div className="smart-dropzone-icon-wrap">
                    <Camera size={20} />
                  </div>
                  <div className="smart-dropzone-texts">
                    <span className="smart-dropzone-main">
                      <strong>Anexar print ou foto</strong> (Bioimpedância InBody, laudo, treino ou cardápio)
                    </span>
                    <span className="smart-dropzone-sub">
                      Clique para escolher, arraste o arquivo ou cole diretamente com <strong>⌘V / Ctrl+V</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="smart-dropzone-btn"
                    onClick={e => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload size={14} />
                    <span>Selecionar</span>
                  </button>
                </div>
              </div>
            )}

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
            {/* Decision Hero Banner */}
            <div className="jev-decision-hero">
              <div className="jev-decision-hero-top">
                <div className="jev-brand-badge">
                  <span className="jev-dot-pulsing" />
                  <span>Planejamento Concluído · Ritmo AI</span>
                </div>

                {planResult.jevDecision?.confidence && (
                  <span className="jev-confidence-hero-tag">
                    {Math.round(planResult.jevDecision.confidence * 100)}% Confiança
                  </span>
                )}
              </div>

              <h3 className="jev-summary-headline">{planResult.summary}</h3>

              {planResult.jevDecision?.intent && (
                <div className="jev-intent-meta">
                  <span>Escopo identificado: <strong>{planResult.jevDecision.intent}</strong></span>
                </div>
              )}
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
                            <small>Proposto:</small> {card.after}
                          </span>
                        )}
                      </div>
                    )}

                    {card.details && card.details.length > 0 && (
                      <ul className="smart-card-details-list">
                        {card.details.map((detail, idx) => (
                          <li key={idx}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="modal-footer smart-modal-footer">
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
              disabled={loading || (!prompt.trim() && !attachedImage)}
              onClick={handleAnalyze}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>{attachedImage ? 'Analisando imagem e dados...' : 'Planejando com IA...'}</span>
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
