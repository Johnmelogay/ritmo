import { describe, it, expect, vi } from 'vitest';
import { AI_MODEL } from '../functions/model.mjs';
import { providerResponseError } from './aiErrors';
// @ts-expect-error Server-only JavaScript module.
import { callProvider } from '../functions/gateway.mjs';

describe('DeepSeek Flash routing and clear failures',()=>{
 it('disables legacy Jev requests without contacting any provider',async()=>{
  const transport=vi.fn();const result=await callProvider({provider:'jev',body:{model:'jev-latest',state:'test',questions:{}}},{jev:'unused',deepseek:'unused'},transport);
  expect(result.status).toBe(410);expect(transport).not.toHaveBeenCalled();
 });
 it('enforces the Flash alias in the gateway with a bounded default output',async()=>{
  const transport=vi.fn(async()=>new Response(JSON.stringify({candidates:[]}),{status:200}));
  await callProvider({provider:'gemini',body:{contents:[{parts:[{text:'Teste sem dados pessoais'}]}]}},{deepseek:'test-only',model:'expensive-model'},transport);
  expect(AI_MODEL).toBe('deepseek-flash');
  const [url,options]=transport.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://api.deepseek.com/chat/completions');
  expect(JSON.parse(String(options.body)).max_tokens).toBe(4096);
  expect(JSON.parse(String(options.body)).thinking.type).toBe('disabled');
 });
 it('preserves explicit budgets for short summaries',async()=>{
  const transport=vi.fn(async()=>new Response('{}',{status:200}));
  await callProvider({provider:'deepseek',body:{contents:[{parts:[{text:'Teste'}]}],generationConfig:{maxOutputTokens:300}}},{deepseek:'test-only'},transport);
  const [,options]=transport.mock.calls[0] as unknown as [string,RequestInit];
  expect(JSON.parse(String(options.body)).max_tokens).toBe(300);
 });
 it('shows depleted credits instead of a misleading connection error',async()=>{
  const result=await callProvider({provider:'deepseek',body:{contents:[{parts:[{text:'Teste'}]}]}},{deepseek:'test-only'},async()=>new Response(JSON.stringify({error:{message:'Your prepayment credits are depleted.'}}),{status:402}));
  expect(result.status).toBe(402);expect(result.body.error.message).toContain('saldo do DeepSeek');
  expect((await providerResponseError(new Response('{}',{status:402}))).message).toContain('Adicione créditos');
 });
});
