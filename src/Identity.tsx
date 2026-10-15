import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Loader2, ShieldCheck } from 'lucide-react';
import { auth, configured } from './firebase';
import { AuthModal } from './AuthModal';

const Identity = createContext<{ user: User | null; ready: boolean }>({ user: null, ready: false });
export const useIdentity = () => useContext(Identity);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!auth) { setValue({ user: null, ready: true }); return; }
    return onAuthStateChanged(auth, user => setValue({ user: user && !user.isAnonymous ? user : null, ready: true }), () => { setError('Não foi possível verificar a sessão. Reabra o app e confira sua conexão.'); setValue({ user: null, ready: true }); });
  }, []);
  return <Identity.Provider value={value}>{!value.ready ? <div className="identity-loading" role="status"><Loader2 className="spin"/><p>Verificando sua sessão com segurança…</p></div> : !value.user ? <div className="identity-screen"><div className="identity-intro"><ShieldCheck/><h1>Seu progresso pertence a você.</h1><p>Entre para acessar seus planos, histórico e acompanhamento. Sua sessão será mantida neste aparelho enquanto o navegador permitir o armazenamento.</p><p>Usava o app sem login? Seus dados locais não serão apagados. Depois de entrar, importe o backup para associá-lo à conta correta.</p>{error && <p role="alert">{error}</p>}{!configured && <p role="alert">Configure o Firebase para liberar o acesso. Não existe modo de registro anônimo.</p>}</div><AuthModal required onClose={() => {}} onSuccess={() => {}}/></div> : <div key={value.user.uid}>{children}</div>}</Identity.Provider>;
}
