import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { callProvider, validateGatewayRequest } from './gateway.mjs';

initializeApp();
const deepseek=defineSecret('DEEPSEEK_API_KEY');
export const proxyAi=onCall({region:'southamerica-east1',timeoutSeconds:60,memory:'256MiB',minInstances:0,maxInstances:3,secrets:[deepseek]},async request=>{
 if(!request.auth||request.auth.token.firebase?.sign_in_provider==='anonymous')throw new HttpsError('unauthenticated','Entre na sua conta.');
 const uid=request.auth.uid,database=getFirestore();
 const profile=await database.doc(`users/${uid}/records/profile`).get();
 if(profile.data()?.payload?.aiConsent!==true)throw new HttpsError('permission-denied','Ative o consentimento de IA no perfil.');
 let parsed;try{parsed=validateGatewayRequest(request.data);}catch{throw new HttpsError('invalid-argument','Solicitação inválida ou muito grande.');}
 const day=new Date().toISOString().slice(0,10),quota=database.doc(`aiQuotas/${uid}_${day}`);
 await database.runTransaction(async tx=>{const snap=await tx.get(quota),data=snap.data()||{},now=Date.now(),minute=Math.floor(now/60000),minuteCount=data.minute===minute?data.minuteCount||0:0;if((data.count||0)>=100||minuteCount>=20)throw new HttpsError('resource-exhausted','Limite de IA atingido. Aguarde antes de tentar novamente.');tx.set(quota,{uid,day,count:(data.count||0)+1,minute,minuteCount:minuteCount+1,lastAt:now});});
 try{const result=await callProvider(parsed,{deepseek:deepseek.value()});console.info('ai_request',{provider:'deepseek',status:result.status});return result;}catch{console.error('ai_request_failed',{provider:'deepseek'});throw new HttpsError('unavailable','IA indisponível no momento. Seus dados não foram alterados.');}
});
