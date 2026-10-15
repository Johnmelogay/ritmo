import { z } from 'zod';

const inline=z.object({mimeType:z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|audio\/[a-zA-Z0-9.+;=\-_ "]+)$/i),data:z.string().max(7_000_000)});
const part=z.union([z.object({text:z.string().max(180000)}).strict(),z.object({inlineData:inline}).strict()]);
const request=z.discriminatedUnion('provider',[
 z.object({provider:z.literal('gemini'),body:z.object({contents:z.array(z.object({role:z.enum(['user','model']).optional(),parts:z.array(part).min(1).max(20)})).min(1).max(30),generationConfig:z.object({responseMimeType:z.string().optional(),responseSchema:z.record(z.unknown()).optional(),temperature:z.number().min(0).max(2).optional(),maxOutputTokens:z.number().min(1).max(8192).optional()}).optional(),systemInstruction:z.object({parts:z.array(z.object({text:z.string().max(30000)})).max(4)}).optional()}).strict()}),
 z.object({provider:z.literal('jev'),body:z.object({model:z.string().max(80),state:z.string().max(180000),questions:z.record(z.unknown())}).strict()})
]);

export function validateGatewayRequest(input){
 if(JSON.stringify(input).length>8_000_000)throw new Error('request-too-large');
 return request.parse(input);
}

export async function callProvider(input,keys,transport=fetch){
 const data=validateGatewayRequest(input);let url,headers;
 if(data.provider==='gemini'){
  if(!keys.gemini)throw new Error('provider-not-configured');
  url=`https://generativelanguage.googleapis.com/v1beta/models/${keys.model||'gemini-2.5-flash'}:generateContent`;
  headers={'Content-Type':'application/json','x-goog-api-key':keys.gemini};
 }else{
  if(!keys.jev)throw new Error('provider-not-configured');
  url='https://api.typesafe.ai/v1/systemone';headers={'Content-Type':'application/json',Authorization:`Bearer ${keys.jev}`};
 }
 const response=await transport(url,{method:'POST',headers,body:JSON.stringify(data.body),signal:AbortSignal.timeout(data.provider==='jev'?8000:50000)});
 if(!response.ok){
  let detail='';
  try{
   const errBody=await response.json();
   if(errBody?.error?.message)detail=` ${errBody.error.message}`;
  }catch{}
  return{status:response.status,body:{error:{message:`O provedor de IA não concluiu a solicitação (${response.status}).${detail||' Tente novamente.'}`}}};
 }
 const body=await response.json();
 return {status:200,body};
}
