import { useEffect, useRef, useState } from 'react';
import { Cloud, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { useIdentity } from './Identity';
import { validateMigration } from './migration';
import { type AppState } from './domain';

type Receipt={plans:number;sessions:number;meals:number;body:number;uid:string};
export function RecoveryPanel({ ready, recoverBackup }: { ready: boolean; recoverBackup: (backup:AppState,profile?:boolean)=>Promise<Receipt> }) {
 const {user}=useIdentity();const attempted=useRef(false);const mounted=useRef(true);
 const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [receipt,setReceipt]=useState<Receipt>();const [error,setError]=useState('');const [source,setSource]=useState<AppState>();const [confirmation,setConfirmation]=useState('');const [useProfile,setUseProfile]=useState(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if(!import.meta.env.DEV||!ready||!user||attempted.current)return;attempted.current=true;
  void (async()=>{
   const headers={Authorization:`Bearer ${await user.getIdToken()}`};
   const response=await fetch('/__ritmo/recovery',{method:'POST',headers});
   if(!response.ok)return;
   const payload=await response.json();if(payload.uid!==user.uid||payload.email.toLowerCase()!==user.email?.toLowerCase())return;
   if(payload.completed){if(mounted.current)setReceipt(payload.counts);return;}
   const backup=validateMigration(payload.backup,user.uid);
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(backup)));const fingerprint=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
   const key=`ritmo-${user.uid}-recovery-receipt-${fingerprint}`;const existing=localStorage.getItem(key);
   if(existing){if(mounted.current)setReceipt(JSON.parse(existing));return;}
   if(mounted.current){setBusy(true);setStatus(`Recuperando o backup autorizado para ${payload.email}…`);}
   try{
    const verified=await recoverBackup(backup,true);
    localStorage.setItem(key,JSON.stringify(verified));
    await fetch('/__ritmo/recovery-result',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:'verified',counts:verified})});
    if(mounted.current){setReceipt(verified);setStatus('Recuperação conferida diretamente no Firebase.');}
   }catch(e){const message=e instanceof Error?e.message:'Recuperação não concluída.';await fetch('/__ritmo/recovery-result',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:'failed',message})});if(mounted.current)setError(message);}
   finally{if(mounted.current)setBusy(false);}
  })().catch(()=>{});
 },[ready,user,recoverBackup]);
 async function importFile(){
  if(!source||!user||confirmation.trim().toLowerCase()!==user.email?.toLowerCase())return;
  setBusy(true);setError('');try{const verified=await recoverBackup(source,useProfile);setReceipt(verified);setSource(undefined);setStatus('Importação conferida diretamente no Firebase.');}catch(e){setError(e instanceof Error?e.message:'Importação não concluída.');}finally{setBusy(false);}
 }
 return <section className="card recovery-panel"><div className="section-head"><div><h2><ShieldCheck size={20}/> Sua conta, seus registros</h2><p>{user?.email} · seus dados locais antigos permanecem preservados.</p></div><Cloud size={22}/></div>
 {busy&&<p role="status"><Loader2 className="spin" size={18}/>{status||'Importando e conferindo os registros na nuvem…'}</p>}
 {receipt&&<div className="notice" role="status"><strong>Backup recuperado e conferido no Firebase</strong><p>{receipt.plans} planos · {receipt.sessions} sessões · {receipt.meals} refeições · {receipt.body} avaliações corporais</p><small>Conta: {user?.email}. Registros existentes com o mesmo ID não foram substituídos.</small></div>}
 {error&&<p className="error" role="alert">{error} O arquivo original não foi alterado.</p>}
 <label className="button secondary upload-button"><Upload size={18}/>Importar backup sem apagar dados<input disabled={!ready||busy} type="file" accept=".json,application/json" onChange={async event=>{const file=event.target.files?.[0];if(!file||!user)return;try{if(file.size>10*1024*1024)throw new Error('Use um arquivo de até 10 MB.');setSource(validateMigration(JSON.parse(await file.text()),user.uid));setError('');setConfirmation('');}catch(e){setError(e instanceof Error?e.message:'Backup incompatível.');}event.target.value='';}}/></label>
 {source&&<div className="migration-preview"><h3>Confira o destino antes de importar</h3><p>{source.plans.length} planos, {source.sessions.length} sessões, {source.meals.length} refeições, {source.body.length} avaliações.</p><p>Destino: <strong>{user?.email}</strong>. IDs já existentes serão mantidos. Importar novamente não cria duplicatas.</p><label>Digite o e-mail da conta de destino<input type="email" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label><label className="duo-toggle"><input type="checkbox" checked={useProfile} onChange={event=>setUseProfile(event.target.checked)}/>Também recuperar perfil e metas do backup</label><button className="button primary" disabled={busy||confirmation.trim().toLowerCase()!==user?.email?.toLowerCase()} onClick={()=>void importFile()}>Confirmar importação nesta conta</button><button className="button secondary" onClick={()=>setSource(undefined)}>Cancelar</button></div>}
 </section>;
}
