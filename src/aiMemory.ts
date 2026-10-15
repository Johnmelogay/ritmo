import { dateKey, emptyAiMemory, shiftDate, uid, type AiMemory, type AppState } from './domain';

/**
 * Written AI memory with daily housekeeping.
 * - dailyNote: running written summary of today's conversation (rewritten by the model each turn, no extra calls)
 * - history:  short dated notes from previous days, pruned to the last 7 days / ~2.4k chars
 * - facts:    durable preferences explicitly stated by the user (max 15)
 * Old chat messages are removed at day rollover; their content survives only as the written note.
 */
export const MEMORY_LIMITS = { dailyNote: 1200, historyNote: 600, historyDays: 7, historyChars: 2400, facts: 15, factChars: 180 } as const;

export const messageDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : dateKey(d); };
const clip = (text: string, max: number) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };

/** Deterministic digest when a past day has messages but no written note (e.g. legacy chat or failed note). */
function digest(messages: AppState['chat']) {
  const asks = messages.filter(m => m.role === 'user').map(m => clip(m.text, 140));
  return asks.length ? clip(`Pedidos do usuário: ${asks.join(' | ')}`, MEMORY_LIMITS.historyNote) : '';
}

function pruneHistory(history: AiMemory['history'], day: string) {
  const oldest = shiftDate(day, -MEMORY_LIMITS.historyDays);
  const kept = [...history].filter(h => h.date >= oldest && h.date < day).sort((a, b) => a.date.localeCompare(b.date));
  while (kept.reduce((sum, h) => sum + h.note.length, 0) > MEMORY_LIMITS.historyChars) kept.shift();
  return kept;
}

/** Idempotent daily cleanup. Returns the same object when nothing needs to change. */
export function rolloverMemory(state: AppState, day: string): AppState {
  const memory = state.aiMemory ?? emptyAiMemory();
  const stale = state.chat.filter(m => messageDay(m.createdAt) !== day);
  const expired = memory.history.some(h => h.date < shiftDate(day, -MEMORY_LIMITS.historyDays));
  if (memory.day === day && !stale.length && !expired) return state;

  let history = [...memory.history];
  if (memory.day && memory.day !== day && memory.dailyNote.trim()) {
    history = [...history.filter(h => h.date !== memory.day), { date: memory.day, note: clip(memory.dailyNote, MEMORY_LIMITS.historyNote) }];
  }
  const staleDays = [...new Set(stale.map(m => messageDay(m.createdAt)).filter(Boolean))];
  for (const past of staleDays) {
    if (past >= day || history.some(h => h.date === past)) continue;
    const note = digest(stale.filter(m => messageDay(m.createdAt) === past));
    if (note) history.push({ date: past, note });
  }
  return {
    ...state,
    chat: state.chat.filter(m => messageDay(m.createdAt) === day),
    aiMemory: { ...memory, day, dailyNote: memory.day === day ? memory.dailyNote : '', history: pruneHistory(history, day), updatedAt: new Date().toISOString() },
  };
}

const UNSAFE_FACT = /senha|password|token|api ?key|chave|cart[aã]o|cpf|@|https?:\/\//i;
const normalizeFact = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Merges the model's memory output. Unsafe or duplicated facts are dropped; everything is size-capped. */
export function applyMemoryUpdate(memory: AiMemory, day: string, update: { dailyNote?: string; facts?: string[] }): AiMemory {
  const facts = [...memory.facts];
  for (const raw of update.facts ?? []) {
    const text = clip(raw, MEMORY_LIMITS.factChars);
    if (!text || UNSAFE_FACT.test(text) || facts.some(f => normalizeFact(f.text) === normalizeFact(text))) continue;
    facts.push({ id: uid(), text, createdAt: new Date().toISOString() });
  }
  const dailyNote = update.dailyNote !== undefined ? clip(update.dailyNote, MEMORY_LIMITS.dailyNote) : memory.day === day ? memory.dailyNote : '';
  return { ...memory, day, dailyNote, facts: facts.slice(-MEMORY_LIMITS.facts), updatedAt: new Date().toISOString() };
}

export const removeFact = (memory: AiMemory, id: string): AiMemory => ({ ...memory, facts: memory.facts.filter(f => f.id !== id), updatedAt: new Date().toISOString() });

const GREETING = /^\s*(?:ol[áa]|oi+e?|e a[íi]|hey|bom dia|boa tarde|boa noite)(?:,?\s+[A-Za-zÀ-ÿ]+){0,2}\s*[.!?,]+\s*/i;
const SMALL_TALK = /^\s*(?:tudo bem|tudo certo|como vai|como (?:voc[êe] )?est[áa])[^.!?\n]{0,30}[?.!]+\s*/i;
/** Safety net against "Olá, tudo bem?" openings. Never returns an empty answer. */
export function stripGreeting(text: string) {
  const out = text.replace(GREETING, '').replace(SMALL_TALK, '').trim();
  if (!out) return text.trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}
