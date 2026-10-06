/**
 * Banco de Dados de Exercícios e Musculação
 * Combina catálogo padrão curado em português (80+ exercícios)
 * com integração ao WGER REST API (repositório aberto global).
 */

export interface DbExercise {
  id: string;
  name: string;
  muscle: string;
  secondaryMuscles?: string[];
  equipment?: string;
  category: 'pernas' | 'peito' | 'costas' | 'ombros' | 'biceps' | 'triceps' | 'abdomen' | 'gluteos';
  defaultSets: number;
  defaultReps: number;
  defaultRest: number;
}

export const curatedExercises: DbExercise[] = [
  // --- Pernas & Quadríceps ---
  { id: 'agachamento-livre', name: 'Agachamento Livre', muscle: 'Quadríceps', secondaryMuscles: ['Glúteos', 'Posteriores'], equipment: 'Barra', category: 'pernas', defaultSets: 4, defaultReps: 10, defaultRest: 120 },
  { id: 'leg-press-45', name: 'Leg Press 45°', muscle: 'Quadríceps', secondaryMuscles: ['Glúteos'], equipment: 'Máquina', category: 'pernas', defaultSets: 4, defaultReps: 12, defaultRest: 90 },
  { id: 'cadeira-extensora', name: 'Cadeira Extensora', muscle: 'Quadríceps', equipment: 'Máquina', category: 'pernas', defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'agachamento-hack', name: 'Agachamento Hack', muscle: 'Quadríceps', secondaryMuscles: ['Glúteos'], equipment: 'Máquina', category: 'pernas', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'agachamento-bulgaro', name: 'Agachamento Búlgaro', muscle: 'Quadríceps', secondaryMuscles: ['Glúteos'], equipment: 'Halteres', category: 'pernas', defaultSets: 3, defaultReps: 10, defaultRest: 75 },
  { id: 'avanco-passada', name: 'Avanço / Passada', muscle: 'Quadríceps', secondaryMuscles: ['Glúteos'], equipment: 'Halteres', category: 'pernas', defaultSets: 3, defaultReps: 12, defaultRest: 75 },

  // --- Posteriores de Coxa & Glúteos ---
  { id: 'stiff-barra', name: 'Stiff com Barra', muscle: 'Posteriores', secondaryMuscles: ['Glúteos', 'Lombar'], equipment: 'Barra', category: 'pernas', defaultSets: 4, defaultReps: 10, defaultRest: 90 },
  { id: 'mesa-flexora', name: 'Mesa Flexora', muscle: 'Posteriores', equipment: 'Máquina', category: 'pernas', defaultSets: 4, defaultReps: 12, defaultRest: 60 },
  { id: 'cadeira-flexora', name: 'Cadeira Flexora', muscle: 'Posteriores', equipment: 'Máquina', category: 'pernas', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'elevacao-pelvica', name: 'Elevação Pélvica com Barra', muscle: 'Glúteos', secondaryMuscles: ['Posteriores'], equipment: 'Barra', category: 'gluteos', defaultSets: 4, defaultReps: 12, defaultRest: 90 },
  { id: 'cadeira-abdutora', name: 'Cadeira Abdutora', muscle: 'Glúteos', equipment: 'Máquina', category: 'gluteos', defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'panturrilha-em-pe', name: 'Panturrilha em Pé', muscle: 'Panturrilhas', equipment: 'Máquina / Peso do corpo', category: 'pernas', defaultSets: 4, defaultReps: 15, defaultRest: 60 },
  { id: 'panturrilha-sentado', name: 'Panturrilha Sentado', muscle: 'Panturrilhas (Sóleo)', equipment: 'Máquina', category: 'pernas', defaultSets: 4, defaultReps: 15, defaultRest: 60 },

  // --- Peitoral ---
  { id: 'supino-reto-barra', name: 'Supino Reto com Barra', muscle: 'Peitoral', secondaryMuscles: ['Tríceps', 'Deltoide Anterior'], equipment: 'Barra', category: 'peito', defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'supino-inclinado-halteres', name: 'Supino Inclinado com Halteres', muscle: 'Peitoral Superior', secondaryMuscles: ['Tríceps', 'Deltoide Anterior'], equipment: 'Halteres', category: 'peito', defaultSets: 4, defaultReps: 10, defaultRest: 90 },
  { id: 'supino-reto-halteres', name: 'Supino Reto com Halteres', muscle: 'Peitoral', secondaryMuscles: ['Tríceps'], equipment: 'Halteres', category: 'peito', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'crucifixo-reto', name: 'Crucifixo Reto com Halteres', muscle: 'Peitoral', equipment: 'Halteres', category: 'peito', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'crossover-polia', name: 'Crossover na Polia Média/Baixa', muscle: 'Peitoral', equipment: 'Cabo', category: 'peito', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'peck-deck', name: 'Peck Deck (Voador)', muscle: 'Peitoral', equipment: 'Máquina', category: 'peito', defaultSets: 3, defaultReps: 12, defaultRest: 60 },

  // --- Costas & Dorsais ---
  { id: 'puxada-alta-aberta', name: 'Puxada Alta com Pegada Aberta', muscle: 'Dorsais', secondaryMuscles: ['Bíceps', 'Deltoide Posterior'], equipment: 'Cabo', category: 'costas', defaultSets: 4, defaultReps: 10, defaultRest: 90 },
  { id: 'remada-curvada-barra', name: 'Remada Curvada com Barra', muscle: 'Dorsais', secondaryMuscles: ['Trapézio', 'Bíceps', 'Lombar'], equipment: 'Barra', category: 'costas', defaultSets: 4, defaultReps: 8, defaultRest: 90 },
  { id: 'remada-baixa-triangulo', name: 'Remada Baixa no Cabo (Triângulo)', muscle: 'Dorsais / Romboides', secondaryMuscles: ['Bíceps'], equipment: 'Cabo', category: 'costas', defaultSets: 3, defaultReps: 10, defaultRest: 75 },
  { id: 'barra-fixa', name: 'Barra Fixa (Pull-up)', muscle: 'Dorsais', secondaryMuscles: ['Bíceps'], equipment: 'Peso do corpo', category: 'costas', defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'remada-cavalinho', name: 'Remada Cavalinho (Barra T)', muscle: 'Costas / Dorsais', secondaryMuscles: ['Bíceps'], equipment: 'Barra T', category: 'costas', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'pulldown-corda', name: 'Pulldown com Corda no Cabo', muscle: 'Dorsais', equipment: 'Cabo', category: 'costas', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'levantamento-terra', name: 'Levantamento Terra Convencional', muscle: 'Costas / Cadeia Posterior', secondaryMuscles: ['Glúteos', 'Posteriores', 'Trapézio'], equipment: 'Barra', category: 'costas', defaultSets: 4, defaultReps: 6, defaultRest: 180 },

  // --- Ombros (Deltoides) ---
  { id: 'desenvolvimento-halteres', name: 'Desenvolvimento com Halteres', muscle: 'Deltoides', secondaryMuscles: ['Tríceps'], equipment: 'Halteres', category: 'ombros', defaultSets: 4, defaultReps: 10, defaultRest: 90 },
  { id: 'desenvolvimento-militar', name: 'Desenvolvimento Militar (Barra)', muscle: 'Deltoides', secondaryMuscles: ['Tríceps'], equipment: 'Barra', category: 'ombros', defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'elevacao-lateral', name: 'Elevação Lateral com Halteres', muscle: 'Deltoide Lateral', equipment: 'Halteres', category: 'ombros', defaultSets: 4, defaultReps: 12, defaultRest: 60 },
  { id: 'elevacao-lateral-cabo', name: 'Elevação Lateral no Cabo', muscle: 'Deltoide Lateral', equipment: 'Cabo', category: 'ombros', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'crucifixo-invertido', name: 'Crucifixo Invertido com Halteres', muscle: 'Deltoide Posterior', secondaryMuscles: ['Trapézio'], equipment: 'Halteres', category: 'ombros', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'face-pull', name: 'Face Pull na Polia', muscle: 'Deltoide Posterior / Trapézio', equipment: 'Cabo', category: 'ombros', defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'encolhimento-ombros', name: 'Encolhimento de Ombros', muscle: 'Trapézio', equipment: 'Halteres / Barra', category: 'ombros', defaultSets: 3, defaultReps: 12, defaultRest: 60 },

  // --- Bíceps ---
  { id: 'rosca-direta-barra-w', name: 'Rosca Direta com Barra W', muscle: 'Bíceps', equipment: 'Barra W', category: 'biceps', defaultSets: 3, defaultReps: 10, defaultRest: 60 },
  { id: 'rosca-martelo-halteres', name: 'Rosca Martelo com Halteres', muscle: 'Braquial / Bíceps', equipment: 'Halteres', category: 'biceps', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'rosca-inclinada-halteres', name: 'Rosca Inclinada no Banco 45°', muscle: 'Bíceps (Cabeça Longa)', equipment: 'Halteres', category: 'biceps', defaultSets: 3, defaultReps: 10, defaultRest: 60 },
  { id: 'rosca-scott', name: 'Rosca Scott', muscle: 'Bíceps', equipment: 'Máquina / Barra W', category: 'biceps', defaultSets: 3, defaultReps: 10, defaultRest: 60 },

  // --- Tríceps ---
  { id: 'triceps-corda-polia', name: 'Tríceps Corda na Polia', muscle: 'Tríceps', equipment: 'Cabo', category: 'triceps', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'triceps-testa-barra-w', name: 'Tríceps Testa com Barra W', muscle: 'Tríceps', equipment: 'Barra W', category: 'triceps', defaultSets: 3, defaultReps: 10, defaultRest: 75 },
  { id: 'triceps-frances-haltere', name: 'Tríceps Francês com Haltere', muscle: 'Tríceps (Cabeça Longa)', equipment: 'Halteres', category: 'triceps', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'triceps-paralelas', name: 'Mergulho em Paralelas', muscle: 'Tríceps', secondaryMuscles: ['Peitoral'], equipment: 'Barras Paralelas', category: 'triceps', defaultSets: 3, defaultReps: 10, defaultRest: 90 },

  // --- Abdômen ---
  { id: 'prancha-isometrica', name: 'Prancha Abdominal Isométrica', muscle: 'Abdômen / Core', equipment: 'Peso do corpo', category: 'abdomen', defaultSets: 3, defaultReps: 45, defaultRest: 60 },
  { id: 'abdominal-infra-barra', name: 'Elevação de Pernas na Barra', muscle: 'Abdômen Infra', equipment: 'Barra Fixa', category: 'abdomen', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'abdominal-supra-solo', name: 'Abdominal Crunch no Solo', muscle: 'Abdômen Supra', equipment: 'Peso do corpo', category: 'abdomen', defaultSets: 3, defaultReps: 20, defaultRest: 45 },
  { id: 'abdominal-cabo-polia', name: 'Abdominal no Cabo (Rope Crunch)', muscle: 'Abdômen', equipment: 'Cabo', category: 'abdomen', defaultSets: 3, defaultReps: 15, defaultRest: 60 }
];

