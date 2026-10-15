import { useMemo, useRef, useState, useEffect } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { dailyCoach, getAiStatus } from './ai';
import { dailyTotals, formatDate, number, type AppState } from './domain';
import { dailyReviewContext } from './training';

export function DailyReviewPanel({ state, date }: { state: AppState; date: string }) {
  const context = useMemo(() => JSON.stringify(dailyReviewContext(state, date)), [state, date]);
  const [review, setReview] = useState<{ title: string; body: string; source: string; context: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestId.current++; }; }, []);
  useEffect(() => { requestId.current++; setBusy(false); setError(''); }, [date]);
  const total = dailyTotals(state, date);
  const hasLogs = state.meals.some(m => m.date === date) || state.sessions.some(s => s.date === date) || state.body.some(b => b.date === date) || state.recovery.some(r => r.date === date) || Boolean(state.water[date]);
  const stale = review && review.context !== context;
  async function generate() {
    if (!state.profile.aiConsent || !hasLogs) return;
    const id = ++requestId.current;
    setBusy(true); setError('');
    try {
      const result = await dailyCoach(state, date);
      if (mounted.current && requestId.current === id) setReview({ ...result, context });
    } catch { if (mounted.current && requestId.current === id) setError('Não foi possível gerar a revisão. Confira a conexão e as credenciais de IA e tente novamente. Seus registros não foram alterados.'); }
    finally { if (mounted.current && requestId.current === id) setBusy(false); }
  }
  return <section className="card daily-review-panel">
    <div className="section-head"><div><span className="eyebrow">UMA PAUSA PARA ENTENDER O DIA</span><h2>Seu dia, com contexto</h2><p>{formatDate(date)} · alimentação, treino, água, medidas e recuperação</p></div><Sparkles size={22}/></div>
    <div className="review-facts"><span>{number(total.kcal)} / {number(state.profile.calories)} kcal registradas</span><span>{number(total.protein)} / {number(state.profile.protein)} g de proteína</span><span>{state.reviewed.includes(date) ? 'Dia revisado' : 'Registros parciais'}</span></div>
    {review && !stale && <div className="review-body"><h3>{review.title}</h3><p>{review.body}</p><small>{review.source} · interpretação de IA, não prescrição</small></div>}
    {stale && <p role="status">Seus registros mudaram. Atualize a revisão para considerar os novos dados.</p>}
    {!review && <p className="muted">Uma avaliação em português com fatos do dia, progresso em relação às metas informadas e um próximo passo possível. Sem punições por metas não atingidas.</p>}
    {!hasLogs && <p className="small muted">Adicione seu primeiro registro do dia para gerar uma avaliação real.</p>}
    {!state.profile.aiConsent && <p className="small muted">Ative “Análise por IA” em Perfil. Ao gerar, o resumo dos seus registros será enviado aos provedores de IA configurados.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <button className="button primary" onClick={() => void generate()} disabled={busy || !hasLogs || !state.profile.aiConsent || !getAiStatus().ready}>{busy ? <Loader2 size={18} className="spin"/> : review ? <RefreshCw size={18}/> : <Sparkles size={18}/>} {busy ? 'Avaliando seus registros…' : review ? 'Atualizar avaliação com IA' : 'Avaliar meu dia com IA'}</button>
    <p className="small muted">Faltar um registro não significa não ter comido ou treinado. O app não mede seu déficit real nem quantifica ganho muscular diário. Nada é alterado automaticamente.</p>
  </section>;
}
