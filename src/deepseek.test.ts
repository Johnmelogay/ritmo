import { describe,it,expect,vi } from 'vitest';
import { generateContent,deepseekRequest } from '../functions/generation.mjs';
const body=(mimeType?:string)=>({contents:[{parts:[{text:'Responda JSON'},...(mimeType?[{inlineData:{mimeType,data:'dGVzdA=='}}]:[])]}],generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{answer:{type:'STRING'}}}}});
describe('DeepSeek media and structured response compatibility',()=>{
 it('converts schema instructions and inline image blocks without dropping media',()=>{
  const request=deepseekRequest(body('image/png'));expect(request.model).toBe('deepseek-flash');expect(request.response_format.type).toBe('json_object');expect(request.messages[0].content).toContain('"type":"object"');expect(request.messages[1].content[1].image_url.url).toBe('data:image/png;base64,dGVzdA==');
 });
 it.each(['audio/mp4','audio/webm;codecs=opus','image/heic'])('rejects unsupported %s without calling any provider',async mime=>{
  const fetcher=vi.fn();const result=await generateContent(body(mime),{deepseek:'test',gemini:'media-only'},fetcher);expect(result.status).toBe(415);expect(fetcher).not.toHaveBeenCalled();
 });
 it('does not silently send text to Google when DeepSeek is missing',async()=>{
  const fetcher=vi.fn();const result=await generateContent(body(),{gemini:'media-only'},fetcher);expect(result.status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
 });
 it('returns a clear timeout without a paid fallback',async()=>{
  const fetcher=vi.fn(async()=>{throw new Error('timeout');});
  const result=await generateContent(body(),{deepseek:'test',gemini:'unused'},fetcher);
  expect(result.status).toBe(504);expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('normalizes successful responses and rejects truncated action JSON',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"answer":"OK"}'}}]}),{status:200});const result=await generateContent(body(),{deepseek:'test'},fetcher);expect(result.body.provider).toBe('deepseek');expect(result.body.candidates[0].content.parts[0].text).toBe('{"answer":"OK"}');
  const truncated=await generateContent(body(),{deepseek:'test'},async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"answer":'}}]}),{status:200}));expect(truncated.status).toBe(502);
 });
});
