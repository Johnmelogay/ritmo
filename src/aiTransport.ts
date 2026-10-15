import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

export const gatewayConfigured=import.meta.env.DEV||import.meta.env.VITE_AI_BACKEND_ENABLED==='true';
export async function secureProviderFetch(url:string,options:RequestInit={}):Promise<Response>{
 const user=auth?.currentUser;
 if(!user||user.isAnonymous)throw new Error('Entre na sua conta para conversar com a IA.');
 if(!gatewayConfigured)throw new Error('O backend privado de IA ainda precisa ser publicado.');
 const provider=url.includes('generativelanguage.googleapis.com')?'gemini':url.includes('typesafe')?'jev':null;
 if(!provider)throw new Error('Provedor não autorizado.');
 const input={provider,body:JSON.parse(String(options.body||'{}'))};
 if(import.meta.env.DEV){return fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`},body:JSON.stringify(input),signal:options.signal});}
 if(!functions)throw new Error('Firebase indisponível.');
 const result=await httpsCallable<typeof input,{status:number;body:unknown}>(functions,'proxyAi',{timeout:60000})(input);
 return new Response(JSON.stringify(result.data.body),{status:result.data.status,headers:{'Content-Type':'application/json'}});
}
