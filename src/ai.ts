import { z } from 'zod';
import { foods, ingredient, uid, type AppState, type Ingredient, type Meal } from './domain';
import { bodyFields, type BioDraft } from './bioimpedance';

export function getGeminiKey(): string {
  return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ||
    localStorage.getItem('ritmo_gemini_key')?.trim() || '';
}

export function getTypeSafeKey(): string {
  return (import.meta.env.VITE_TYPESAFE_API_KEY as string | undefined)?.trim() ||
    localStorage.getItem('ritmo_typesafe_key')?.trim() || '';
}

export function getUsdaKey(): string {
  return (import.meta.env.VITE_USDA_API_KEY as string | undefined)?.trim() ||
    localStorage.getItem('ritmo_usda_key')?.trim() || '';
}

export function getAiStatus() {
  const gemini = Boolean(getGeminiKey());
  const typesafe = Boolean(getTypeSafeKey());
  const usda = Boolean(getUsdaKey());
  return {
    gemini,
    typesafe,
    usda,
    ready: gemini || typesafe
  };
}

export function saveLocalKeys(keys: { gemini?: string; typesafe?: string; usda?: string }) {
  if (keys.gemini !== undefined) localStorage.setItem('ritmo_gemini_key', keys.gemini.trim());
  if (keys.typesafe !== undefined) localStorage.setItem('ritmo_typesafe_key', keys.typesafe.trim());
  if (keys.usda !== undefined) localStorage.setItem('ritmo_usda_key', keys.usda.trim());
}

export const estimateSchema = z.object({
  description: z.string(),
  items: z.array(z.object({
    foodId: z.string(),
    name: z.string(),
    grams: z.number().positive().max(10000),
    minGrams: z.number().nonnegative(),
    maxGrams: z.number().positive().max(10000),
    estimated: z.boolean(),
    kcal: z.number().nonnegative(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
    source: z.string().optional()
  })).max(25),
  questions: z.array(z.string()).max(3),
  notes: z.string()
});
export type EstimateResult = z.infer<typeof estimateSchema>;

/**
 * Estima alimentos, porções e nutrientes via Google Gemini 2.5 Flash
 * utilizando entrada de texto, foto ou gravação de áudio.
 */
export async function estimateMeal(input: {
  text?: string;
  media?: { data: string; mimeType: string };
}): Promise<{
  description: string;
  items: Ingredient[];
  questions: string[];
  notes: string;
}> {
  const key = getGeminiKey();
  if (!key) {
    throw new Error('Chave do Google Gemini não configurada. Adicione sua chave em API_KEYS.env ou no Perfil.');
  }

  const parts: Array<Record<string, unknown>> = [];

  const catalogSummary = foods.map(f => `${f.id}: ${f.name} (por 100g: ${f.kcal}kcal, ${f.protein}g P, ${f.carbs}g C, ${f.fat}g G)`).join('\n');

  const systemInstruction = `Você é um nutricionista esportivo de precisão que analisa refeições brasileiras.
Catálogo padrão pré-existente (use o foodId se corresponder):
${catalogSummary}

Instruções:
1. Identifique cada alimento da refeição fornecida (seja por texto, imagem ou áudio).
2. Estime o peso consumido em gramas (grams), além de faixas de incerteza plausíveis (minGrams e maxGrams).
3. Calcule kcal, protein (proteína em g), carbs (carboidratos em g) e fat (gordura em g) correspondentes à porção total informada/estimada.
4. Se o alimento corresponder a um item do catálogo acima, use o mesmo foodId. Se for outro alimento, crie um identificador claro (ex.: "salmon", "whey_protein", "feijoada") e forneça a composição nutricional calculada da porção.
5. Em "questions", faça 1 ou 2 perguntas de alto impacto inspiradas no método de múltiplas passagens (ex.: "Foi usado óleo no preparo?", "O leite era desnatado ou integral?").
6. Em "notes", detalhe hipóteses assumidas (ex.: cozido vs. cru, porção média caseira).
Retorne estritamente o JSON especificado.`;

  parts.push({ text: systemInstruction });

  if (input.text?.trim()) {
    parts.push({ text: `Descrição da refeição pelo usuário:\n${input.text.trim()}` });
  }

  if (input.media?.data) {
    parts.push({
      inlineData: {
        mimeType: input.media.mimeType,
        data: input.media.data
      }
    });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            description: { type: 'STRING' },
            items: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  foodId: { type: 'STRING' },
                  name: { type: 'STRING' },
                  grams: { type: 'NUMBER' },
                  minGrams: { type: 'NUMBER' },
                  maxGrams: { type: 'NUMBER' },
                  estimated: { type: 'BOOLEAN' },
                  kcal: { type: 'NUMBER' },
                  protein: { type: 'NUMBER' },
                  carbs: { type: 'NUMBER' },
                  fat: { type: 'NUMBER' },
                  source: { type: 'STRING' }
                },
                required: ['foodId', 'name', 'grams', 'minGrams', 'maxGrams', 'estimated', 'kcal', 'protein', 'carbs', 'fat']
              }
            },
            questions: { type: 'ARRAY', items: { type: 'STRING' } },
            notes: { type: 'STRING' }
          },
          required: ['description', 'items', 'questions', 'notes']
        }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let msg = `Falha na API Gemini (${response.status})`;
    try {
      const parsedErr = JSON.parse(errText);
      if (parsedErr?.error?.message) msg = `Gemini: ${parsedErr.error.message}`;
    } catch { /* use generic msg */ }
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('O Gemini não retornou conteúdo para esta refeição.');

  const parsed = estimateSchema.parse(JSON.parse(rawText));

  // Converte em ingredientes da aplicação
  const items: Ingredient[] = parsed.items.map(item => {
    const match = foods.find(f => f.id === item.foodId);
    if (match) {
      return ingredient(match, item.grams, item.estimated, item.minGrams, item.maxGrams);
    }
    return {
      foodId: item.foodId || uid(),
      name: item.name,
      grams: Number(item.grams),
      minGrams: Number(item.minGrams),
      maxGrams: Number(item.maxGrams),
      estimated: Boolean(item.estimated),
      kcal: Math.round(Number(item.kcal) * 10) / 10,
      protein: Math.round(Number(item.protein) * 10) / 10,
      carbs: Math.round(Number(item.carbs) * 10) / 10,
      fat: Math.round(Number(item.fat) * 10) / 10,
      source: item.source || 'Gemini 2.5 Flash · Estimativa'
    };
  });

  return {
    description: parsed.description,
    items,
    questions: parsed.questions,
    notes: parsed.notes
  };
}

