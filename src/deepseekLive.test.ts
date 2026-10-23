import { it,expect,vi } from 'vitest';
import { emptyState } from './domain';
vi.mock('./firebase',()=>({auth:{currentUser:{uid:'isolated-live-check'}}}));
vi.mock('./aiTransport',()=>({gatewayConfigured:true,secureProviderFetch:async (_url:string,options:RequestInit)=>{
 const {generateContent}=await import('../functions/generation.mjs');
 const result=await generateContent(JSON.parse(String(options.body)),{deepseek:process.env.RITMO_TEST_DEEPSEEK_KEY});
 return new Response(JSON.stringify(result.body),{status:result.status});
}}));
import { coachConversation } from './ai';
it.skipIf(process.env.RITMO_DEEPSEEK_LIVE!=='1')('live DeepSeek satisfies the app chat JSON contract without writing user data',async()=>{
 const state=emptyState();state.profile.aiConsent=true;
 const messages=[{id:'isolated-check',role:'user' as const,text:'Teste técnico. Confirme em uma frase que pode conversar. Não altere registros.',createdAt:new Date().toISOString()}];
 const result=await coachConversation(state,messages);
 expect(result.answer.trim().length).toBeGreaterThan(0);expect(Array.isArray(result.facts)).toBe(true);
},60000);
