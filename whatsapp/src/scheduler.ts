import cron from 'node-cron';
import { CONFIG } from './config.js';
import { fetchCurrentState, updateMemoryAndChat } from './firestore.js';
import { today, type AppState } from '../../src/domain.js';
import { COACH_RULES, buildDataContext, buildMemoryBlock } from '../../src/aiContext.js';
import { stripGreeting } from '../../src/aiMemory.js';

interface SentNudge {
  date: string;
  type: 'morning' | 'lunch' | 'water' | 'workout' | 'evening';
}

const sentNudges: SentNudge[] = [];

function hasSentToday(type: SentNudge['type'], day: string): boolean {
  return sentNudges.some(n => n.date === day && n.type === type);
}

function markSent(type: SentNudge['type'], day: string) {
  sentNudges.push({ date: day, type });
  if (sentNudges.length > 50) sentNudges.shift();
}

/**
 * Generates an autonomous proactive check-in message using Gemini with real AppState.
 */
async function generateNudgeMessage(
  state: AppState,
  nudgeKind: 'morning' | 'lunch' | 'water' | 'workout' | 'evening'
): Promise<string> {
  const day = today();
  const memoryBlock = buildMemoryBlock(state.aiMemory, day);
  const dataContext = buildDataContext(state, day, []);

  const triggerInstructions = {
    morning: 'Envie um alinhamento matinal bem direto e motivador. Destaque se hoje tem treino (e qual plano) ou se é descanso, a meta de água e foco nas metas.',
    lunch: 'Passou do horário do almoço e o usuário ainda não registrou refeição. Lembre-o de contar o que comeu (em texto, áudio ou foto) para não perder o registro.',
    water: 'O usuário está atrasado na meta de hidratação hoje. Diga quantos ml ele bebeu até agora e incentive a tomar mais água agora.',
    workout: 'Faltam cerca de 45 minutos para o horário de treino do usuário e o treino ainda não foi registrado. Lembre o treino planejado de hoje com foco e energia.',
    evening: 'Fim do dia: faça um balanço rápido e conciso do dia (água e refeições registradas, treino). Parabenize pela constância e pergunte se falta algo antes de dormir.'
  };

  const prompt = `${memoryBlock}

DADOS ATUAIS NO RITMO:
${dataContext}

OBJETIVO DO CHECK-IN AUTÔNOMO:
${triggerInstructions[nudgeKind]}

REGRAS:
- Estilo do Ritmo: direto ao ponto, acolhedor, SEM saudações genéricas ("Olá", "Oi, tudo bem?").
- Máximo 2 a 3 frases curtas. Use emojis com moderação.
- Responda apenas o texto que deve ser enviado no WhatsApp.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(CONFIG.geminiApiKey)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: COACH_RULES }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 300 }
    })
  });

  if (!res.ok) throw new Error('Falha ao gerar mensagem proativa.');
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return stripGreeting(text.trim());
}

/**
 * Starts the autonomous cron schedule evaluator. Runs every 10 minutes.
 */
export function startAutonomousScheduler(sendMessageToSelf: (text: string) => Promise<void>) {
  console.log('⏰ Autonomous Consistency Scheduler started.');

  // Evaluates state every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const day = today();
      const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon...

      const state = await fetchCurrentState(CONFIG.userUid);
      const profile = state.profile;
      const todayWater = (state.water || []).filter(w => w.date === day).reduce((s, w) => s + w.ml, 0);
      const todayMeals = (state.meals || []).filter(m => m.date === day);
      const todaySessions = (state.sessions || []).filter(s => s.date === day);
      const plannedWorkout = state.plans.find(p => p.days.includes(dayOfWeek));

      // 1. Morning Alignment (08:00 - 08:30)
      if (hours === 8 && minutes >= 0 && minutes <= 30 && !hasSentToday('morning', day)) {
        markSent('morning', day);
        const msg = await generateNudgeMessage(state, 'morning');
        await sendMessageToSelf(`⚡ *Ritmo — Bom dia*\n${msg}`);
        await updateMemoryAndChat({ role: 'assistant', text: msg, time: now.toTimeString().slice(0, 5) });
        return;
      }

      // 2. Lunch Check (13:10 - 13:40) - only if no lunch logged
      if (hours === 13 && minutes >= 10 && minutes <= 40 && !hasSentToday('lunch', day)) {
        const hasLunch = todayMeals.some(m => m.name.toLowerCase().includes('almoço') || m.time >= '11:30');
        if (!hasLunch) {
          markSent('lunch', day);
          const msg = await generateNudgeMessage(state, 'lunch');
          await sendMessageToSelf(`🥗 *Ritmo — Almoço*\n${msg}`);
          await updateMemoryAndChat({ role: 'assistant', text: msg, time: now.toTimeString().slice(0, 5) });
          return;
        }
      }

      // 3. Water Pacing Check (15:30 - 16:00) - only if below 50%
      if (hours === 15 && minutes >= 30 && !hasSentToday('water', day)) {
        const target = profile.water || 2500;
        if (todayWater < target * 0.5) {
          markSent('water', day);
          const msg = await generateNudgeMessage(state, 'water');
          await sendMessageToSelf(`💧 *Ritmo — Hidratação*\n${msg}`);
          await updateMemoryAndChat({ role: 'assistant', text: msg, time: now.toTimeString().slice(0, 5) });
          return;
        }
      }

      // 4. Pre-Workout Nudge (~45m before trainTime, default 18:00 -> 17:15)
      const [trainH, trainM] = (profile.trainTime || '18:00').split(':').map(Number);
      const trainMinutesFromMidnight = trainH * 60 + trainM;
      const currentMinutesFromMidnight = hours * 60 + minutes;
      const diffToWorkout = trainMinutesFromMidnight - currentMinutesFromMidnight;

      if (plannedWorkout && todaySessions.length === 0 && diffToWorkout >= 30 && diffToWorkout <= 50 && !hasSentToday('workout', day)) {
        markSent('workout', day);
        const msg = await generateNudgeMessage(state, 'workout');
        await sendMessageToSelf(`🏋️ *Ritmo — Preparação para o Treino*\n${msg}`);
        await updateMemoryAndChat({ role: 'assistant', text: msg, time: now.toTimeString().slice(0, 5) });
        return;
      }

      // 5. Evening Wrap-Up (21:30 - 22:00)
      if (hours === 21 && minutes >= 30 && !hasSentToday('evening', day)) {
        markSent('evening', day);
        const msg = await generateNudgeMessage(state, 'evening');
        await sendMessageToSelf(`🌙 *Ritmo — Balanço do Dia*\n${msg}`);
        await updateMemoryAndChat({ role: 'assistant', text: msg, time: now.toTimeString().slice(0, 5) });
        return;
      }
    } catch (err) {
      console.error('Error in autonomous scheduler:', err);
    }
  });
}
