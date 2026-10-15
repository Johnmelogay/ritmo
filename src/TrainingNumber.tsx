import { memo, useEffect, useRef, useState } from 'react';
import { parseTrainingNumber } from './training';

export const TrainingNumber = memo(function TrainingNumber({ value, onCommit, label, max, integer = false }: {
  value: number; onCommit: (value: number) => void; label: string; max: number; integer?: boolean;
}) {
  const [draft, setDraft] = useState(value === 0 ? '' : String(value));
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const commitLatest = useRef(() => {});
  commitLatest.current = () => {
    const parsed = parseTrainingNumber(draft.trim() || '0', 0, max, integer);
    if (parsed === null) { setError(true); setDraft(value === 0 ? '' : String(value)); return; }
    setDraft(parsed === 0 ? '' : String(parsed));
    if (parsed !== value) onCommit(parsed);
  };
  useEffect(() => { if (!focused.current) setDraft(value === 0 ? '' : String(value)); }, [value]);
  useEffect(() => {
    const leave = () => { if (focused.current) commitLatest.current(); };
    const visibility = () => { if (document.visibilityState === 'hidden') leave(); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return <div className="training-numeric-field"><input ref={input} aria-label={label} aria-invalid={error} title={error ? `Use um valor entre 0 e ${max}${integer ? ', inteiro' : ''}.` : undefined}
    type="text" inputMode={integer ? 'numeric' : 'decimal'} autoComplete="off" enterKeyHint="done" placeholder="0" value={draft}
    onFocus={event => { focused.current = true; setEditing(true); event.currentTarget.select(); }}
    onChange={event => { setDraft(event.target.value); setError(false); }}
    onBlur={() => {
      focused.current = false;
      setEditing(false);
      commitLatest.current();
    }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />{editing&&<button className="numeric-done button primary" type="button" onPointerDown={event=>{event.preventDefault();input.current?.blur();}} onClick={()=>input.current?.blur()}>Concluir digitação</button>}</div>;
});
