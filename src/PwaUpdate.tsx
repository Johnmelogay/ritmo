import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdate() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return <aside className="pwa-update" role="status"><span>Uma nova versão do Ritmo está pronta. Seus registros locais serão mantidos.</span><button className="button primary" onClick={() => void updateServiceWorker(true)}>Atualizar app</button><button className="button secondary" onClick={() => setNeedRefresh(false)}>Depois</button></aside>;
}
