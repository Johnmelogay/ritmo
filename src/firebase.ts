import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { z } from 'zod';

const env=import.meta.env;
// Enable only after deploying and verifying the real callable backend.
export const aiBackendEnabled=env.VITE_AI_BACKEND_ENABLED==='true';
export const configured=Boolean(env.VITE_FIREBASE_API_KEY&&env.VITE_FIREBASE_PROJECT_ID&&env.VITE_FIREBASE_APP_ID);
const app=configured?initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET,messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID,appId:env.VITE_FIREBASE_APP_ID,measurementId:env.VITE_FIREBASE_MEASUREMENT_ID}):null;
if(app&&env.VITE_RECAPTCHA_SITE_KEY)initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),isTokenAutoRefreshEnabled:true});
export const auth=app?getAuth(app):null;
export const db=app?initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})}):null;
const functions=app?getFunctions(app,env.VITE_FIREBASE_REGION||'southamerica-east1'):null;
export function authErrorMessage(error:unknown){
 const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
 if(code==='auth/configuration-not-found')return 'Ative Authentication no console Firebase e habilite o provedor E-mail/senha para este projeto.';
 if(code==='auth/operation-not-allowed')return 'O provedor E-mail/senha ainda está desativado no Firebase. Habilite-o em Authentication → Sign-in method.';
 if(code==='auth/email-already-in-use')return 'Este e-mail já tem uma conta. Entre ou recupere a senha.';
 if(code==='auth/network-request-failed')return 'Não foi possível conectar ao Firebase. Confira sua conexão e tente novamente.';
 if(code==='auth/too-many-requests')return 'Muitas tentativas de acesso. Aguarde um pouco e tente novamente.';
 return 'Não foi possível entrar. Confira o e-mail e a senha ou recupere seu acesso.';
}
export const estimateSchema=z.object({description:z.string(),items:z.array(z.object({foodId:z.string(),grams:z.number().positive().max(10000),minGrams:z.number().nonnegative(),maxGrams:z.number().positive().max(10000),estimated:z.boolean()})).max(20),questions:z.array(z.string()).max(2),notes:z.string()});
export type Estimate=z.infer<typeof estimateSchema>;
export async function estimateMeal(input:{text:string;media?:{data:string;mimeType:string}}):Promise<Estimate>{
 if(!aiBackendEnabled)throw new Error('IA ainda não conectada: faltam as funções do backend e as chaves dos provedores. Use o registro manual por enquanto.');
 if(!functions||!auth?.currentUser)throw new Error('Conecte sua conta Firebase para usar a análise por IA. O registro manual já está disponível.');
 const call=httpsCallable(functions,'estimateMeal',{timeout:60000});const result=await call(input);return estimateSchema.parse(result.data);
}
export async function dailyCoach():Promise<{title:string;body:string;source:string}>{
 if(!aiBackendEnabled)throw new Error('IA ainda não conectada: faltam as funções do backend e as chaves dos provedores.');
 if(!functions||!auth?.currentUser)throw new Error('Conecte sua conta para gerar uma revisão com Gemini e Jev.');
 const result=await httpsCallable(functions,'dailyCoach',{timeout:60000})({});return z.object({title:z.string(),body:z.string(),source:z.string()}).parse(result.data);
}
