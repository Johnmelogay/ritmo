import { HomeDashboard } from './HomeDashboard';
import { Diary } from './Diary';
import { CollapsibleCard } from './CollapsibleCard';
import { WorkoutManager } from './WorkoutManager';
import { moveToTrash } from './migration';
import { RecoveryPanel } from './RecoveryPanel';
import { TrainingSession } from './TrainingSession';
import { TrainingDashboard } from './TrainingDashboard';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Activity, LayoutDashboard, Utensils, Dumbbell, CalendarDays, TrendingUp, Settings, ChevronRight, ChevronLeft, Plus, ArrowUpRight, ArrowDownRight, Flame, Droplets, Footprints, Moon, Sparkles, Check, Clock3, MoreHorizontal, Download, Upload, Play, Pause, X, Heart, LogOut, Cloud, ShieldCheck, Camera, Mic, Type, Pencil, Trash2, ArrowRight, BookOpen, RefreshCw, WifiOff, CircleCheck, Target, Leaf, Menu, CircleHelp, CircleUserRound, Loader2, History } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { BioModal, BioPanel, BodySummary, exportBody } from './BodyImport';
import { latestBioimpedance, sortedBody } from './bioimpedance';
import { useAppStore } from './store';
import { auth, configured } from './firebase';
import { getAiStatus } from './ai';
import { AuthModal } from './AuthModal';
import { OnboardingModal } from './OnboardingModal';
import { ChatCommandModal as SmartCommandModal } from './ChatCommandModal';
import { recordAuditEntry } from './auditLog';
import { AuditLogModal } from './AuditLogModal';
import { today, dateFrom, dateKey, shiftDate, formatDate, number, uid, nutrients, dailyTotals, weekDates, monthCells, completedSets, sessionVolume, createSession, suggestions, routineInsights, exportMeals, exportSets, exportAdaptations, download, csv, stateSchema, emptyState, type AppState, type Meal, type Plan, type BodyRecord, type Recovery, type Profile, type Session, type SessionExercise } from './domain';
import { normalizeExercise, removeSessionExercise, replaceSessionExercise, type ReplaceExerciseInput } from './training';
import { Badge, DateSelector, Empty, ExerciseForm, MealModal, Modal, PlanModal, ProgressBar, SectionHead, TextLink, WeightChart } from './components';

const pages = [{ id: 'home', label: 'Visão geral', mobile: 'Hoje', icon: LayoutDashboard }, { id: 'nutrition', label: 'Alimentação', mobile: 'Dieta', icon: Utensils }, { id: 'workouts', label: 'Treinos', mobile: 'Treinos', icon: Dumbbell }, { id: 'calendar', label: 'Diário', mobile: 'Diário', icon: CalendarDays }, { id: 'progress', label: 'Minha evolução', mobile: 'Evolução', icon: TrendingUp }, { id: 'settings', label: 'Perfil e ajustes', mobile: 'Perfil', icon: CircleUserRound }] as const;
type Page = typeof pages[number]['id'];
type Dialog = 'body' | 'recovery' | 'export' | 'auth' | 'routine' | 'start' | 'addExercise' | 'smartCommand' | 'auditLog' | null;
const iconForMeal = (name: string) => name.includes('Café') ? '☀' : name === 'Almoço' ? '◒' : name === 'Lanche' ? '◐' : '☾';