/**
 * Avaliação calibrada via TypeSafe / Jev para tomadas de decisão delimitadas.
 */
export async function evaluateJev(stateDescription: string, questions: Record<string, unknown>) {
  const key = getTypeSafeKey();
  if (!key) return null;

  // Usa proxy em dev ou chamada direta
  const url = import.meta.env.DEV ? '/api/typesafe/v1/systemone' : 'https://api.typesafe.ai/v1/systemone';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: stateDescription,
        questions
      })
    });

    if (!res.ok) {
      console.warn('TypeSafe Jev retornou status', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('Não foi possível conectar ao TypeSafe Jev:', err);
    return null;
  }
}

/**
 * Gera a revisão diária e recomendações unindo TypeSafe / Jev (decisão) e Gemini (linguagem).
 */
export async function dailyCoach(state: AppState, date: string): Promise<{
  title: string;
  body: string;
  source: string;
}> {
  const geminiKey = getGeminiKey();
  const jevKey = getTypeSafeKey();

  if (!geminiKey && !jevKey) {
    throw new Error('Configure as chaves do Gemini ou TypeSafe em API_KEYS.env para gerar a revisão com IA.');
  }

  const meals = state.meals.filter(m => m.date === date);
  const recovery = state.recovery.find(r => r.date === date);
  const sessions = state.sessions.filter(s => s.date === date && s.finishedAt);
  const totalNutrients = meals.flatMap(m => m.items).reduce((acc, i) => ({
    kcal: acc.kcal + i.kcal,
    protein: acc.protein + i.protein,
    carbs: acc.carbs + i.carbs,
    fat: acc.fat + i.fat
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const summary = `
Data: ${date}
Perfil do usuário:
- Nome: ${state.profile.name || 'Você'}
- Objetivo: ${state.profile.goal}
- Meta diária de calorias: ${state.profile.calories} kcal
- Meta de proteína: ${state.profile.protein} g (Carboidratos: ${state.profile.carbs}g, Gorduras: ${state.profile.fat}g)
- Peso meta: ${state.profile.targetWeight} kg

Registros de hoje (${date}):
- Calorias consumidas registradas: ${Math.round(totalNutrients.kcal)} kcal (${meals.length} refeições)
- Proteína consumida: ${Math.round(totalNutrients.protein)} g (Faltam: ${Math.max(0, Math.round(state.profile.protein - totalNutrients.protein))} g)
- Carboidratos: ${Math.round(totalNutrients.carbs)} g, Gordura: ${Math.round(totalNutrients.fat)} g
- Sono registrado: ${recovery ? `${recovery.sleep} horas, energia: ${recovery.energy}/10, dor muscular: ${recovery.soreness}/10` : 'Não registrado'}
- Treinos concluídos: ${sessions.length > 0 ? sessions.map(s => s.name).join(', ') : 'Nenhum treino concluído hoje'}
`;

  // 1. Decisão com TypeSafe Jev (se disponível)
  let jevDecision: { focus?: string; confidence?: number } | null = null;
  if (jevKey) {
    const jevRes = await evaluateJev(summary, {
      focus: {
        type: 'choice',
        instructions: 'Com base no sono, energia e registros do dia, qual deve ser a prioridade da orientação?',
        criteria: {
          recuperacao: 'Sono insuficiente ou baixa energia; priorizar descanso ou ajuste suave',
          meta_proteica: 'Proteína abaixo da meta estabelecida; orientar próximo prato',
          celebrar_consistencia: 'Dia bem equilibrado e alinhado aos objetivos',
          planejamento: 'Faltam dados ou dia em aberto'
        }
      }
    });

    if (jevRes?.answers?.focus) {
      jevDecision = {
        focus: jevRes.answers.focus.choice,
        confidence: jevRes.answers.focus.confidence
      };
    }
  }

  // 2. Síntese com Gemini (ou fallback direto)
  if (geminiKey) {
    const prompt = `Você é o treinador pessoal e conselheiro nutricional do app Ritmo.
Analise os dados do usuário para hoje:
${summary}
${jevDecision ? `\nDecisão prévia do modelo TypeSafe Jev: Foco recomendado = "${jevDecision.focus}" (confiança: ${Math.round((jevDecision.confidence ?? 1) * 100)}%).` : ''}

Escreva uma análise diária construtiva, humana, respeitosa e sem bajulação.
Regras:
1. Comece reconhecendo os fatos concretos do dia (o que foi registrado ou se faltam registros).
2. Forneça uma sugestão prática imediata para o restante do dia ou para amanhã.
3. Não faça alegações médicas ou diagnósticas.
Retorne um JSON com:
- "title": título curto em português (até 6 palavras)
- "body": texto em português claro, dividido em 2 parágrafos curtos.
`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              body: { type: 'STRING' }
            },
            required: ['title', 'body']
          }
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          title: parsed.title,
          body: parsed.body,
          source: jevDecision ? 'Análise combinada Gemini 2.5 Flash + Jev 1.13' : 'Gemini 2.5 Flash · Revisão diária'
        };
      }
    }
  }

  // Fallback se apenas Jev respondeu ou se houve falha no Gemini
  if (jevDecision) {
    const focusTitles: Record<string, string> = {
      recuperacao: 'Hora de priorizar sua recuperação',
      meta_proteica: 'Atenção à proteína do dia',
      celebrar_consistencia: 'Ótima consistência hoje',
      planejamento: 'Construindo o ritmo do seu dia'
    };
    return {
      title: focusTitles[jevDecision.focus ?? 'planejamento'] || 'Revisão do dia',
      body: `Avaliação do dia concluída com ${Math.round((jevDecision.confidence ?? 1) * 100)}% de confiança. Continue registrando suas refeições e treinos para enriquecer seu histórico.`,
      source: 'TypeSafe Jev 1.13'
    };
  }

  throw new Error('Não foi possível gerar a revisão com os provedores de IA.');
}

