import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { type AppState, emptyState, stateSchema } from './domain';
import { readStoredState } from './storage';

function read(key:string):AppState {return readStoredState(localStorage,key);}
type RecordValue={kind:string;payload:unknown;updatedAt:string};
function records(state:AppState):Record<string,RecordValue>{
 const r:Record<string,RecordValue>={};const add=(key:string,kind:string,payload:unknown)=>{r[key]={kind,payload,updatedAt:''};};
 add('profile','profile',state.profile);add('meta','meta',{water:state.water,reviewed:state.reviewed,dismissed:state.dismissed,routineCorrections:state.routineCorrections});
 for(const name of ['meals','plans','sessions','body','recovery'] as const)for(const item of state[name])add(`${name}_${item.id}`,name,item);
 return r;
}
function restore(items:RecordValue[]):AppState {const next=emptyState();for(const item of items){if(item.kind==='profile')next.profile=item.payload as AppState['profile'];else if(item.kind==='meta')Object.assign(next,item.payload);else if(['meals','plans','sessions','body','recovery'].includes(item.kind))(next[item.kind as 'meals'] as unknown[]).push(item.payload);}return stateSchema.parse(next);}
export function useAppStore(){
 const [user,setUser]=useState<User|null>(null);const [state,setState]=useState<AppState>(()=>read('ritmo-local-v1'));const ref=useRef(state);const key=useRef('ritmo-local-v1');const cloudReady=useRef(false);const owner=useRef<string|null>(null);
 const cloudIds=useRef(new Set<string>());
 const [sync,setSync]=useState('Salvo neste dispositivo');const [error,setError]=useState('');
 const saveLocal=useCallback((next:AppState)=>{try{localStorage.setItem(key.current,JSON.stringify(next));}catch{setError('O armazenamento do dispositivo está cheio. Exporte um backup antes de continuar.');}ref.current=next;setState(next);},[]);
 useEffect(()=>{if(!auth||!db)return;let unsubscribe:undefined|(()=>void);const stop=onAuthStateChanged(auth,u=>{unsubscribe?.();owner.current=u?.uid??null;cloudReady.current=false;cloudIds.current=new Set();setUser(u);key.current=u?`ritmo-${u.uid}-v1`:'ritmo-local-v1';const local=read(key.current);saveLocal(local);if(!u){setSync('Salvo neste dispositivo');return;}setSync('Conectando…');unsubscribe=onSnapshot(collection(db!,'users',u.uid,'records'),{includeMetadataChanges:true},snap=>{if(owner.current!==u.uid)return;try{cloudIds.current=new Set(snap.docs.map(d=>d.id));if(!snap.empty&&!snap.metadata.hasPendingWrites)saveLocal(restore(snap.docs.map(d=>d.data() as RecordValue)));cloudReady.current=!snap.metadata.fromCache||!snap.empty;setSync(snap.metadata.hasPendingWrites?'Sincronização pendente':snap.metadata.fromCache?'Offline · cache local':'Sincronizado com Firebase');}catch{setError('Um registro da nuvem tem formato incompatível. Exporte seu backup e consulte a configuração.');}},()=>{setError('Não foi possível sincronizar. Confira a conexão e as regras do Firebase.');setSync('Aguardando conexão');});});return()=>{stop();unsubscribe?.();};},[saveLocal]);
 const update=useCallback((action:AppState|((previous:AppState)=>AppState))=>{
 const prev=ref.current;const next=stateSchema.parse(typeof action==='function'?action(prev):action);
 if(owner.current&&!cloudReady.current){setError('Aguarde a leitura inicial da sua conta antes de editar.');return;}
 saveLocal(next);
 if(db&&owner.current&&!next.demo){const before=records(prev),after=records(next);const writes=Object.entries(after).filter(([id,v])=>!cloudIds.current.has(id)||JSON.stringify(v)!==JSON.stringify(before[id]));const deletes=Object.keys(before).filter(id=>!after[id]);const changes=[...writes.map(([id,value])=>({id,value})),...deletes.map(id=>({id,value:null}))];const account=owner.current;
 for(let i=0;i<changes.length;i+=400){const batch=writeBatch(db);for(const c of changes.slice(i,i+400)){const target=doc(db,'users',account,'records',c.id);if(c.value)batch.set(target,{...c.value,updatedAt:new Date().toISOString()});else batch.delete(target);}setSync('Sincronização pendente');void batch.commit().catch(()=>{setError('Dados salvos localmente, mas a nuvem recusou a escrita. Verifique as regras e exporte um backup.');});}
 }
 },[saveLocal]);
 const reset=()=>update(emptyState());
 return {state,update,user,sync,error,setError,reset};
}
