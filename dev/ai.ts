import type { Plugin } from 'vite';
// @ts-expect-error Server-only JavaScript module deployed with Cloud Functions.
import { callProvider, validateGatewayRequest } from '../functions/gateway.mjs';

export function localAiPlugin():Plugin{
 const quotas=new Map<string,{day:string;count:number;last:number}>();
 return{name:'ritmo-private-ai',configureServer(server){server.middlewares.use(async(req,res,next)=>{
  if(req.url!=='/api/ai')return next();res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const fail=(status:number,message:string)=>{res.statusCode=status;res.end(JSON.stringify({error:{message}}));};
  if(req.method!=='POST'||!['127.0.0.1:5174','localhost:5174'].includes(req.headers.host??'')||req.headers.origin&&!['http://127.0.0.1:5174','http://localhost:5174'].includes(req.headers.origin)){fail(403,'Acesso local autenticado necessário.');return;}
  try{
   const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token){fail(401,'Entre na sua conta.');return;}
   const identity=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(process.env.VITE_FIREBASE_API_KEY??'')}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(15000)});
   if(!identity.ok){fail(401,'Sessão inválida.');return;}const user=(await identity.json()).users?.[0];if(!user?.email){fail(401,'Conta pessoal necessária.');return;}
   const profile=await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${user.localId}/records/profile`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
   if(!profile.ok||(await profile.json()).fields?.payload?.mapValue?.fields?.aiConsent?.booleanValue!==true){fail(403,'Ative o consentimento de IA e aguarde a sincronização.');return;}
   const now=Date.now(),day=new Date().toISOString().slice(0,10),quota=quotas.get(user.localId);if(quota&&quota.day===day&&quota.count>=100){fail(429,'Limite diário de IA atingido.');return;}quotas.set(user.localId,{day,count:quota?.day===day?quota.count+1:1,last:now});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8_000_000){fail(413,'Arquivo muito grande.');return;}}
   const input=validateGatewayRequest(JSON.parse(raw));const response=await callProvider(input,{deepseek:process.env.DEEPSEEK_API_KEY});res.statusCode=response.status;res.end(JSON.stringify(response.body));
  }catch(err){console.error('Local AI error:',err);fail(503,'IA indisponível no momento. Nenhuma alteração foi executada.');}
 });}};
}
