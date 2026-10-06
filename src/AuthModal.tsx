import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { Cloud, Loader2, X, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import { auth, configured } from './firebase';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  function mapAuthError(err: unknown): string {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'E-mail ou senha incorretos. Confira a digitação ou recupere sua senha.';
    }
    if (code === 'auth/user-not-found') {
      return 'Nenhuma conta encontrada com este e-mail. Toque em "Criar conta" para se cadastrar.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já tem uma conta cadastrada. Use a aba "Entrar" ou recupere seu acesso.';
    }
    if (code === 'auth/weak-password') {
      return 'A senha é muito curta. Crie uma senha com pelo menos 6 caracteres.';
    }
    if (code === 'auth/invalid-email') {
      return 'Por favor, informe um endereço de e-mail válido.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Falha de conexão. Verifique sua internet e tente novamente.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'A janela do Google foi fechada antes de concluir o login.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Este método de login está desativado no Firebase Authentication.';
    }
    return 'Não foi possível autenticar. Confira os dados ou tente novamente.';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) {
      setError('Firebase não inicializado. Verifique a configuração.');
      return;
    }
    setError('');
    setInfo('');
    setBusy(true);

    try {
      if (tab === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onSuccess();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!auth) {
      setError('Firebase não inicializado.');
      return;
    }
    setError('');
    setInfo('');
    setBusy(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    if (!auth) return;
    if (!email.trim()) {
      setError('Informe seu e-mail no campo acima para enviarmos o link de recuperação.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('E-mail de recuperação enviado! Confira sua caixa de entrada e spam.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal auth-modal-card" role="dialog" aria-modal="true" aria-label="Autenticação">
        <header className="modal-header">
          <div>
            <h2>{tab === 'login' ? 'Acessar sua conta' : 'Criar sua conta'}</h2>
            <p>Sincronize seus treinos e dieta com segurança na nuvem.</p>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="modal-body">
          {!configured ? (
            <div className="notice">
              <h3>Firebase em modo local</h3>
              <p>As chaves públicas do Firebase estão salvas em API_KEYS.env e .env.local.</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
                  onClick={() => { setTab('login'); setError(''); setInfo(''); }}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className={`auth-tab-btn ${tab === 'signup' ? 'active' : ''}`}
                  onClick={() => { setTab('signup'); setError(''); setInfo(''); }}
                >
                  Criar conta
                </button>
              </div>

              {/* Google Sign-in */}
              <button
                type="button"
                className="google-auth-btn"
                onClick={handleGoogleSignIn}
                disabled={busy}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {tab === 'login' ? 'Entrar com o Google' : 'Cadastrar com o Google'}
              </button>

              <div className="auth-divider">OU COM SEU E-MAIL</div>

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <label>
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="seu.email@exemplo.com"
                    autoComplete="email"
                  />
                </label>

                <label>
                  Senha
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                {error && <div className="error" role="alert">{error}</div>}
                {info && (
                  <div className="notice" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} style={{ color: '#4caf50' }} />
                    <span>{info}</span>
                  </div>
                )}

                <button
                  className="button primary full"
                  type="submit"
                  disabled={busy}
                  style={{ marginTop: 14 }}
                >
                  {busy ? <Loader2 className="spin" size={17} /> : <Cloud size={17} />}
                  {tab === 'signup' ? 'Criar minha conta' : 'Entrar na minha conta'}
                </button>

                {tab === 'login' && (
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <button
                      type="button"
                      className="text-button"
                      onClick={handleResetPassword}
                      style={{ fontSize: 11 }}
                    >
                      Esqueceu sua senha? Recuperar acesso
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, color: '#889882', fontSize: 11 }}>
                  <ShieldCheck size={14} style={{ color: '#285b49' }} />
                  <span>Seus registros locais são sincronizados automaticamente.</span>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
