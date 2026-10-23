import { z } from 'zod';
import { generateContent } from './generation.mjs';

const inline=z.object({mimeType:z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|audio\/[a-zA-Z0-9.+;=\-_ "]+)$/i),data:z.string().max(7_000_000)});
const part=z.union([z.object({text:z.string().max(180000)}).strict(),z.object({inlineData:inline}).strict()]);
const request=z.discriminatedUnion('provider',[
 z.object({provider:z.enum(['gemini','deepseek']),body:z.object({contents:z.array(z.object({role:z.enum(['user','model']).optional(),parts:z.array(part).min(1).max(20)})).min(1).max(30),generationConfig:z.object({responseMimeType:z.string().optional(),responseSchema:z.record(z.unknown()).optional(),temperature:z.number().min(0).max(2).optional(),maxOutputTokens:z.number().min(1).max(8192).optional()}).optional(),systemInstruction:z.object({parts:z.array(z.object({text:z.string().max(30000)})).max(4)}).optional()}).strict()}),
 z.object({provider:z.literal('jev'),body:z.object({model:z.string().max(80),state:z.string().max(180000),questions:z.record(z.unknown())}).strict()})
]);

export function validateGatewayRequest(input){
 if(JSON.stringify(input).length>8_000_000)throw new Error('request-too-large');
 return request.parse(input);
}

export async function callProvider(input,keys,transport=fetch){
 const data=validateGatewayRequest(input);
 if(data.provider!=='jev')return generateContent(data.body,keys,transport);
 // Old installed PWAs may still request Jev. Do not contact another paid provider.
 return {status:410,body:{error:{provider:'deepseek',message:'O Ritmo usa somente DeepSeek. Atualize o aplicativo para continuar.'}}};
}
