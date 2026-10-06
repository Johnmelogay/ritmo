import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Loader2, Download, Check, Pencil } from 'lucide-react';
import { Modal, SectionHead } from './components';
import { today, uid, number, formatDate, csv, download, type BodyRecord } from './domain';
import { bodyFields, blankBioDraft, parseBioText, latestBioimpedance, matchingEvaluation, validateBodyRecord, sortedBody, bioReport, type BioDraft, type BodyField } from './bioimpedance';
import { extractBioimpedanceWithGemini, getAiStatus } from './ai';

export function exportBody(records:BodyRecord[]){
 return csv([['data_exame','hora_exame','tipo',...bodyFields.map(([k])=>k),'tipo_massa_muscular','aparelho','origem','importado_em','arquivo','observacoes'],...sortedBody(records).map(b=>[b.date,b.measurementTime??'',b.kind??'legado',...bodyFields.map(([k])=>b[k]??null),b.muscleType??'',b.device,b.source??'manual',b.importedAt??'',b.fileName??'',b.notes])]);
}
function draftFrom(b:BodyRecord):BioDraft{return {date:b.date,measurementTime:b.measurementTime??'',device:b.device,muscleType:b.muscleType??'nao-informada',...Object.fromEntries(bodyFields.map(([k])=>[k,b[k]==null?'':String(b[k])]))} as BioDraft;}

