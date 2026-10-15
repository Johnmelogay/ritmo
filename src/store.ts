import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, getDocsFromServer, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { useIdentity } from './Identity';
import { type AppState, emptyAiMemory, emptyState, stateSchema } from './domain';
import { readStoredState, writeStoredState } from './storage';
import { mergeBackup } from './migration';

type RecordValue={kind:string;payload:unknown;updatedAt:string};
function records(state:AppState):Record<string,RecordValue>{
 const result:Record<string,RecordValue>={};const add=(id:string,kind:string,payload:unknown)=>{result[id]={kind,payload,updatedAt:''};};
 add('profile','profile',state.profile);add('meta','meta',{ownerUid:state.ownerUid,water:state.water,reviewed:state.reviewed,dismissed:state.dismissed,routineCorrections:state.routineCorrections,trash:state.trash,chat:state.chat,aiMemory:state.aiMemory});
 for(const kind of ['meals','plans','sessions','body','recovery'] as const)for(const item of state[kind])add(`${kind}_${item.id}`,kind,item);
 return result;
}
function restore(items:RecordValue[],ownerUid:string):AppState{
 const next=emptyState();for(const item of items){if(item.kind==='profile')next.profile=item.payload as AppState['profile'];else if(item.kind==='meta')Object.assign(next,item.payload);else if(['meals','plans','sessions','body','recovery'].includes(item.kind))(next[item.kind as 'meals'] as unknown[]).push(item.payload);}
 return stateSchema.parse({...next,ownerUid,demo:false});
}
export function useAppStore(){
 const {user}=useIdentity();const account=user?.uid??'';const storageKey=`ritmo-${account}-v1`;
 const [state,setState]=useState<AppState>(()=>account?{...readStoredState(localStorage,storageKey),ownerUid:account}:emptyState());const ref=useRef(state);
 const [sync,setSync]=useState('Carregando dados da conta…');const [error,setError]=useState('');const [ready,setReady]=useState(!db);const [importing,setImporting]=useState(false);
 const readyRef=useRef(!db),importLock=useRef(false),pending=useRef(0),failed=useRef(false),cloudIds=useRef(new Set<string>()),writes=useRef<Promise<void>>(Promise.resolve());
 const saveLocal=useCallback((next:AppState)=>{
  try{if(!account||next.ownerUid!==account)throw new Error('owner');writeStoredState(localStorage,storageKey,next);localStorage.setItem('ritmo-active-account',storageKey);ref.current=next;setState(next);return true;}
  catch{setError('Não foi possível preservar os dados neste aparelho. Nenhum registro foi substituído. Exporte um backup e verifique o armazenamento.');return false;}
 },[account,storageKey]);
 useEffect(()=>{
  if(!account||!db)return;
  return onSnapshot(collection(db,'users',account,'records'),{includeMetadataChanges:true},snapshot=>{
   cloudIds.current=new Set(snapshot.docs.map(item=>item.id));if(!snapshot.metadata.fromCache||!snapshot.empty){readyRef.current=true;setReady(true);}
   try{if(!snapshot.empty&&!snapshot.metadata.hasPendingWrites&&pending.current===0&&!failed.current&&!importLock.current)saveLocal(restore(snapshot.docs.map(item=>item.data() as RecordValue),account));
    setSync(snapshot.metadata.hasPendingWrites||pending.current?'Alterações salvas no aparelho · enviando…':failed.current?'Falha de sincronização · backup local preservado':snapshot.metadata.fromCache?'Offline · dados desta conta no aparelho':'Sincronizado com Firebase');
   }catch{setError('Um registro da nuvem precisa de revisão. Os dados locais foram preservados.');}
  },()=>{setError('Firebase recusou a leitura. Confira sua conexão e as regras; seus dados locais não foram apagados.');setSync('Falha de sincronização');});
 },[account,saveLocal]);
 const commit=useCallback((previous:AppState,next:AppState)=>{
  if(!db||!account)return Promise.resolve();const database=db;const before=records(previous),after=records(next);
  const changed=Object.entries(after).filter(([id,value])=>JSON.stringify(value)!==JSON.stringify(before[id])||['profile','meta'].includes(id)&&!cloudIds.current.has(id));
  const removed=Object.keys(before).filter(id=>!after[id]);const changes=[...changed.map(([id,value])=>({id,value})),...removed.map(id=>({id,value:null}))];
  if(!changes.length)return writes.current;pending.current++;setSync('Alterações salvas no aparelho · enviando…');
  const job=writes.current.catch(()=>{}).then(async()=>{for(let index=0;index<changes.length;index+=400){const batch=writeBatch(database);for(const change of changes.slice(index,index+400)){const target=doc(database,'users',account,'records',change.id);if(change.value)batch.set(target,JSON.parse(JSON.stringify({...change.value,updatedAt:new Date().toISOString()})));else batch.delete(target);}await batch.commit();}failed.current=false;});
  writes.current=job;void job.then(()=>{pending.current--;setSync(pending.current?'Sincronização pendente':'Sincronizado com Firebase');},()=>{pending.current--;failed.current=true;setSync('Falha de sincronização · backup local preservado');setError('Dados salvos nesta conta no aparelho, mas o Firebase recusou o envio. Não apague o app; exporte o backup.');});return job;
 },[account]);
 const update=useCallback((action:AppState|((previous:AppState)=>AppState))=>{
  if(!account||!readyRef.current||importLock.current){setError('Aguarde a leitura ou recuperação da sua conta antes de editar.');return false;}
  const previous=ref.current;const candidate=typeof action==='function'?action(previous):action;const next={...candidate,ownerUid:account,demo:false,trash:candidate.trash??[],chat:candidate.chat??[],aiMemory:candidate.aiMemory??emptyAiMemory()};stateSchema.parse(next);
  if(!saveLocal(next))return false;void commit(previous,next).catch(()=>{});return true;
 },[account,saveLocal,commit]);
 const recoverBackup=useCallback(async(source:AppState,importProfile=false)=>{
  if(!account||!user||!db||!readyRef.current||importLock.current)throw new Error('Aguarde a leitura da conta e a conexão com o Firebase.');
  importLock.current=true;setImporting(true);
  try{await writes.current;const previous=ref.current;const next=mergeBackup(previous,source,account,importProfile);localStorage.setItem(`${storageKey}-before-import-${Date.now()}`,JSON.stringify(previous));if(!saveLocal(next))throw new Error('Falha ao preservar o backup local.');await commit(previous,next);
   const snapshot=await getDocsFromServer(collection(db,'users',account,'records'));const verified=restore(snapshot.docs.map(item=>item.data() as RecordValue),account);
   for(const kind of ['meals','plans','sessions','body','recovery'] as const)for(const required of next[kind]){const actual=verified[kind].find(item=>item.id===required.id);if(!actual||JSON.stringify(actual)!==JSON.stringify(required))throw new Error('A conferência na nuvem encontrou uma diferença. O backup original está preservado.');}
   saveLocal(verified);setSync('Recuperação conferida no Firebase');return {plans:verified.plans.length,sessions:verified.sessions.length,meals:verified.meals.length,body:verified.body.length,uid:account};
  }finally{importLock.current=false;setImporting(false);}
 },[account,user,storageKey,saveLocal,commit]);
 const reset=()=>update({...emptyState(),ownerUid:account});
 return {state,update,user,sync,error,setError,reset,ready,importing,recoverBackup};
}
