import { bodySchema, dateFrom, dateKey, type BodyRecord } from './domain';

export const bodyFields = [
 ['weight','Peso (kg)',500], ['fat','Gordura corporal (%)',75], ['muscle','Massa muscular (kg)',200],
 ['fatMass','Massa de gordura (kg)',300], ['fatFreeMass','Massa livre de gordura (kg)',300],
 ['waterPercent','Água corporal (%)',100], ['visceralFat','Nível de gordura visceral',100],
 ['basalMetabolism','Metabolismo basal (kcal/dia)',6000], ['height','Altura (cm)',260],
 ['bmi','IMC informado no exame',100], ['waist','Cintura (cm)',300]
] as const;
export type BodyField = typeof bodyFields[number][0];
export type BioDraft = {date:string;measurementTime:string;device:string;muscleType:NonNullable<BodyRecord['muscleType']>} & Record<BodyField,string>;
export const blankBioDraft = ():BioDraft => ({date:'',measurementTime:'',device:'',muscleType:'nao-informada',...Object.fromEntries(bodyFields.map(([k])=>[k,'']))} as BioDraft);
const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const parseNumber=(v:string)=>Number((/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(v)?v.replace(/\./g,''):v).replace(',','.'));

// Only read labeled, explicit results. Missing/ambiguous values stay blank for review.
export function parseBioText(text:string):{draft:BioDraft;warnings:string[]}{
 const draft=blankBioDraft(),warnings:string[]=[];
 const original=text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const lines=original.map(normalize);
 const dates=[...text.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/g)].map(m=>`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
 const iso=[...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0]);
 const dateLine=original.find(v=>/data.*(exame|avaliacao|medicao)|assessment date|test date/i.test(normalize(v)));
 const preferred=dateLine?.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
 if(preferred)draft.date=`${preferred[3]}-${preferred[2].padStart(2,'0')}-${preferred[1].padStart(2,'0')}`;
 else if(new Set([...dates,...iso]).size===1)draft.date=[...dates,...iso][0];
 else if(dates.length+iso.length>1)warnings.push('Há mais de uma data no documento. Confirme a data da avaliação, não a de nascimento ou emissão.');
 if(draft.date&&(Number.isNaN(dateFrom(draft.date).getTime())||dateKey(dateFrom(draft.date))!==draft.date)){draft.date='';warnings.push('A data reconhecida não é válida.');}
 const timeLine=original.find(v=>/horario|hora do exame|test time/i.test(normalize(v)));
 draft.measurementTime=timeLine?.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0]??'';
 const patterns:Record<BodyField,RegExp>={
 weight:/^(?:peso(?: corporal)?|weight)\b/,
 fat:/^(?:percentual de gordura(?: corporal)?|gordura corporal|body fat(?: percentage)?|pgc|pbf)\b/,
 muscle:/^(?:massa muscular(?: esqueletica)?|massa de musculo(?: esqueletico)?|skeletal muscle mass|muscle mass|smm|mme)\b/,
 fatMass:/^(?:massa de gordura(?: corporal)?|massa gorda|body fat mass|fat mass)\b/,
 fatFreeMass:/^(?:massa livre de gordura|massa magra|fat free mass|lean body mass)\b/,
 waterPercent:/^(?:agua corporal|body water|total body water)\b/,
 visceralFat:/^(?:nivel de gordura visceral|gordura visceral|visceral fat(?: level)?)\b/,
 basalMetabolism:/^(?:taxa metabolica basal|metabolismo basal|basal metabolic rate|bmr|tmb)\b/,
 height:/^(?:altura|height)\b/,bmi:/^(?:imc|bmi)\b/,waist:/^(?:cintura|circunferencia da cintura|waist)\b/
 };
 for(const [field,,max] of bodyFields){
  const candidates:string[]=[];
  lines.forEach((line,index)=>{
   const label=line.match(patterns[field]);if(!label)return;
   const suffix=line.slice(label[0].length);
   // Avoid taking kg as percent, liters as percent, or reference ranges as measurements.
   if((field==='fat'||field==='waterPercent')&&(/\b(kg|litros?|liters?)\b/.test(suffix)||/\(l\)/.test(suffix)))return;
   const result=suffix.replace(/\([^)]*\)/g,'').replace(/referencia.*|normal.*|ideal.*|intervalo.*/,'').trim();
   const next=result.match(/\d/) ? result : (lines[index+1]??'');
   if(/\d\s*[-–]\s*\d/.test(next))return;
   const values=[...next.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g)];
   if(values.length!==1)return;
   let value=parseNumber(values[0][0]);
   if(field==='height'&&/\bm\b/.test(suffix)&&!suffix.includes('cm'))value*=100;
   if(value>max||value<0||(field==='weight'&&value===0))return;
   candidates.push(String(Math.round(value*100)/100));
   if(field==='muscle')draft.muscleType=/esquelet|skeletal|smm|mme/.test(label[0])?'esqueletica':'muscular';
  });
  if(new Set(candidates).size===1)draft[field]=candidates[0];
  else if(candidates.length>1)warnings.push(`Há resultados diferentes para ${bodyFields.find(([k])=>k===field)![1]}. Confira o exame.`);
 }
 const device=original.find(v=>/inbody|tanita|omron|seca|accuniq/i.test(v));draft.device=device?.slice(0,100)??'';
 if(!draft.date)warnings.push('Informe a data do exame antes de salvar.');
 if(!draft.weight)warnings.push('Peso não identificado com segurança. Informe o valor em kg.');
 return {draft,warnings};
}

export const isBioimpedance=(b:BodyRecord)=>b.kind==='bioimpedance'||(!b.kind&&(b.fat!==null||b.muscle!==null));
export function sortedBody(records:BodyRecord[]){return [...records].sort((a,b)=>a.date.localeCompare(b.date)||(a.measurementTime??'').localeCompare(b.measurementTime??'')||(a.importedAt??'').localeCompare(b.importedAt??'')||a.id.localeCompare(b.id));}
export const latestBioimpedance=(records:BodyRecord[])=>sortedBody(records.filter(isBioimpedance)).at(-1);
export function matchingEvaluation(records:BodyRecord[],candidate:BodyRecord){
 return records.find(b=>b.id!==candidate.id&&isBioimpedance(b)===isBioimpedance(candidate)&&b.date===candidate.date&&(b.measurementTime??'')===(candidate.measurementTime??'')&&b.device.trim().toLowerCase()===candidate.device.trim().toLowerCase());
}
export function validateBodyRecord(record:BodyRecord,currentDate:string){
 const parsed=bodySchema.parse(record);
 if(parsed.date>currentDate)throw new Error('A avaliação não pode ter uma data futura. Confira a data do exame.');
 return parsed;
}
export function bioReport(records:BodyRecord[]){
 const history=sortedBody(records.filter(isBioimpedance));const current=history.at(-1),previous=history.at(-2);
 return {current,previous,weightChange:current&&previous?current.weight-previous.weight:null,fatChange:current&&previous&&current.fat!=null&&previous.fat!=null?current.fat-previous.fat:null};
}
