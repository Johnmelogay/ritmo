import { CONFIG } from './config.js';
import { type AppState, type Meal, type Ingredient, today, uid, foods, ingredient } from '../../src/domain.js';
import { APP_MAP, COACH_RULES, buildDataContext, buildMemoryBlock, recentConversation } from '../../src/aiContext.js';
import { stripGreeting } from '../../src/aiMemory.js';

export interface CoachAction {
  type: 'WATER' | 'MEAL' | 'SESSION' | 'NONE';
  waterMl?: number;
  meal?: {
    name: string;
    items: Array<{ name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number }>;
  };
  session?: {
    planName: string;
    notes?: string;
  };
}

export interface CoachWhatsAppResponse {
  message: string;
  action?: CoachAction;
  dailyNote?: string;
  facts?: string[];
}

/**
 * Executes a conversational turn with Gemini 2.5 Flash using the exact
 * same context, rules, memory block, and data limits as the web app.
 */
export async function talkWithCoach(
  state: AppState,
  userMessage: string,
  mediaData?: { mimeType: string; data: string }
): Promise<CoachWhatsAppResponse> {
  const day = today();
  const memoryBlock = buildMemoryBlock(state.aiMemory, day);
  const dataContext = buildDataContext(state, day, []);
  const conversation = recentConversation(state.chat);

  const prompt = `${memoryBlock}

DADOS ATUAIS DO USUÁRIO NO RITMO (tempo real):
${dataContext}

HISTÓRICO RECENTE:
${conversation}

MENSAGEM RECEBIDA PELO WHATSAPP:
"${userMessage}"

INSTRUÇÕES DO COACH:
1. Responda em português de forma direta, acolhedora e motivadora, respeitando estritamente COACH_RULES (SEM saudações repetitivas como "Olá!", "Oi, tudo bem?").
2. Se a mensagem relatar ingestão de água (ex.: "bebi 500ml", "tomei uma garrafa de 600ml", "mais 300ml"), preencha o campo action com type: "WATER" e waterMl.
3. Se a mensagem descrever uma refeição consumida (ex.: "almocei 180g de frango e arroz", "comi 3 ovos e uma banana"), preencha action com type: "MEAL", estimando os gramas e macros dos alimentos (P, C, G e kcal).
4. Se o usuário confirmar treino concluído (ex.: "treino feito", "concluí o treino A"), preencha action com type: "SESSION".
5. Extraia dailyNote (resumo conciso do estado de hoje) e facts (fatos duradouros novos sobre o usuário, se houver).`;

  const parts: Array<Record<string, any>> = [{ text: prompt }];
  if (mediaData) {
    parts.push({
      inlineData: {
        mimeType: mediaData.mimeType,
        data: mediaData.data
      }
    });
  }

  let rawText = '';

  if (CONFIG.geminiApiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(CONFIG.geminiApiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: COACH_RULES }, { text: APP_MAP }]
          },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                answer: { type: 'STRING' },
                dailyNote: { type: 'STRING' },
                facts: { type: 'ARRAY', items: { type: 'STRING' } },
                action: {
                  type: 'OBJECT',
                  properties: {
                    type: { type: 'STRING', enum: ['WATER', 'MEAL', 'SESSION', 'NONE'] },
                    waterMl: { type: 'NUMBER' },
                    mealName: { type: 'STRING' },
                    mealItems: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          name: { type: 'STRING' },
                          grams: { type: 'NUMBER' },
                          kcal: { type: 'NUMBER' },
                          protein: { type: 'NUMBER' },
                          carbs: { type: 'NUMBER' },
                          fat: { type: 'NUMBER' }
                        },
                        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat']
                      }
                    },
                    sessionPlanName: { type: 'STRING' },
                    sessionNotes: { type: 'STRING' }
                  },
                  required: ['type']
                }
              },
              required: ['answer']
            }
          }
        })
      });

      if (res.ok) {
        const json = await res.json();
        rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const errText = await res.text();
        console.warn(`Gemini falhou (${res.status}), usando OpenAI como contingência...`, errText);
      }
    } catch (e) {
      console.warn('Erro ao conectar ao Gemini, usando contingência...', e);
    }
  }

  // Fallback to OpenAI gpt-4o-mini if Gemini didn't return text
  if (!rawText && CONFIG.openaiApiKey) {
    const openaiMessages: any[] = [
      {
        role: 'system',
        content: `${COACH_RULES}\n${APP_MAP}\nRetorne SEMPRE um JSON válido com a estrutura:
{
  "answer": "sua resposta em português direto, sem saudação formal",
  "dailyNote": "nota diária sobre o usuário ou vazio",
  "facts": ["fatos novos aprendidos sobre o usuário"],
  "action": {
    "type": "WATER" | "MEAL" | "SESSION" | "NONE",
    "waterMl": 500,
    "mealName": "Nome da refeição",
    "mealItems": [{"name": "Alimento", "grams": 100, "kcal": 150, "protein": 20, "carbs": 10, "fat": 2}],
    "sessionPlanName": "Nome do treino",
    "sessionNotes": "observações"
  }
}`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    });

    if (oaiRes.ok) {
      const oaiJson = await oaiRes.json();
      rawText = oaiJson?.choices?.[0]?.message?.content || '';
    } else {
      const oaiErr = await oaiRes.text();
      console.error('OpenAI error:', oaiErr);
      throw new Error(`Falha nos provedores de IA (Gemini e OpenAI: ${oaiRes.status})`);
    }
  }

  if (!rawText) throw new Error('Nenhum provedor de IA retornou resposta válida.');

  const parsed = JSON.parse(rawText);
  let action: CoachAction | undefined;

  if (parsed.action?.type === 'WATER' && parsed.action.waterMl > 0) {
    action = { type: 'WATER', waterMl: Math.min(parsed.action.waterMl, 3000) };
  } else if (parsed.action?.type === 'MEAL' && parsed.action.mealItems?.length) {
    action = {
      type: 'MEAL',
      meal: {
        name: parsed.action.mealName || 'Refeição via WhatsApp',
        items: parsed.action.mealItems
      }
    };
  } else if (parsed.action?.type === 'SESSION') {
    action = {
      type: 'SESSION',
      session: {
        planName: parsed.action.sessionPlanName || 'Treino do dia',
        notes: parsed.action.sessionNotes
      }
    };
  }

  return {
    message: stripGreeting(parsed.answer),
    action,
    dailyNote: parsed.dailyNote,
    facts: parsed.facts
  };
}
