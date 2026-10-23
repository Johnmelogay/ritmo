import { useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import type { AppState } from './domain';
import type { AuditLogEntry } from './auditLog';
import { changeStops, diffPlans, type ChangeStop, type PlanDiff } from './planDiff';

/** A proposal already computed by the AI, shown inside the app before the user confirms it. */
export interface AiPreview { baseline: string; nextState: AppState; logEntry: AuditLogEntry; count: number; diffs: PlanDiff[]; stops: ChangeStop[] }

export function buildAiPreview(current: AppState, nextState: AppState, logEntry: AuditLogEntry, count: number, baseline: string): AiPreview {
  const diffs = diffPlans(current.plans, nextState.plans);
  const planStops = changeStops(diffs);
  // Changes outside training plans (goals, macros, body) have no place to point at, so they are listed as text stops.
  const otherStops: ChangeStop[] = logEntry.changes
    .filter(change => !change.category.startsWith('workout'))
    .map((change, index) => ({ id: `other-${index}`, planId: '', title: change.label, detail: change.before || change.after ? `${change.before ?? '—'} → ${change.after ?? '—'}` : change.description }));
  return { baseline, nextState, logEntry, count, diffs, stops: [...planStops, ...otherStops] };
}

export function AiChangeBubble({ preview, index, onIndex, onConfirm, onDiscard }: { preview: AiPreview; index: number; onIndex: (index: number) => void; onConfirm: () => void; onDiscard: () => void }) {
  const total = preview.stops.length;
  const stop = preview.stops[Math.min(index, Math.max(0, total - 1))];

  // Bring the place the AI is touching into view each time the user moves to another stop.
  useEffect(() => {
    if (!stop) return;
    const id = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-change="${CSS.escape(stop.id)}"]`) ?? (stop.planId ? document.querySelector<HTMLElement>(`[data-change="plan-${CSS.escape(stop.planId)}"]`) : null);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 120);
    return () => window.clearTimeout(id);
  }, [stop]);

  return <aside className="ai-bubble" role="dialog" aria-label="Prévia das alterações da IA" aria-live="polite">
    <div className="ai-bubble-head">
      <span className="ai-bubble-orb"><Sparkles size={16} /></span>
      <div><strong>IA mexendo aqui</strong><small>{total ? `Alteração ${index + 1} de ${total}` : 'Nenhuma diferença visível'} · ainda não salva</small></div>
      <button className="icon-button" aria-label="Descartar prévia" onClick={onDiscard}><X size={18} /></button>
    </div>
    {stop && <div className="ai-bubble-body" key={stop.id}>
      <p className="ai-bubble-title">{stop.title}</p>
      <p className="ai-bubble-detail">{stop.detail}</p>
    </div>}
    <div className="ai-bubble-actions">
      <div className="ai-bubble-nav">
        <button className="icon-button" aria-label="Alteração anterior" disabled={index <= 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={18} /></button>
        <div className="ai-bubble-dots" aria-hidden="true">{preview.stops.slice(0, 12).map((s, i) => <span key={s.id} className={i === index ? 'active' : ''} />)}</div>
        <button className="icon-button" aria-label="Próxima alteração" disabled={index >= total - 1} onClick={() => onIndex(index + 1)}><ChevronRight size={18} /></button>
      </div>
      <button className="button secondary" onClick={onDiscard}>Descartar</button>
      <button className="button primary" onClick={onConfirm}><Check size={17} />Confirmar {preview.count}</button>
    </div>
  </aside>;
}
