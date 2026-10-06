import { useState, useEffect } from 'react';
import {
  Sparkles,
  Utensils,
  Dumbbell,
  Activity,
  Cloud,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Target,
  Camera,
  Mic,
  Clock,
  ShieldCheck,
  TrendingUp,
  LogIn
} from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
  onOpenAuth?: () => void;
}

export function OnboardingModal({ onClose, onOpenAuth }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight' && step < 4) setStep(s => s + 1);
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step]);

  function handleSkip() {
    localStorage.setItem('ritmo_onboarding_completed', 'true');
    onClose();
  }

  function handleComplete() {
    localStorage.setItem('ritmo_onboarding_completed', 'true');
    onClose();
  }

  const steps = [
    {
      badge: 'BEM-VINDO AO RITMO',
      icon: <Target size={30} />,
      colorClass: '',
      title: 'Seu treino, sua alimentação, no seu ritmo.',
      subtitle: 'Uma plataforma criada para quem quer progredir com consistência real, sem neuras, sem dietas extremas e com total controle dos seus dados.',
      highlights: [
        {
          icon: <Activity size={18} />,
          title: 'Foco na consistência:',
          desc: 'Acompanhe calorias, proteínas, treinos e descanso em uma única visão integrada do seu dia.'
        },
        {
          icon: <ShieldCheck size={18} />,
          title: 'Privacidade em primeiro lugar:',
          desc: 'Seus dados são seus. Armazenados localmente no seu aparelho com opção de sincronização na sua nuvem.'
        }
      ]
    },
    {
      badge: 'ALIMENTAÇÃO INTELIGENTE',
      icon: <Utensils size={30} />,
      colorClass: 'orange',
      title: 'Registro ágil por foto, voz ou texto',
      subtitle: 'Com o Google Gemini 2.5 Flash conectado, você pode fotografar seu prato ou gravar um áudio dizendo o que comeu.',
      highlights: [
        {
          icon: <Camera size={18} />,
          title: 'Visão computacional:',
          desc: 'Tire uma foto e a IA identifica os alimentos, calcula porções e estima calorias e macronutrientes.'
        },
        {
          icon: <Mic size={18} />,
          title: 'Comando de voz:',
          desc: 'Fale o que comeu (ex.: "150g de frango e 2 colheres de arroz") e receba a refeição pronta.'
        },
        {
          icon: <Check size={18} />,
          title: 'Você tem a palavra final:',
          desc: 'Cada ingrediente estimado pode ser ajustado manualmente por você antes de salvar no diário.'
        }
      ]
    },
    {
      badge: 'TREINOS & PROGRESSÃO',
      icon: <Dumbbell size={30} />,
      colorClass: 'purple',
      title: 'Cada série conta na sua evolução',
      subtitle: 'Monte sua ficha de treinos ou cadastre os exercícios do seu personal com registro série a série durante o treino.',
      highlights: [
        {
          icon: <Clock size={18} />,
          title: 'Cronômetro de descanso ativo:',
          desc: 'Ao concluir uma série, o app aciona o temporizador de descanso automaticamente.'
        },
        {
          icon: <TrendingUp size={18} />,
          title: 'Carga, repetições e RIR:',
          desc: 'Anote a carga utilizada e repetições na reserva (RIR) para garantir sobrecarga progressiva.'
        },
        {
          icon: <Sparkles size={18} />,
          title: 'Flexibilidade total:',
          desc: 'Adicione ou troque exercícios durante a sessão sem alterar seu plano-base.'
        }
      ]
    },
    {
      badge: 'BIOIMPEDÂNCIA & MEDIDAS',
      icon: <Activity size={30} />,
      colorClass: 'blue',
      title: 'Exames lidos direto da câmera',
      subtitle: 'Acabe com o trabalho manual de digitar tabelas de bioimpedância ou avaliações físicas.',
      highlights: [
        {
          icon: <Camera size={18} />,
          title: 'Leitura com Gemini Vision:',
          desc: 'Envie um screenshot ou foto de laudos InBody, Tanita ou balanças inteligentes.'
        },
        {
          icon: <Check size={18} />,
          title: '12 métricas extraídas:',
          desc: 'Peso, % gordura, massa muscular, gordura visceral, água corporal e taxa metabólica basal.'
        },
        {
          icon: <TrendingUp size={18} />,
          title: 'Gráficos de tendência:',
          desc: 'Visualize a curva real de perda de gordura e ganho muscular filtrando retenções hídricas.'
        }
      ]
    },
    {
      badge: 'CONEXÃO & SINCRONIZAÇÃO',
      icon: <Cloud size={30} />,
      colorClass: '',
      title: 'Tudo pronto para começar!',
      subtitle: 'Você pode usar o Ritmo 100% no seu navegador ou conectar sua conta para sincronizar entre seu iPhone e computador.',
      highlights: [
        {
          icon: <Cloud size={18} />,
          title: 'Conta e sincronização:',
          desc: 'Conecte-se com seu e-mail e senha para salvar seus dados com segurança no Firebase.'
        },
        {
          icon: <ShieldCheck size={18} />,
          title: 'Backup & Exportação:',
          desc: 'Exporte relatórios em planilhas CSV e faça backup completo em JSON quando quiser.'
        }
      ]
    }
  ];

  const current = steps[step];

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) handleSkip(); }}>
      <div className="modal onboarding-modal" role="dialog" aria-modal="true" aria-label="Tutorial do Ritmo">
        
        {/* Top Header */}
        <div className="onboarding-top-bar">
          <div className="onboarding-steps-indicator">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`onboarding-dot ${i === step ? 'active' : ''}`}
                onClick={() => setStep(i)}
                style={{ cursor: 'pointer' }}
                title={`Ir para passo ${i + 1}`}
              />
            ))}
            <span className="onboarding-step-counter">{step + 1} de {steps.length}</span>
          </div>

          <button className="onboarding-skip-btn" onClick={handleSkip}>
            Pular tutorial <X size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }} />
          </button>
        </div>

        {/* Content Body */}
        <div className="onboarding-card" key={step}>
          <div className={`onboarding-icon-wrap ${current.colorClass}`}>
            {current.icon}
          </div>

          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {current.badge}
          </div>

          <h2>{current.title}</h2>
          <p className="onboarding-subtitle">{current.subtitle}</p>

          <div className="onboarding-highlights">
            {current.highlights.map((h, i) => (
              <div className="onboarding-highlight-item" key={i}>
                {h.icon}
                <div>
                  <strong>{h.title} </strong>
                  <span>{h.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="onboarding-footer">
          {step > 0 ? (
            <button className="button secondary" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={16} /> Voltar
            </button>
          ) : <div />}

          <div className="onboarding-footer-btns">
            {step < steps.length - 1 ? (
              <button className="button primary" onClick={() => setStep(s => s + 1)}>
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <>
                {onOpenAuth && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      handleComplete();
                      onOpenAuth();
                    }}
                  >
                    <LogIn size={16} /> Conectar conta
                  </button>
                )}
                <button className="button primary" onClick={handleComplete}>
                  Começar a usar <Check size={16} />
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