export function BioModal({records,date,existing,onClose,onSave}:{records:BodyRecord[];date:string;existing?:BodyRecord;onClose:()=>void;onSave:(record:BodyRecord,replaceId?:string)=>void}){
 const [draft,setDraft]=useState<BioDraft>(existing?draftFrom(existing):{...blankBioDraft(),date});
 const [kind,setKind]=useState<'measurement'|'bioimpedance'>(existing?.kind??'bioimpedance');
 const [mode,setMode]=useState<'manual'|'image'|'text'>('manual');const [text,setText]=useState(existing?.sourceText??'');
 const [source,setSource]=useState<BodyRecord['source']>(existing?.source??'manual');const [fileName,setFileName]=useState(existing?.fileName??'');
 const [preview,setPreview]=useState('');const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');
 const [warnings,setWarnings]=useState<string[]>([]);const [error,setError]=useState('');const [notes,setNotes]=useState(existing?.notes??'');
 const [confirmed,setConfirmed]=useState(false);const [replace,setReplace]=useState(false);
 const mounted=useRef(true);const worker=useRef<Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;void worker.current?.terminate();};},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 function change(key:keyof BioDraft,value:string){setDraft(d=>({...d,[key]:value}));setConfirmed(false);setReplace(false);}
 function extract(raw:string,origin:'image'|'text'){
  const result=parseBioText(raw);setDraft(result.draft);setWarnings(result.warnings);setText(raw);setSource(origin);setKind('bioimpedance');setConfirmed(false);setReplace(false);setError('');
 }
 async function image(file:File){
  setError('');setConfirmed(false);setBusy(true);setStatus('Preparando leitura…');
  try{
   if(file.size>12*1024*1024)throw new Error('Escolha uma imagem de até 12 MB.');
   if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('Use um screenshot PNG, JPG ou WebP. Para HEIC, exporte a imagem como JPG.');
   if(!mounted.current)return;setPreview(URL.createObjectURL(file));setFileName(file.name.slice(0,200));

   if(getAiStatus().gemini){
     setStatus('Lendo laudo com Gemini 2.5 Flash Vision…');
     try{
       const aiRes=await extractBioimpedanceWithGemini(file);
       if(mounted.current){
         setDraft(aiRes.draft);
         setWarnings(aiRes.warnings);
         setSource('image');
         setKind('bioimpedance');
         setConfirmed(false);
         setReplace(false);
         setError('');
         return;
       }
     }catch(aiErr){
       console.warn('Gemini vision falhou, usando leitor local:', aiErr);
     }
   }

   const bitmap=await createImageBitmap(file);
   if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('A imagem é muito grande. Recorte a área dos resultados.');}
   const canvas=document.createElement('canvas');const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw new Error('Não foi possível abrir a imagem.');}
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao preparar imagem.')),'image/png'));
   if(!mounted.current)return;
   const {createWorker}=await import('tesseract.js');
   const reader=await createWorker('por+eng',1,{logger:m=>{if(mounted.current)setStatus(m.status==='recognizing text'?`Lendo resultados… ${Math.round(m.progress*100)}%`:'Carregando leitor…');}});
   if(!mounted.current){await reader.terminate();return;}worker.current=reader;
   try{const result=await reader.recognize(blob);if(mounted.current){extract(result.data.text.slice(0,30000),'image');if(result.data.confidence<65)setWarnings(w=>['A imagem tem trechos pouco legíveis. Confira os valores com o original.',...w]);}}
   finally{await reader.terminate();worker.current=null;}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Não foi possível ler. Use texto ou preencha os resultados.');}
  finally{if(mounted.current){setBusy(false);setStatus('');}}
 }
 function record():BodyRecord{
  return {id:existing?.id??uid(),date:draft.date,measurementTime:draft.measurementTime||null,weight:Number(draft.weight),fat:draft.fat===''?null:Number(draft.fat),muscle:draft.muscle===''?null:Number(draft.muscle),waist:draft.waist===''?null:Number(draft.waist),
   ...Object.fromEntries(bodyFields.filter(([k])=>!['weight','fat','muscle','waist'].includes(k)).map(([k])=>[k,draft[k]===''?null:Number(draft[k])])),
   device:draft.device,notes,kind,muscleType:draft.muscleType,source,importedAt:existing?.importedAt??new Date().toISOString(),...(source==='image'?{fileName}:{}),...(source!=='manual'?{sourceText:text.slice(0,30000)}:{})};
 }
 const duplicate=draft.date&&draft.weight?matchingEvaluation(records,record()):undefined;
 const latest=latestBioimpedance(records);const historical=latest&&draft.date<latest.date;
 return <Modal wide title={existing?'Revisar avaliação':'Importar bioimpedância'} subtitle="A data do exame organiza seu histórico e atualiza seu perfil corporal." onClose={onClose}>
  <form onSubmit={e=>{e.preventDefault();setError('');try{if(!confirmed)throw new Error('Confira os resultados e confirme a revisão.');if(duplicate&&!replace)throw new Error('Já existe uma avaliação nessa data, horário e aparelho. Confirme a substituição ou informe outro horário.');const next=validateBodyRecord(record(),today());onSave(next,duplicate?.id);}catch(err){setError(err instanceof Error&&err.message.length<180?err.message:'Confira os campos. Massas não podem ultrapassar o peso corporal.');}}}>
   <div className="modal-body">
    <div className="capture-tabs bio-tabs">{[['manual','Preencher'],['image','Screenshot'],['text','Colar texto']].map(([key,label])=><button type="button" disabled={busy} className={mode===key?'selected':''} key={key} onClick={()=>setMode(key as typeof mode)}>{key==='image'?<Camera size={16}/>:<FileText size={16}/>} {label}</button>)}</div>
    {mode==='image'&&<><label className="photo-drop bio-photo">{preview?<img src={preview} alt="Screenshot da avaliação para conferência"/>:<><Camera size={30}/><strong>Escolha o screenshot do exame</strong><span>PNG, JPG ou WebP · até 12 MB</span></>}<input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Screenshot de bioimpedância" onChange={e=>{const file=e.target.files?.[0];if(file)void image(file);e.target.value='';}}/></label><p className="small muted">Leitura no dispositivo. Na primeira vez, o leitor precisa de internet para carregar. A imagem não é enviada a uma IA e não fica no backup; o texto reconhecido fica no registro.</p></>}
    {mode==='text'&&<><label>Texto do exame<textarea maxLength={30000} rows={5} value={text} onChange={e=>{setText(e.target.value);setConfirmed(false);}} placeholder={'Data da avaliação: 06/10/2026\nPeso (kg): 82,8\nGordura corporal (%): 19,5\nMassa muscular esquelética (kg): 36,4'}/></label><button className="button secondary" type="button" disabled={!text.trim()||busy} onClick={()=>extract(text,'text')}>Preencher a partir do texto</button></>}
    {busy&&<p role="status" className="notice"><Loader2 size={16} className="spin"/> {status}</p>}
    {!!warnings.length&&<div className="notice" role="status">{warnings.map(w=><p key={w}>{w}</p>)}</div>}
    <div className="meal-review"><h3>Confira os resultados do exame</h3>
     <div className="form-row"><label>Data da avaliação<input type="date" value={draft.date} max={today()} required onChange={e=>change('date',e.target.value)}/></label><label>Horário do exame (opcional)<input type="time" value={draft.measurementTime} onChange={e=>change('measurementTime',e.target.value)}/></label></div>
     <label>Tipo de registro<select value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setConfirmed(false);}}><option value="bioimpedance">Avaliação de bioimpedância</option><option value="measurement">Pesagem / medidas</option></select></label>
     <div className="form-row">{bodyFields.map(([key,label,max])=><label key={key}>{label}<input type="number" min={key==='weight'?0.1:0} max={max} step="0.01" required={key==='weight'} value={draft[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div>
     <label>Tipo de massa muscular<select value={draft.muscleType} onChange={e=>change('muscleType',e.target.value)}><option value="nao-informada">Não especificado no exame</option><option value="esqueletica">Massa muscular esquelética</option><option value="muscular">Massa muscular total informada</option></select></label>
     <label>Aparelho / método<input maxLength={100} value={draft.device} onChange={e=>change('device',e.target.value)} placeholder="Ex.: InBody 270"/></label>
     <label>Condições e observações<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     {historical?<p className="notice">Esta avaliação é anterior à atual. Será adicionada ao histórico na data do exame; a avaliação de {formatDate(latest.date)} continuará sendo a mais recente do perfil.</p>:<p className="notice">Ao salvar, seu perfil corporal e relatório serão atualizados pela data da avaliação. As metas de dieta e treino continuam disponíveis para revisão.</p>}
     {duplicate&&<label className="bio-confirm"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/><span>Já existe uma avaliação nessa data, horário e aparelho. Substituir o registro existente pelos valores revisados.</span></label>}
     <label className="bio-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Conferi a data, as unidades e os valores com o exame. Campos não informados ficam em branco.</span></label>
     {error&&<p className="error" role="alert">{error}</p>}
    </div>
   </div><footer className="modal-footer"><span className="small muted">kg · % · cm · kcal/dia</span><button className="button primary" disabled={busy||!confirmed}><Check size={16}/>Salvar e atualizar perfil</button></footer>
  </form>
 </Modal>;
}

export function BodySummary({record}:{record:BodyRecord}){
 return <div className="bio-summary"><p className="small muted">{formatDate(record.date)}{record.measurementTime?` · ${record.measurementTime}`:''} · {record.device||'Aparelho não informado'}</p><div className="body-metrics">{bodyFields.filter(([k])=>record[k]!=null).map(([k,label])=><div key={k}><span>{label}</span><strong>{number(record[k]!,2)}</strong></div>)}</div>{record.muscle!=null&&<p className="small muted">Massa muscular: {record.muscleType==='esqueletica'?'esquelética':record.muscleType==='muscular'?'total informada':'tipo não especificado'}. Massa livre de gordura é um campo separado.</p>}{record.notes&&<p className="small muted">{record.notes}</p>}</div>;
}
export function BioPanel({records,onAdd,onEdit}:{records:BodyRecord[];onAdd:()=>void;onEdit:(b:BodyRecord)=>void}){
 const report=bioReport(records);
 return <section className="card"><SectionHead title="Bioimpedância e relatório" subtitle="Organizado pela data do exame" action={<button className="button secondary" onClick={onAdd}><Camera size={16}/>Importar exame</button>}/>{report.current?<><BodySummary record={report.current}/>{report.previous&&<p className="notice">Desde {formatDate(report.previous.date)}: {number(report.weightChange!,2)} kg{report.fatChange!=null?` · ${number(report.fatChange,2)} pontos percentuais de gordura`:''}. {report.current.device!==report.previous.device?'As avaliações usam aparelhos diferentes.':''}</p>}<button className="text-button" onClick={()=>download('ritmo-bioimpedancia.csv',exportBody(records),'text/csv;charset=utf-8')}><Download size={16}/>Exportar relatório CSV</button></>:<p className="muted">Importe um screenshot ou registre sua primeira avaliação.</p>}<div className="body-history">{sortedBody(records).reverse().map(b=><button className="bio-history-row" key={b.id} onClick={()=>onEdit(b)}><span>{formatDate(b.date,{day:'2-digit',month:'short',year:'numeric'})}</span><strong>{number(b.weight,2)} kg</strong><span>{b.kind==='measurement'?'Pesagem':b.source==='image'?'Screenshot revisado':b.source==='text'?'Texto revisado':'Registro manual'}</span><Pencil size={14}/></button>)}</div></section>;
}
