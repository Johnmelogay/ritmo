import { AI_MODEL } from './model.mjs';

export const needsMediaCompatibility = body => body.contents.some(message => message.parts.some(part => part.inlineData && !/^image\/(jpeg|png|webp|gif)$/i.test(part.inlineData.mimeType)));

function jsonSchema(value) {
 if(Array.isArray(value))return value.map(jsonSchema);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='type'&&typeof item==='string'?item.toLowerCase():jsonSchema(item)]));
}

export function deepseekRequest(body) {
 const config=body.generationConfig??{};
 const system=(body.systemInstruction?.parts??[]).map(part=>part.text).join('\n');
 const structured=config.responseMimeType==='application/json'||!!config.responseSchema;
 const format=structured?`\nRetorne somente JSON válido, sem markdown.${config.responseSchema?` Siga este esquema JSON: ${JSON.stringify(jsonSchema(config.responseSchema))}`:''}`:'';
 const messages=[...(system||format?[{role:'system',content:system+format}]:[]),...body.contents.map(message=>({role:message.role==='model'?'assistant':'user',content:message.parts.map(part=>part.text!==undefined?{type:'text',text:part.text}:{type:'image_url',image_url:{url:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}})}))];
 return {model:AI_MODEL,messages,thinking:{type:'disabled'},stream:false,max_tokens:config.maxOutputTokens??4096,...(config.temperature!==undefined?{temperature:config.temperature}:{}),...(structured?{response_format:{type:'json_object'}}:{})};
}

export async function generateContent(body,keys,transport=fetch) {
 const provider='deepseek';
 if(needsMediaCompatibility(body))return {status:415,body:{error:{provider,message:'DeepSeek não recebe áudio nem HEIC. Use o ditado do teclado para enviar texto, ou uma imagem JPEG/PNG/WebP. Nenhum outro provedor será usado.'}}};
 const key=keys.deepseek;
 if(!key)return {status:503,body:{error:{provider,message:'O backend DeepSeek precisa ser configurado.'}}};
 let response;
 try { response=await transport('https://api.deepseek.com/chat/completions',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
  body:JSON.stringify(deepseekRequest(body)),signal:AbortSignal.timeout(45000)
 }); } catch { return {status:504,body:{error:{provider,message:'DeepSeek demorou para responder ou está sem conexão. Tente novamente; nenhum outro provedor foi acionado.'}}}; }
 if(!response.ok){
  const message=response.status===402?'O saldo do DeepSeek está esgotado. Adicione créditos no painel DeepSeek.':response.status===401||response.status===403?'O DeepSeek recusou a credencial do backend.':response.status===429?'O DeepSeek atingiu o limite de solicitações. Aguarde e tente novamente.':`O DeepSeek não concluiu a solicitação (${response.status}).`;
  return {status:response.status,body:{error:{provider,message}}};
 }
 const data=await response.json();
 const choice=data.choices?.[0],text=choice?.message?.content;
 if(!text||choice.finish_reason==='length')return {status:502,body:{error:{provider,message:'A IA retornou uma resposta vazia ou incompleta. Nenhuma alteração foi executada.'}}};
 return {status:200,body:{candidates:[{content:{role:'model',parts:[{text}]}}],modelVersion:data.model??AI_MODEL,provider:'deepseek',usageMetadata:data.usage}};
}
