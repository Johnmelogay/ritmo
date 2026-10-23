import { useEffect, useRef, useState } from 'react';
import { Check, Eye, ImagePlus, Loader2, Send, Sparkles, X } from 'lucide-react';
import { Modal } from './components';
import { coachConversation } from './ai';
import { planSmartCommand, applySmartCards, type AttachedMedia, type SmartPlanResult, type SmartCardChange } from './smartCommand';
import { proposalFingerprint, validateApprovedChange } from './chatSafety';
import { uid, today, emptyAiMemory, type AppState } from './domain';
import { type AuditLogEntry, getAuditLogs } from './auditLog';
import { rolloverMemory, applyMemoryUpdate } from './aiMemory';

export function ChatCommandModal({currentState,onUpdateState,onClose,onOpenAuditLogs,onPreview}:{currentState:AppState;onUpdateState:(updater:(state:AppState)=>AppState,log?:AuditLogEntry)=>boolean;onClose:()=>void;onOpenAuditLogs:()=>void;onPreview?:(input:{nextState:AppState;logEntry:AuditLogEntry;count:number;baseline:string})=>void}){
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [attachment,setAttachment]=useState<AttachedMedia|null>(null);const [proposal,setProposal]=useState<SmartPlanResult>();const [cards,setCards]=useState<SmartCardChange[]>([]);const baseline=useRef('');const mounted=useRef(true);const bottom=useRef<HTMLDivElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[currentState.chat.length,busy]);

 // Auto-rollover: if day changed, prune old messages and consolidate written history
 useEffect(()=>{
  const todayStr=today();
  const cleaned=rolloverMemory(currentState,todayStr);
  if(cleaned!==currentState){
   onUpdateState(()=>cleaned);
  }
 },[currentState,onUpdateState]);

 async function send(){
  if(busy||!currentState.profile.aiConsent||!text.trim()&&!attachment)return;
  const todayStr=today();
  const activeState=rolloverMemory(currentState,todayStr);
  const prompt=text.trim()||(attachment?'Quero conversar sobre este documento.':'');
  const userMsg={id:uid(),role:'user' as const,text:prompt,createdAt:new Date().toISOString()};
  const nextMessages=[...activeState.chat,userMsg].slice(-60);

  const appliedUser=onUpdateState(s=>({
   ...s,
   chat:nextMessages
  }));
  if(!appliedUser)return;

  setText('');setError('');setBusy(true);setProposal(undefined);setCards([]);
  try{
   const logs=getAuditLogs();
   const reply=await coachConversation(activeState,nextMessages,attachment?{data:attachment.data,mimeType:attachment.mimeType}:undefined,logs);
   if(mounted.current){
    const assistantMsg={id:uid(),role:'assistant' as const,text:reply.answer,createdAt:new Date().toISOString()};
    onUpdateState(s=>{
     const nextMem=applyMemoryUpdate(s.aiMemory??emptyAiMemory(),todayStr,{dailyNote:reply.dailyNote,facts:reply.facts});
     return {
      ...s,
      chat:[...s.chat,assistantMsg].slice(-60),
      aiMemory:nextMem
     };
    });
    setAttachment(null);
   }
  }catch(e){
   if(mounted.current)setError(e instanceof Error?e.message:'Não foi possível conversar agora.');
  }finally{
   if(mounted.current)setBusy(false);
  }
 }
 async function prepare(){
  if(busy||!currentState.chat.length||!currentState.profile.aiConsent)return;setError('');setBusy(true);baseline.current=proposalFingerprint(currentState);
  const prompt='Prepare somente as alterações expressamente pedidas pelo usuário nesta conversa. Não invente metas ou substitua o plano profissional sem pedido. Se faltarem informações, pergunte em clarifyingQuestion. Não altere segurança, consentimentos ou histórico.\n'+currentState.chat.slice(-12).map(m=>`${m.role}: ${m.text}`).join('\n');
  try{const result=await planSmartCommand(prompt,currentState,attachment);if(mounted.current){setProposal(result);setCards(result.cards.map(card=>({...card,selected:false})));}}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Não foi possível preparar uma proposta.');}finally{if(mounted.current)setBusy(false);}
 }
 function approve(){
  try{if(baseline.current!==proposalFingerprint(currentState))throw new Error('Seus dados mudaram desde a proposta. Prepare novamente para não sobrescrever atualizações.');
   const result=applySmartCards(currentState,cards,currentState.chat.filter(m=>m.role==='user').at(-1)?.text??'Conversa com IA',proposal?.jevDecision,false);validateApprovedChange(currentState,result.nextState);
   if(onUpdateState(()=>result.nextState,result.logEntry)){
    setProposal(undefined);setCards([]);
    onUpdateState(s=>({
     ...s,
     chat:[...s.chat,{id:uid(),role:'assistant' as const,text:`Você confirmou ${cards.filter(c=>c.selected).length} alteração(ões). Elas foram salvas no aparelho; acompanhe a confirmação de sincronização com o Firebase no Perfil.`,createdAt:new Date().toISOString()}].slice(-60)
    }));
   }
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível executar.');}
 }
 /** Computes the selected changes without saving and lets the app show them in place. */
 function previewInApp(){
  if(!onPreview)return;
  try{if(baseline.current!==proposalFingerprint(currentState))throw new Error('Seus dados mudaram desde a proposta. Prepare novamente para não sobrescrever atualizações.');
   const result=applySmartCards(currentState,cards,currentState.chat.filter(m=>m.role==='user').at(-1)?.text??'Conversa com IA',proposal?.jevDecision,false);validateApprovedChange(currentState,result.nextState);
   onPreview({nextState:result.nextState,logEntry:result.logEntry,count:cards.filter(c=>c.selected).length,baseline:baseline.current});
   setProposal(undefined);setCards([]);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível preparar a prévia.');}
 }
 return <Modal title="Converse com seu Ritmo" subtitle="Entenda sua evolução. Revise os motivos. Você confirma cada alteração." onClose={onClose} wide><div className="chat-content">
 <div className="chat-log" role="log" aria-label="Conversa com IA">{!currentState.chat.length&&<div className="chat-welcome"><Sparkles size={28}/><h3>Como posso ajudar hoje?</h3><p>Podemos conversar sobre seus registros, ajustar a rotina ou preparar mudanças nos planos. Nenhuma conversa altera dados sozinha.</p></div>}{currentState.chat.map(message=><article key={message.id} className={`chat-message ${message.role}`}><strong>{message.role==='user'?'Você':'Ritmo IA'}</strong><p>{message.text}</p><small>{new Date(message.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></article>)}{busy&&<p role="status"><Loader2 className="spin" size={18}/> Pensando com base nos seus registros…</p>}<div ref={bottom}/></div>
 {proposal&&<section className="chat-proposal"><h3>O que pretendo fazer e por quê</h3><p>{proposal.summary}</p>{proposal.clarifyingQuestion&&<p>{proposal.clarifyingQuestion}</p>}{cards.map(card=><label className="proposal-card" key={card.id}><input type="checkbox" checked={card.selected} onChange={event=>setCards(previous=>previous.map(item=>item.id===card.id?{...item,selected:event.target.checked}:item))}/><span><strong>{card.title}</strong><small>Motivo: {card.subtitle}</small>{card.before&&<span className="proposal-before">Antes: {card.before}</span>}<span>Depois: {card.after??card.details?.join(' · ')??'Confira a descrição acima.'}</span></span></label>)}{cards.length>0&&onPreview&&<button className="button primary" disabled={!cards.some(c=>c.selected)||busy} onClick={previewInApp}><Eye size={18}/>Ver no app antes de confirmar</button>}{cards.length>0&&<button className={`button ${onPreview?'secondary':'primary'}`} disabled={!cards.some(c=>c.selected)||busy} onClick={approve}><Check size={18}/>Confirmar {cards.filter(c=>c.selected).length} alteração(ões) selecionada(s)</button>}<button className="button secondary" onClick={()=>{setProposal(undefined);setCards([]);}}>Cancelar proposta</button></section>}
 {error&&<p className="error" role="alert">{error}</p>}
 {!currentState.profile.aiConsent&&<p className="notice">Ative “Análise por IA” em Perfil para enviar mensagens e os resumos necessários aos provedores configurados.</p>}
 {attachment&&<div className="chat-attachment"><span>{attachment.name}</span><button className="icon-button" aria-label="Remover anexo" onClick={()=>setAttachment(null)}><X size={18}/></button></div>}
 <form className="chat-composer" onSubmit={event=>{event.preventDefault();void send();}}><label className="sr-only" htmlFor="chat-message-input">Mensagem para a IA</label><textarea id="chat-message-input" value={text} maxLength={3000} rows={2} placeholder="Conte como foi seu dia ou o que quer ajustar…" onChange={event=>setText(event.target.value)}/><div className="chat-actions"><label className="button secondary upload-button"><ImagePlus size={18}/>Anexar<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>4*1024*1024){setError('Use uma imagem de até 4 MB.');return;}const reader=new FileReader();reader.onload=()=>setAttachment({data:String(reader.result).split(',')[1],mimeType:file.type,name:file.name,sizeBytes:file.size,previewUrl:String(reader.result)});reader.readAsDataURL(file);}}/></label><button className="button primary" type="submit" disabled={busy||!currentState.profile.aiConsent||!text.trim()&&!attachment}><Send size={18}/>Enviar</button></div></form>
 <div className="chat-footer"><button className="button secondary" onClick={()=>void prepare()} disabled={busy||!currentState.chat.length||!currentState.profile.aiConsent}>Preparar alterações desta conversa</button><button className="text-button" onClick={onOpenAuditLogs}>Histórico de alterações</button><p>IA não é atendimento médico nem monitoramento de emergência. Disponibilidade depende da conexão e dos provedores. Exclusões definitivas e mudanças de conta/permissões não são autorizadas pelo chat.</p></div>
 </div></Modal>;
}