function App() {
    const { state, update, user, sync, error, setError, reset, ready, importing, recoverBackup } = useAppStore(); const [page, setPage] = useState<Page>(() => pages.some(p => p.id === location.hash.slice(1)) ? location.hash.slice(1) as Page : 'home'); const [date, setDate] = useState(today()); const [mealModal, setMealModal] = useState(false); const [editMeal, setEditMeal] = useState<Meal>(); const [planModal, setPlanModal] = useState(false); const [editPlan, setEditPlan] = useState<Plan>(); const [dialog, setDialog] = useState<Dialog>(null); const [editBody, setEditBody] = useState<BodyRecord>(); const [toast, setToast] = useState(''); const [online, setOnline] = useState(navigator.onLine); const [mobileMenu, setMobileMenu] = useState(false); const [month, setMonth] = useState(() => ({ year: dateFrom(date).getFullYear(), month: dateFrom(date).getMonth() })); const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('ritmo_onboarding_completed') !== 'true');
    const active = state.sessions.find(s => !s.finishedAt); const total = dailyTotals(state, date); const meals = state.meals.filter(m => m.date === date).sort((a, b) => a.time.localeCompare(b.time)); const dates = weekDates(date); const finishedWeek = state.sessions.filter(s => dates.includes(s.date) && s.finishedAt); const body = sortedBody(state.body); const lastWeight = body.at(-1); const currentBio = latestBioimpedance(state.body); const recovery = state.recovery.find(r => r.date === date); const dailySuggestions = suggestions(state, date); const recommendation = dailySuggestions[0]; const dayPlan = state.plans.find(p => p.days.includes(dateFrom(date).getDay())) ?? state.plans[0]; const sessions = state.sessions.filter(s => s.date === date); const water = state.water[date] ?? 0;
    useEffect(() => { const hash = () => { const p = location.hash.slice(1); if (pages.some(x => x.id === p)) setPage(p as Page); }; const network = () => setOnline(navigator.onLine); const keydown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setDialog(d => d === 'smartCommand' ? null : 'smartCommand'); } }; window.addEventListener('hashchange', hash); window.addEventListener('online', network); window.addEventListener('offline', network); window.addEventListener('keydown', keydown); return () => { window.removeEventListener('hashchange', hash); window.removeEventListener('online', network); window.removeEventListener('offline', network); window.removeEventListener('keydown', keydown); }; }, []);
    useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 4500); return () => clearTimeout(id); }, [toast]);
    function nav(p: Page) { if(p==='home')setDate(today()); setPage(p); location.hash = p; setMobileMenu(false); }
    function openBio(record?: BodyRecord) { setEditBody(record); setDialog('body'); }
    function announce(message: string) { setToast(message); }
    function addMeal() { setEditMeal(undefined); setMealModal(true); }
    function saveMeal(meal: Meal) { update(s => ({ ...s, meals: [...s.meals.filter(m => m.id !== meal.id), meal], reviewed: s.reviewed.filter(d => d !== meal.date) })); announce('Refeição salva no seu diário.'); }
    function startWorkout(plan: Plan) { if (active) { nav('workouts'); return; } update(s => ({ ...s, sessions: [...s.sessions, createSession(plan, today())] })); nav('workouts'); announce('Bom treino! Sua sessão será salva a cada série.'); }
    const modifySession = useCallback((fn: (s: Session) => Session) => { if (!active) return; update(s => ({ ...s, sessions: s.sessions.map(x => x.id === active.id ? fn(x) : x) })); }, [active?.id, update]);
    function addSessionExercises(items: Session['exercises'][number][] | import('./domain').Exercise[]) {
      if (!active) return;
      const newItems = items.map(ex => ({
        ...ex,
        reason: 'Adicionado durante a sessão',
        logs: Array.from({ length: ex.sets }, () => ({ id: uid(), reps: ex.reps, load: ex.load, done: false, rir: 2 })),
      }));
      update(s => {
        const updatedSessions = s.sessions.map(x => x.id === active.id ? { ...x, exercises: [...x.exercises, ...newItems] } : x);
        let updatedPlans = s.plans;
        if (active.planId) {
          updatedPlans = s.plans.map(p => p.id === active.planId ? {
            ...p,
            exercises: [
              ...p.exercises,
              ...items.map(ex => ({
                id: ex.id || uid(),
                name: ex.name,
                muscle: ex.muscle,
                sets: ex.sets,
                reps: ex.reps,
                load: ex.load,
                rest: ex.rest,
                origin: 'usuario' as const,
              })),
            ],
            version: p.version + 1,
          } : p);
        }
        return { ...s, sessions: updatedSessions, plans: updatedPlans };
      });
      setDialog(null);
      announce('Exercício adicionado à sessão e salvo na ficha para as próximas semanas.');
    }
    function removeActiveExercise(exercise: SessionExercise, persistToPlan: boolean) {
      if (!active) return;
      update(s => {
        const updatedSessions = s.sessions.map(x => x.id === active.id ? removeSessionExercise(x, exercise.id) : x);
        let updatedPlans = s.plans;
        if (persistToPlan && active.planId) {
          updatedPlans = s.plans.map(p => p.id === active.planId ? {
            ...p,
            exercises: p.exercises.filter(e => e.id !== exercise.id && normalizeExercise(e.name) !== normalizeExercise(exercise.name)),
            version: p.version + 1,
          } : p);
        }
        return { ...s, sessions: updatedSessions, plans: updatedPlans };
      });
      announce(`Exercício "${exercise.name}" removido.${persistToPlan ? ' Ficha de treino atualizada.' : ''}`);
    }
    function replaceActiveExercise(exerciseId: string, replacement: ReplaceExerciseInput, persistToPlan: boolean) {
      if (!active) return;
      const orig = active.exercises.find(e => e.id === exerciseId);
      update(s => {
        const updatedSessions = s.sessions.map(x => x.id === active.id ? replaceSessionExercise(x, exerciseId, replacement) : x);
        let updatedPlans = s.plans;
        if (persistToPlan && active.planId && orig) {
          updatedPlans = s.plans.map(p => p.id === active.planId ? {
            ...p,
            exercises: p.exercises.map(e => e.id === exerciseId || normalizeExercise(e.name) === normalizeExercise(orig.name) ? {
              ...e,
              name: replacement.name.trim(),
              muscle: replacement.muscle?.trim() || e.muscle,
              load: replacement.load ?? e.load,
              reps: replacement.reps ?? e.reps,
              catalogId: replacement.catalogId,
              origin: 'usuario' as const,
            } : e),
            version: p.version + 1,
          } : p);
        }
        return { ...s, sessions: updatedSessions, plans: updatedPlans };
      });
      announce(`Exercício substituído por "${replacement.name}".${persistToPlan ? ' Salvo na ficha base.' : ''}`);
    }
    function finishWorkout() {
      if (!active) return;
      if (completedSets(active) === 0) {
        setError('Conclua pelo menos uma série ou descarte a sessão.');
        return;
      }
      update(s => {
        const finishedAt = new Date().toISOString();
        const updatedSessions = s.sessions.map(x => x.id === active.id ? { ...x, finishedAt, restEnd: null } : x);
        let updatedPlans = s.plans;
        if (active.planId) {
          const planIdx = s.plans.findIndex(p => p.id === active.planId);
          if (planIdx !== -1) {
            const targetPlan = s.plans[planIdx];
            let pExercises = [...targetPlan.exercises];
            let changed = false;
            for (const sEx of active.exercises) {
              const doneLogs = sEx.logs.filter(l => l.done && l.reps > 0);
              if (!doneLogs.length) continue;
              const maxLoad = Math.max(...doneLogs.map(l => l.load));
              const sKey = normalizeExercise(sEx.name);
              const pIdx = pExercises.findIndex(e => e.id === sEx.id || (e.catalogId && e.catalogId === sEx.catalogId) || normalizeExercise(e.name) === sKey);
              if (pIdx !== -1 && pExercises[pIdx].load !== maxLoad) {
                pExercises[pIdx] = { ...pExercises[pIdx], load: maxLoad };
                changed = true;
              }
            }
            if (changed) {
              updatedPlans = s.plans.map(p => p.id === targetPlan.id ? { ...targetPlan, exercises: pExercises, version: targetPlan.version + 1 } : p);
            }
          }
        }
        return { ...s, sessions: updatedSessions, plans: updatedPlans };
      });
      announce('Treino concluído! Cargas atualizadas na sua ficha para os próximos treinos.');
    }
    function openDay(key: string) { setDate(key); }
    function moveMonth(delta: number) { const d = new Date(month.year, month.month + delta, 1); setMonth({ year: d.getFullYear(), month: d.getMonth() }); }
    function deleteMeal(m: Meal) { if (confirm(`Excluir ${m.name} de ${formatDate(m.date)}?`)) { update(s => ({ ...s, meals: s.meals.filter(x => x.id !== m.id), reviewed: s.reviewed.filter(d => d !== m.date) })); announce('Refeição removida. O backup anterior continua válido.'); } }
    const mealList = (limit?: number) => <div className="meal-list">{(limit ? meals.slice(0, limit) : meals).map(m => { const n = nutrients(m.items); return <div className="meal-row" key={m.id}><div className={`meal-symbol ${m.name === 'Almoço' ? 'lunch' : ''}`}>{iconForMeal(m.name)}</div><button className="meal-info" onClick={() => { setEditMeal(m); setMealModal(true); }}><strong>{m.name} <span>{m.time}</span></strong><p>{m.items.map(i => i.name.split(',')[0]).join(' · ')}</p><small>{number(n.protein)} g proteína <span>·</span> {number(n.carbs)} g carbo <span>·</span> {number(n.fat)} g gordura {m.items.some(i => i.estimated) && ' · estimado'}</small></button><div className="meal-cal"><strong>{number(n.kcal)}</strong><span>kcal</span></div>{page === 'nutrition' ? <button className="icon-button" aria-label={`Excluir ${m.name}`} onClick={() => deleteMeal(m)}><Trash2 size={16} /></button> : <button className="icon-button" aria-label={`Editar ${m.name}`} onClick={() => { setEditMeal(m); setMealModal(true); }}><ChevronRight size={18} /></button>}</div>; })}{!meals.length && <Empty icon={<Utensils size={24} />} title="Seu diário começa aqui" body="Adicione uma refeição por texto, foto, áudio ou pelo catálogo." action={<button className="button secondary" onClick={addMeal}><Plus size={16} />Registrar refeição</button>} />}</div>;
    const macros = () => <div className="macro-grid">{[{ label: 'Proteínas', value: total.protein, max: state.profile.protein, color: 'green' }, { label: 'Carboidratos', value: total.carbs, max: state.profile.carbs, color: 'orange' }, { label: 'Gorduras', value: total.fat, max: state.profile.fat, color: 'purple' }].map(m => <div key={m.label}><div><span><i className={`legend-dot ${m.color}`} />{m.label}</span><strong>{number(m.value)}<small> / {m.max} g</small></strong></div><ProgressBar value={m.value} max={m.max} color={m.color} /></div>)}</div>;
    const weekChart = () => <div className="week-chart">{dates.map(d => { const value = dailyTotals(state, d).kcal; const isFuture = d > today(); return <button key={d} className={`week-bar ${d === date ? 'current' : ''}`} title={`${formatDate(d)}: ${number(value)} kcal registradas`} onClick={() => { setDate(d); nav('calendar'); setMonth({ year: dateFrom(d).getFullYear(), month: dateFrom(d).getMonth() }); }}><div className="bar-column"><div className="goal-line" /><span style={{ height: `${Math.min(100, value / state.profile.calories * 80)}%` }} className={isFuture ? 'future' : ''} /></div><span>{dateFrom(d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span><small>{value ? number(value) : '—'}</small></button>; })}</div>;
    return <div className="app-shell"><aside className={`sidebar ${mobileMenu ? 'open' : ''}`}><a className="brand" href="#home" onClick={() => nav('home')}><div className="brand-mark"><Activity size={25} /></div>ritmo<span>●</span></a><div className="sidebar-label">SEU ESPAÇO</div><nav aria-label="Navegação principal">{pages.map(p => <button key={p.id} className={`nav-item ${page === p.id ? 'active' : ''}`} onClick={() => nav(p.id)}><p.icon size={19} /><span>{p.label}</span>{page === p.id && <span className="nav-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-note"><Leaf size={21} /><strong>Seu progresso, no seu tempo.</strong><p>Pequenas escolhas.<br />Uma rotina que funciona.</p></div><button className="user-card" onClick={() => nav('settings')}><span className="avatar">{state.profile.name.slice(0, 2).toUpperCase()}</span><span><strong>{state.profile.name}</strong><small>{state.demo ? 'Perfil de demonstração' : user ? 'Conta conectada' : 'Perfil local'}</small></span><ChevronRight size={16} /></button></div></aside>
        <div className="workspace"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Abrir navegação" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22} /></button><span>Meu espaço</span><ChevronRight size={13} /><strong>{pages.find(p => p.id === page)?.label}</strong></div><div className="topbar-right"><button className="smart-cmd-nav-btn" onClick={() => setDialog('smartCommand')} title="Chat com IA (Cmd+K)"><Sparkles size={15} /><span>Chat IA</span><kbd>⌘K</kbd></button><span className="connection">{online ? <Cloud size={14} /> : <WifiOff size={14} />}<span>{online ? sync : 'Offline · dados no dispositivo'}</span></span><button className="icon-button" onClick={() => setDialog('export')} aria-label="Exportar relatórios"><Download size={18} /></button><button className="avatar small-avatar" onClick={() => nav('settings')} aria-label="Abrir perfil">{state.profile.name.slice(0, 2).toUpperCase()}</button></div></header>
            <main>{importing && <div className="account-busy" role="status"><Loader2 className="spin" /><p>Recuperação em andamento · conferindo os dados no Firebase…</p></div>}
                <div className={`page-heading ${page === 'workouts' && active ? 'workout-focus-heading' : ''}`}><div><div className="eyebrow">{page === 'home' ? formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'SEU PROGRESSO TEM CONTEXTO'}</div><h1>{page === 'home' ? `Bom te ver, ${state.profile.name === 'Você' ? 'vamos lá' : state.profile.name.split(' ')[0]}.` : page === 'nutrition' ? 'Alimentação' : page === 'workouts' ? 'Cada série conta.' : page === 'calendar' ? 'Seu diário, dia a dia.' : page === 'progress' ? 'Pequenos passos. Evolução real.' : 'Do seu jeito.'}{page === 'home' && <span className="greeting-sun">✳</span>}</h1><p>{page === 'home' ? 'Um novo dia para cuidar de você. Vamos no seu ritmo.' : page === 'nutrition' ? 'Comer bem começa com entender sua rotina.' : page === 'workouts' ? 'Seu plano, seu desempenho e espaço para se adaptar.' : page === 'calendar' ? 'Enxergue cada dia como parte de uma história maior.' : page === 'progress' ? 'Acompanhe tendências. Reconheça sua consistência.' : 'Seu perfil, suas metas e o controle dos seus dados.'}</p></div><div className="heading-actions">{page === 'home' && <button className="button secondary" onClick={() => setDialog('export')}><Download size={16} /><span>Exportar relatório</span></button>}{page === 'nutrition' && <div style={{ display: 'flex', gap: 8 }}><button className="button secondary" onClick={() => setDialog('smartCommand')}><Sparkles size={16} /><span>Ajustar com IA</span></button><button className="button primary" onClick={addMeal}><Plus size={17} />Registrar refeição</button></div>}{page === 'workouts' && <div style={{ display: 'flex', gap: 8 }}><button className="button secondary" onClick={() => setDialog('smartCommand')}><Sparkles size={16} /><span>Criar com IA</span></button><button className="button primary" onClick={() => { setEditPlan(undefined); setPlanModal(true); }}><Plus size={17} />Novo plano</button></div>}{page === 'progress' && <button className="button primary" onClick={() => openBio()}><Plus size={17} />Registrar medidas</button>}</div></div>

                {page === 'home' && <HomeDashboard state={state} onUpdate={update} onMeal={()=>{setDate(today());addMeal();}} onTrain={()=>nav('workouts')} onStart={startWorkout} onWeight={()=>{setDate(today());openBio();}} onChat={()=>setDialog('smartCommand')} onCheckin={()=>{setDate(today());setDialog('recovery');}} onDay={day=>{setDate(day);nav('calendar');}}/>}

                {page === 'nutrition' && <><div className="toolbar"><DateSelector date={date} onChange={setDate} /><span className="muted small">{state.reviewed.includes(date) ? 'Dia revisado' : 'Registros parciais · você pode revisar ao terminar'}</span><button className="button secondary" onClick={() => update(s => ({ ...s, reviewed: s.reviewed.includes(date) ? s.reviewed.filter(d => d !== date) : [...s.reviewed, date] }))}><CircleCheck size={16} />{state.reviewed.includes(date) ? 'Reabrir dia' : 'Marcar dia revisado'}</button></div><section className="card nutrition-full"><div className="intake-head"><span><Flame size={21} /> Energia registrada</span><strong>{number(total.kcal)} <small>/ {number(state.profile.calories)} kcal</small></strong></div><ProgressBar value={total.kcal} max={state.profile.calories} color="orange" />{macros()}</section><section className="card"><SectionHead title="Seu diário alimentar" subtitle={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} />{mealList()}</section><div className="info-note"><BookOpen size={18} /><p>Catálogo inicial com valores por 100 g da TACO. Rótulos e porções podem variar. <a href="https://nepa.unicamp.br/publicacoes/" target="_blank" rel="noreferrer">Consultar fonte <ArrowUpRight size={12} /></a></p></div></>}

                {page === 'workouts' && <>{active ? <TrainingSession session={active} allSessions={state.sessions} onPatch={modifySession} onFinish={finishWorkout} onAdd={() => setDialog('addExercise')} onDiscard={() => { if (confirm('Mover esta sessão para a lixeira?')) update(s => moveToTrash(s, 'session', active.id)); }} onRemoveExercise={removeActiveExercise} onReplaceExercise={replaceActiveExercise} /> : <><WorkoutManager state={state} onCreate={() => { setEditPlan(undefined); setPlanModal(true); }} onEdit={plan => { setEditPlan(plan); setPlanModal(true); }} onStart={startWorkout} onUpdate={update} onView={day => { setDate(day); setMonth({ year: dateFrom(day).getFullYear(), month: dateFrom(day).getMonth() }); nav('calendar'); }} /><details className="workout-evolution" open><summary>Evolução por exercício</summary><TrainingDashboard state={state} /></details></>}</>}

                {page === 'calendar' && <Diary state={state} date={date} onDate={setDate} onMeal={addMeal} onEditMeal={meal=>{setEditMeal(meal);setMealModal(true);}} onBody={openBio} onCheckin={()=>setDialog('recovery')} onTrain={()=>nav('workouts')} onUpdate={update}/>}

                {page === 'progress' && <><section className="card"><SectionHead title="Seu peso ao longo do tempo" subtitle="Observe a tendência e o contexto de cada medição." action={<span className="subtle-badge">kg</span>} /><div className="weight-summary"><strong>{lastWeight ? number(lastWeight.weight, 1) : '—'} <small>kg</small></strong><span>{body.length > 1 ? `${number(lastWeight!.weight - body[0].weight, 1)} kg desde o primeiro registro` : 'Comece com sua primeira pesagem'}</span></div><WeightChart points={body} /></section><div className="two-column"><BioPanel records={state.body} onAdd={() => openBio()} onEdit={openBio} /><section className="card"><SectionHead title="Aprendendo seu ritmo" subtitle="Padrões observados, sempre corrigíveis" action={<Sparkles size={19} className="green-text" />} />{!state.profile.routineConsent ? <Empty icon={<Sparkles size={24} />} title="Sua rotina pode ensinar o app" body="Ative o aprendizado em Perfil para observar horários de refeições e treinos." action={<button className="button secondary" onClick={() => nav('settings')}>Configurar aprendizado</button>} /> : routineInsights(state).length ? <div className="routine-list">{routineInsights(state).map(r => <div key={r.key}><div><Clock3 size={19} /><h3>{r.title}</h3></div><p>{r.body}</p><button className="text-button" onClick={() => { const value = prompt('Corrija esse padrão, ou digite ocultar para removê-lo:', r.title); if (value !== null) update(s => ({ ...s, routineCorrections: { ...s.routineCorrections, [r.key]: value } })); }}>Corrigir padrão<Pencil size={13} /></button></div>)}</div> : <Empty title="Estamos conhecendo sua rotina" body="Precisamos de ao menos 5 dias de almoço ou 4 sessões para mostrar um padrão observado." />}</section></div><CollapsibleCard id="progress-coach" title="Conversar sobre minha evolução" subtitle="Pergunte à IA sobre o contexto dos seus registros."><p>O chat usa os registros e as metas da conta para explicar tendências e preparar alterações que você pode revisar antes de confirmar.</p><button className="button secondary" onClick={()=>setDialog('smartCommand')}>Abrir conversa com IA</button></CollapsibleCard></>}

                {page === 'settings' && <><div className="settings-grid"><CollapsibleCard id="profile-goals" title="Perfil e metas"><form className="settings-form" key={`profile-form-${state.profile.name}-${state.profile.goal}-${state.profile.calories}-${state.profile.protein}-${state.profile.carbs}-${state.profile.fat}-${state.profile.water}-${state.profile.targetWeight}`} onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = new FormData(e.currentTarget); update(s => ({ ...s, demo: false, profile: { ...s.profile, name: String(d.get('name')), goal: String(d.get('goal')) as Profile['goal'], calories: Number(d.get('calories')), protein: Number(d.get('protein')), carbs: Number(d.get('carbs')), fat: Number(d.get('fat')), water: Number(d.get('water')), targetWeight: Number(d.get('targetWeight')), trainTime: String(d.get('trainTime')), mealTime: String(d.get('mealTime')) } })); announce('Perfil e metas atualizados.'); }}><label>Como quer ser chamado?<input name="name" defaultValue={state.profile.name} required maxLength={50} placeholder="Seu nome" /></label><label>Objetivo<select name="goal" defaultValue={state.profile.goal}>{['Perder gordura', 'Ganhar massa', 'Recomposição corporal', 'Manter peso'].map(g => <option key={g}>{g}</option>)}</select></label><div className="form-row">{[['calories', 'Energia (kcal)', 1000, 6000], ['protein', 'Proteína (g)', 30, 400], ['carbs', 'Carboidratos (g)', 0, 900], ['fat', 'Gorduras (g)', 20, 250], ['water', 'Água (ml)', 500, 6000], ['targetWeight', 'Peso de referência (kg)', 30, 300]].map(([key, label, min, max]) => <label key={key}>{label}<input name={String(key)} type="number" min={min} max={max} step="0.1" required defaultValue={Number(state.profile[key as keyof Profile])} /></label>)}</div><div className="form-row"><label>Horário preferido de treino<input type="time" name="trainTime" defaultValue={state.profile.trainTime} required /></label><label>Horário habitual do almoço<input type="time" name="mealTime" defaultValue={state.profile.mealTime} required /></label></div><button className="button primary" type="submit"><Check size={16} />Salvar perfil</button></form></CollapsibleCard><div><section className="card"><SectionHead title="Seu perfil corporal atual" subtitle="Atualizado automaticamente pela data da bioimpedância" action={<button className="text-button" onClick={() => openBio()}>Importar exame</button>} />{currentBio ? <BodySummary record={currentBio} /> : <p className="muted">Importe uma avaliação para preencher o perfil corporal.</p>}</section><CollapsibleCard id="profile-ai" title="Inteligência conectada"><div className="ai-status-strip"><div className={`ai-status-pill ${getAiStatus().deepseek ? '' : 'offline'}`}><span className="indicator" /><span>DeepSeek V4.1 Flash: {getAiStatus().deepseek ? 'Backend configurado' : 'Não configurado'}</span></div><div className={`ai-status-pill ${getAiStatus().typesafe ? '' : 'offline'}`}><span className="indicator" /><span>Outros provedores: desativados</span></div><div className={`ai-status-pill ${getAiStatus().usda ? '' : 'offline'}`}><span className="indicator" /><span>USDA: {getAiStatus().usda ? 'Ativo' : 'Opcional'}</span></div></div><label className="toggle-row"><span><strong>Análise por IA</strong><small>Autoriza enviar refeições e resumos somente ao DeepSeek. Sem Gemini, OpenAI ou Jev.</small></span><input type="checkbox" checked={state.profile.aiConsent} onChange={e => update(s => ({ ...s, profile: { ...s.profile, aiConsent: e.target.checked } }))} /></label><label className="toggle-row"><span><strong>Aprender minha rotina</strong><small>Identifica padrões nos horários registrados.</small></span><input type="checkbox" checked={state.profile.routineConsent} onChange={e => update(s => ({ ...s, profile: { ...s.profile, routineConsent: e.target.checked } }))} /></label><div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="button secondary" onClick={() => setDialog('smartCommand')}><Sparkles size={16} /> Conversar com IA</button><button type="button" className="button secondary" onClick={() => setDialog('auditLog')}><History size={16} /> Histórico & Reversão</button><button type="button" className="button secondary" onClick={() => setShowOnboarding(true)}><BookOpen size={16} /> Ver tutorial inicial</button></div></CollapsibleCard><section className="card"><SectionHead title="Conta e sincronização" action={<Cloud size={19} />} /><p className="muted">{user ? `Conectado como ${user.email}` : configured ? 'Conecte sua conta para sincronizar entre dispositivos.' : 'Firebase em modo local. Seus registros estão salvos neste navegador.'}</p>{user ? <button className="button secondary" onClick={() => void signOut(auth!)}><LogOut size={16} />Sair da conta</button> : <button className="button secondary" onClick={() => setDialog('auth')}><CircleUserRound size={16} />Conectar conta</button>}<p className="small muted">O navegador pode remover dados locais. Guarde um backup regularmente.</p></section><CollapsibleCard id="profile-data" title="Seus dados são seus"><div className="settings-actions"><button className="button secondary" onClick={() => setDialog('export')}><Download size={17} />Relatórios e backup</button><button className="text-button danger" onClick={() => { if (confirm('Apagar todos os registros deste perfil? Exporte um backup antes.')) { reset(); announce('Registros removidos. Só podem ser recuperados de um backup.'); } }}><Trash2 size={16} />Apagar registros deste perfil</button></div></CollapsibleCard><div className="install-tip"><Activity size={23} /><div><strong>Leve o Ritmo com você</strong><p>No Safari: Compartilhar → Adicionar à Tela de Início.</p></div></div></div></div><CollapsibleCard id="account-recovery" title="Conta, recuperação e backup" subtitle={user?.email??'Seus dados, preservados'}><RecoveryPanel ready={ready} recoverBackup={recoverBackup}/></CollapsibleCard></>}
                <footer className="page-footer"><span><Activity size={14} /> ritmo · Feito para acompanhar você.</span><span>Português · kg · g · kcal</span></footer></main></div>
        <nav className="bottom-nav" aria-label="Navegação móvel">{pages.map(p => <button key={p.id} className={page === p.id ? 'active' : ''} onClick={() => nav(p.id)}><p.icon size={20} /><span>{p.mobile}</span></button>)}</nav>
        {mealModal && <MealModal date={date} consent={state.profile.aiConsent} existing={editMeal} onSave={saveMeal} onClose={() => setMealModal(false)} />}
        {planModal && <PlanModal existing={editPlan} onSave={p => { update(s => ({ ...s, plans: [...s.plans.filter(x => x.id !== p.id), p] })); announce('Plano salvo. Sessões anteriores preservadas.'); }} onClose={() => { setPlanModal(false); setEditPlan(undefined); }} />}
        {dialog === 'addExercise' && <Modal title="Adicionar ao treino de hoje" subtitle="Este exercício ficará marcado com sua origem. Seu plano-base será preservado." onClose={() => setDialog(null)}><div className="modal-body"><ExerciseForm onAdd={ex => addSessionExercises([ex])} onAddMany={addSessionExercises} /></div></Modal>}
        {dialog === 'body' && <BioModal records={state.body} date={date} existing={editBody} onClose={() => setDialog(null)} onSave={(record, replaceId) => { update(s => ({ ...s, body: [...s.body.filter(b => b.id !== record.id && b.id !== replaceId), record] })); setDialog(null); announce('Avaliação salva. Perfil corporal e relatório atualizados pela data do exame.'); }} />}
        {dialog === 'recovery' && <Modal title="Como você está hoje?" subtitle="Um check-in breve para dar contexto ao seu dia." onClose={() => setDialog(null)}><form onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); const record: Recovery = { id: recovery?.id ?? uid(), date, sleep: Number(d.get('sleep')), energy: Number(d.get('energy')), soreness: Number(d.get('soreness')), notes: String(d.get('notes')) }; update(s => ({ ...s, recovery: [...s.recovery.filter(r => r.date !== date), record] })); setDialog(null); announce('Check-in salvo.'); }}><div className="modal-body"><div className="form-row"><label>Sono (horas)<input name="sleep" type="number" min="0" max="24" step="0.25" defaultValue={recovery?.sleep ?? 7} required /></label><label>Energia (1–10)<input name="energy" type="number" min="1" max="10" defaultValue={recovery?.energy ?? 7} required /></label><label>Dor muscular (0–10)<input name="soreness" type="number" min="0" max="10" defaultValue={recovery?.soreness ?? 0} required /></label></div><label>Algo diferente hoje?<textarea name="notes" defaultValue={recovery?.notes} placeholder="Rotina diferente, viagem, tempo disponível…" maxLength={1000} /></label></div><footer className="modal-footer"><span>{formatDate(date)}</span><button className="button primary">Salvar check-in</button></footer></form></Modal>}
        {dialog === 'export' && <Modal title="Seus registros, com você" subtitle="Arquivos CSV compatíveis com Excel em português e backup completo." onClose={() => setDialog(null)}><div className="modal-body export-options">{[{ name: 'Alimentação detalhada', description: 'Cada alimento, quantidade, macros e fonte.', run: () => download('ritmo-alimentacao.csv', exportMeals(state), 'text/csv;charset=utf-8') }, { name: 'Séries e treinos', description: 'Carga, repetições, RIR e autoria de cada exercício.', run: () => download('ritmo-treinos.csv', exportSets(state), 'text/csv;charset=utf-8') }, { name: 'Variações e adaptações de treinos', description: 'Substituições de exercícios, motivos e cargas do mês.', run: () => download('ritmo-adaptacoes-treino.csv', exportAdaptations(state), 'text/csv;charset=utf-8') }, { name: 'Corpo e bioimpedância', description: 'Peso, gordura, massa muscular e cintura.', run: () => download('ritmo-corpo.csv', exportBody(state.body), 'text/csv;charset=utf-8') }, { name: 'Resumo diário', description: 'Visão de todos os dias registrados e completude.', run: () => { const days = [...new Set([...state.meals.map(m => m.date), ...state.sessions.map(s => s.date), ...state.body.map(b => b.date)])].sort(); download('ritmo-dias.csv', csv([['data', 'kcal_registradas', 'proteina_g', 'carbo_g', 'gordura_g', 'treinos', 'revisado'], ...days.map(d => { const t = dailyTotals(state, d); return [d, state.meals.some(m => m.date === d) ? t.kcal : null, t.protein, t.carbs, t.fat, state.sessions.filter(s => s.date === d && s.finishedAt).length, state.reviewed.includes(d)]; })]), 'text/csv;charset=utf-8'); } }, { name: 'Backup completo (JSON)', description: 'Todos os registros, planos, perfil e configurações.', run: () => download(`ritmo-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json') }].map(e => <button key={e.name} onClick={() => { e.run(); announce('Arquivo preparado para download.'); }}><span><strong>{e.name}</strong><small>{e.description}</small></span><Download size={21} /></button>)}</div></Modal>}
        {dialog === 'auth' && <AuthModal onClose={() => setDialog(null)} onSuccess={() => { setDialog(null); announce('Conta conectada com sucesso! Sincronização ativada.'); }} />}
        {dialog === 'start' && <Modal title="Vamos encontrar seu ritmo" subtitle="Um novo perfil local, com espaço para suas metas reais." onClose={() => setDialog(null)}><form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const initial = emptyState(); initial.profile.name = String(data.get('name')); initial.profile.goal = String(data.get('goal')) as Profile['goal']; update(initial); setDialog(null); nav('settings'); announce('Perfil criado. Confira suas metas antes de começar.'); }}><div className="modal-body"><label>Como quer ser chamado?<input name="name" required maxLength={50} placeholder="Seu nome" /></label><label>O que quer construir?<select name="goal"><option>Recomposição corporal</option><option>Perder gordura</option><option>Ganhar massa</option><option>Manter peso</option></select></label><p className="muted">Um perfil vazio será criado. Em seguida você poderá informar as metas e o plano do seu profissional.</p></div><footer className="modal-footer"><span /><button className="button primary">Começar<ArrowRight size={17} /></button></footer></form></Modal>}
        {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} onOpenAuth={() => { setShowOnboarding(false); setDialog('auth'); }} />}
        {dialog === 'smartCommand' && <SmartCommandModal currentState={state} onUpdateState={(updater, log) => { const accepted = update(updater); if (accepted && log) { recordAuditEntry(log); announce('Alterações confirmadas e salvas no aparelho. Confira a sincronização.'); } return accepted; }} onClose={() => setDialog(null)} onOpenAuditLogs={() => setDialog('auditLog')} />}
        {dialog === 'auditLog' && <AuditLogModal currentState={state} onRestoreState={(restored, msg) => { update(() => restored); announce(msg); }} onClose={() => setDialog(null)} />}
        {error && <div className="global-error" role="alert"><span>{error}</span><button aria-label="Fechar aviso" onClick={() => setError('')}><X size={17} /></button></div>}{toast && <div className="toast" role="status"><CircleCheck size={18} />{toast}</div>}
    </div>;
}

export default App;