/**
 * Extrai todos os campos de um laudo ou tela de bioimpedância usando Gemini 2.5 Flash Vision.
 */
export async function extractBioimpedanceWithGemini(file: File | Blob): Promise<{
  draft: BioDraft;
  warnings: string[];
}> {
  const key = getGeminiKey();
  if (!key) throw new Error('Chave do Google Gemini não encontrada.');

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const prompt = `Você é um especialista em leitura de exames de bioimpedância (InBody, Tanita, Xiaomi, Omron, etc.).
Analise esta imagem de laudo de bioimpedância ou balança inteligente e extraia todos os números e informações legíveis.

Campos a extrair:
- date: Data do exame no formato YYYY-MM-DD (se não encontrar ano, use o ano atual).
- measurementTime: Horário no formato HH:MM (se presente).
- weight: Peso corporal total em kg (obrigatório).
- fat: Percentual de gordura corporal (%)
- fatMass: Massa de gordura em kg
- muscle: Massa muscular em kg
- muscleType: Escolha entre "esqueletica" (se for massa muscular esquelética/SMM), "muscular" (se for massa muscular total) ou "nao-informada".
- fatFreeMass: Massa livre de gordura em kg (FFM)
- waterPercent: Percentual ou água corporal total (se % ou kg)
- visceralFat: Nível de gordura visceral (número/nível)
- basalMetabolism: Taxa metabólica basal em kcal
- waist: Circunferência da cintura em cm (se presente)
- height: Estatura/altura em cm
- bmi: Índice de massa corporal (IMC)
- device: Modelo ou marca do aparelho (ex: "InBody 270", "Tanita RD-953")

Se um campo numérico não estiver legível ou não existir no laudo, retorne null.
Retorne também um array "warnings" com notas sobre a qualidade da imagem ou dados que mereçam conferência.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: file.type || 'image/jpeg', data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            date: { type: 'STRING' },
            measurementTime: { type: 'STRING' },
            weight: { type: 'NUMBER' },
            fat: { type: 'NUMBER' },
            fatMass: { type: 'NUMBER' },
            muscle: { type: 'NUMBER' },
            muscleType: { type: 'STRING' },
            fatFreeMass: { type: 'NUMBER' },
            waterPercent: { type: 'NUMBER' },
            visceralFat: { type: 'NUMBER' },
            basalMetabolism: { type: 'NUMBER' },
            waist: { type: 'NUMBER' },
            height: { type: 'NUMBER' },
            bmi: { type: 'NUMBER' },
            device: { type: 'STRING' },
            warnings: { type: 'ARRAY', items: { type: 'STRING' } }
          },
          required: ['weight']
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Falha ao ler bioimpedância com Gemini (${response.status})`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Nenhum dado retornado pelo Gemini para esta imagem.');

  const parsed = JSON.parse(rawText);

  const draft: BioDraft = {
    date: parsed.date || new Date().toISOString().slice(0, 10),
    measurementTime: parsed.measurementTime || '',
    weight: parsed.weight ? String(parsed.weight) : '',
    fat: parsed.fat != null ? String(parsed.fat) : '',
    muscle: parsed.muscle != null ? String(parsed.muscle) : '',
    waist: parsed.waist != null ? String(parsed.waist) : '',
    fatMass: parsed.fatMass != null ? String(parsed.fatMass) : '',
    fatFreeMass: parsed.fatFreeMass != null ? String(parsed.fatFreeMass) : '',
    waterPercent: parsed.waterPercent != null ? String(parsed.waterPercent) : '',
    visceralFat: parsed.visceralFat != null ? String(parsed.visceralFat) : '',
    basalMetabolism: parsed.basalMetabolism != null ? String(parsed.basalMetabolism) : '',
    height: parsed.height != null ? String(parsed.height) : '',
    bmi: parsed.bmi != null ? String(parsed.bmi) : '',
    muscleType: (['esqueletica', 'muscular', 'nao-informada'].includes(parsed.muscleType) ? parsed.muscleType : 'nao-informada') as BioDraft['muscleType'],
    device: parsed.device || 'Extraído via Gemini Vision'
  };

  return {
    draft,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : []
  };
}