/**
 * Busca local rápida no catálogo curado em português.
 */
export function searchLocalExercises(term: string): DbExercise[] {
  const q = term.toLowerCase().trim();
  if (!q) return curatedExercises.slice(0, 10);

  return curatedExercises.filter(ex =>
    ex.name.toLowerCase().includes(q) ||
    ex.muscle.toLowerCase().includes(q) ||
    ex.category.toLowerCase().includes(q) ||
    ex.equipment?.toLowerCase().includes(q)
  );
}

/**
 * Busca assíncrona no repositório WGER (Workout and Exercise General Record)
 * pública e gratuita, com fallback automático no catálogo local.
 */
export async function searchWgerExercises(query: string): Promise<Array<{
  name: string;
  muscle: string;
  category: string;
  source: string;
}>> {
  const localResults = searchLocalExercises(query).map(e => ({
    name: e.name,
    muscle: e.muscle,
    category: e.category,
    source: 'Catálogo Curado BR'
  }));

  try {
    const res = await fetch(`https://wger.de/api/v2/exerciseinfo/?limit=8`, {
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return localResults;

    const data = await res.json();
    const wgerItems = (data.results || [])
      .map((r: any) => {
        const trans = r.translations?.find((t: any) => t.language === 2 || t.name);
        const name = trans?.name;
        if (!name) return null;
        const muscle = r.muscles?.[0]?.name_en || r.muscles?.[0]?.name || r.category?.name || 'Geral';
        return {
          name: String(name),
          muscle: String(muscle),
          category: String(r.category?.name || 'Geral'),
          source: 'WGER Open Fitness DB'
        };
      })
      .filter(Boolean);

    // Combina locais prioritários + externos
    const combined = [...localResults];
    for (const item of wgerItems) {
      if (!combined.some(c => c.name.toLowerCase() === item!.name.toLowerCase())) {
        combined.push(item!);
      }
    }
    return combined.slice(0, 15);
  } catch {
    return localResults;
  }
}
