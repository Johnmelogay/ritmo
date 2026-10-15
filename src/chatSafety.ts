import { type AppState } from './domain';

export function proposalFingerprint(state:AppState){return JSON.stringify({...state,chat:[],aiMemory:null});}
export function validateApprovedChange(before:AppState,after:AppState){
 if(before.ownerUid!==after.ownerUid)throw new Error('A IA não pode trocar o proprietário dos dados.');
 if(before.profile.aiConsent!==after.profile.aiConsent||before.profile.routineConsent!==after.profile.routineConsent)throw new Error('Consentimentos só podem ser alterados manualmente em Perfil.');
 if(JSON.stringify(before.sessions)!==JSON.stringify(after.sessions))throw new Error('O histórico de sessões é protegido. Revise seus treinos pelo painel.');
 if(JSON.stringify(before.trash)!==JSON.stringify(after.trash))throw new Error('A lixeira só pode ser alterada manualmente.');
 if(JSON.stringify(before.aiMemory)!==JSON.stringify(after.aiMemory))throw new Error('A memória da IA só muda pela conversa ou manualmente.');
 if(before.plans.some(item=>!after.plans.some(other=>other.id===item.id)))throw new Error('A IA não pode excluir planos. Use o painel de treinos.');
 if(before.meals.some(item=>!after.meals.some(other=>other.id===item.id))||before.body.some(item=>!after.body.some(other=>other.id===item.id)))throw new Error('A IA não pode apagar definitivamente registros existentes.');
}
