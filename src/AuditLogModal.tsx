import { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  CheckCircle,
  Clock,
  Sparkles,
  Trash2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp
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
      title="Histórico de Alterações & Reversão"
      subtitle="Auditoria completa de todas as operações e comandos com IA"
      onClose={onClose}
    >
      <div className="audit-logs-container">
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
            <History size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.5rem', color: '#e2e8f0' }}>Nenhuma alteração registrada ainda</h4>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Quando você utilizar comandos inteligentes com IA para adicionar ou modificar treinos e dietas, os registros aparecerão aqui com opção de desfazer a qualquer momento.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                {logs.length} registro(s) no histórico local
              </span>
              <button
                type="button"
                className="text-button danger"
                onClick={handleClear}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Trash2 size={13} />
                Limpar histórico
              </button>
            </div>

            <div className="audit-logs-list">
              {logs.map(entry => {
                const isExpanded = expandedId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`audit-entry-card ${entry.status === 'reverted' ? 'reverted' : ''}`}
                  >
                    <div className="audit-entry-top">
                      <div className="audit-entry-meta">
                        <Clock size={14} />
                        <span>{formatTime(entry.timestamp)}</span>
                        {entry.jevDecision && (
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.45rem',
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}>
                            JEV ({Math.round(entry.jevDecision.confidence * 100)}%)
                          </span>
                        )}
                      </div>

                      <span className={`audit-status-tag ${entry.status}`}>
                        {entry.status === 'applied' ? 'Ativo' : 'Revertido'}
                      </span>
                    </div>

                    <div className="audit-prompt-box">
                      "{entry.prompt}"
                    </div>

                    <div className="audit-changes-pills">
                      {entry.changes.map((c, i) => (
                        <span key={i} className="audit-change-chip">
                          <CheckCircle size={12} color="#10b981" />
                          <strong>{c.label}</strong>
                          {c.after && <small style={{ color: '#94a3b8' }}>({c.after})</small>}
                        </span>
                      ))}
                    </div>

                    {isExpanded && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: '#cbd5e1'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#f8fafc' }}>
                          Detalhes das alterações:
                        </div>
                        {entry.changes.map((c, i) => (
                          <div key={i} style={{ marginBottom: '0.35rem' }}>
                            • <strong>{c.label}:</strong> {c.description}
                            {c.before && <span> (Antes: {c.before})</span>}
                            {c.after && <span> ➔ (Depois: {c.after})</span>}
                          </div>
                        ))}
                        {entry.revertedAt && (
                          <div style={{ marginTop: '0.5rem', color: '#f59e0b', fontSize: '0.75rem' }}>
                            Revertido em: {formatTime(entry.revertedAt)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="audit-entry-actions">
                      <button
                        type="button"
                        className="text-button"
                        style={{ fontSize: '0.78rem', color: '#94a3b8' }}
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
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => handleRevert(entry)}
                        >
                          <RotateCcw size={14} />
                          Reverter Alterações
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => handleReapply(entry)}
                        >
                          <ArrowRight size={14} />
                          Reaplicar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
