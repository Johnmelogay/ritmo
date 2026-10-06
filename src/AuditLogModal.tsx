import { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  CheckCircle,
  Clock,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';
import { type AppState } from './domain';
import {
  getAuditLogs,
  revertAuditEntry,
  reapplyAuditEntry,
  clearAuditLogs,
  type AuditLogEntry
} from './auditLog';
import { Modal } from './components';

interface AuditLogModalProps {
  currentState: AppState;
  onRestoreState: (restored: AppState, message: string) => void;
  onClose: () => void;
}

export function AuditLogModal({
  currentState,
  onRestoreState,
  onClose
}: AuditLogModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLogs(getAuditLogs());
  }, []);

  function handleRevert(entry: AuditLogEntry) {
    if (confirm(`Deseja reverter as alterações feitas por:\n"${entry.prompt}"?`)) {
      const res = revertAuditEntry(entry.id, currentState);
      if (res.success && res.restoredState) {
        onRestoreState(res.restoredState, 'Alterações revertidas com sucesso.');
        setLogs(getAuditLogs());
      } else {
        alert(res.error || 'Não foi possível reverter esta alteração.');
      }
    }
  }

  function handleReapply(entry: AuditLogEntry) {
    const res = reapplyAuditEntry(entry.id, currentState);
    if (res.success && res.restoredState) {
      onRestoreState(res.restoredState, 'Alterações reaplicadas com sucesso.');
      setLogs(getAuditLogs());
    } else {
      alert(res.error || 'Não foi possível reaplicar esta alteração.');
    }
  }

  function handleClear() {
    if (confirm('Deseja limpar todo o histórico de logs de alterações? Esta ação não pode ser desfeita.')) {
      clearAuditLogs();
      setLogs([]);
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  return (
    <Modal
      title="Histórico & Reversão de IA"
      subtitle="Auditoria de todas as operações realizadas via comandos inteligentes. Reversão segura em 1 clique."
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        {logs.length === 0 ? (
          <div className="audit-empty-state">
            <div className="audit-empty-icon">
              <History size={34} />
            </div>
            <h4>Nenhuma alteração registrada</h4>
            <p>
              Quando você utilizar comandos inteligentes com IA para adicionar ou modificar treinos e dietas,
              cada alteração será salva aqui com um snapshot para desfazer a qualquer momento.
            </p>
          </div>
        ) : (
          <div className="audit-logs-section">
            <div className="audit-logs-header-bar">
              <span className="audit-logs-count-badge">
                {logs.length} operação(ões) registrada(s)
              </span>

              <button
                type="button"
                className="text-button danger"
                onClick={handleClear}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={13} />
                <span>Limpar histórico</span>
              </button>
            </div>

            <div className="audit-logs-scroll-list">
              {logs.map(entry => {
                const isExpanded = expandedId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`audit-entry-card ${entry.status === 'reverted' ? 'is-reverted' : ''}`}
                  >
                    <div className="audit-entry-top">
                      <div className="audit-entry-meta">
                        <Clock size={13} />
                        <span>{formatTime(entry.timestamp)}</span>
                        {entry.jevDecision && (
                          <span className="audit-jev-badge">
                            JEV ({Math.round(entry.jevDecision.confidence * 100)}%)
                          </span>
                        )}
                      </div>

                      <span className={`audit-status-tag ${entry.status}`}>
                        {entry.status === 'applied' ? 'Ativo no app' : 'Revertido'}
                      </span>
                    </div>

                    <div className="audit-prompt-quote">
                      "{entry.prompt}"
                    </div>

                    <div className="audit-changes-pills">
                      {entry.changes.map((c, i) => (
                        <span key={i} className="audit-change-chip">
                          <CheckCircle size={12} className="audit-check-icon" />
                          <strong>{c.label}</strong>
                          {c.after && <small className="audit-after-text">({c.after})</small>}
                        </span>
                      ))}
                    </div>

                    {isExpanded && (
                      <div className="audit-expanded-details">
                        <strong className="audit-details-title">Detalhes das alterações:</strong>
                        {entry.changes.map((c, i) => (
                          <div key={i} className="audit-detail-row">
                            • <strong>{c.label}:</strong> {c.description}
                            {c.before && <span className="diff-before"> (Antes: {c.before})</span>}
                            {c.after && <span className="diff-after"> ➔ (Depois: {c.after})</span>}
                          </div>
                        ))}
                        {entry.revertedAt && (
                          <div className="audit-reverted-note">
                            Revertido em: {formatTime(entry.revertedAt)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="audit-entry-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        {isExpanded ? (
                          <>Menos detalhes <ChevronUp size={13} /></>
                        ) : (
                          <>Ver detalhes <ChevronDown size={13} /></>
                        )}
                      </button>

                      {entry.status === 'applied' ? (
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: '7px 12px', fontSize: '11px' }}
                          onClick={() => handleRevert(entry)}
                        >
                          <RotateCcw size={13} />
                          <span>Reverter Alteração</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: '7px 12px', fontSize: '11px' }}
                          onClick={() => handleReapply(entry)}
                        >
                          <ArrowRight size={13} />
                          <span>Reaplicar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer className="modal-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7a8e71', fontSize: '11px' }}>
          <ShieldCheck size={15} color="#285b49" />
          <span>Auditoria local · Todas as alterações de estado possuem snapshot seguro</span>
        </div>

        <button type="button" className="button secondary" onClick={onClose}>
          Fechar
        </button>
      </footer>
    </Modal>
  );
}
