import { z } from 'zod';

export const today = () => dateKey(new Date());
export function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function dateFrom(key: string) { return new Date(`${key}T12:00:00`); }
export function shiftDate(key: string, n: number) { const d=dateFrom(key); d.setDate(d.getDate()+n); return dateKey(d); }
export function formatDate(key: string, opts?: Intl.DateTimeFormatOptions) { return dateFrom(key).toLocaleDateString('pt-BR',opts??{day:'numeric',month:'long'}); }
export const number = (n:number, digits=0) => n.toLocaleString('pt-BR',{maximumFractionDigits:digits});
export const uid = () => crypto.randomUUID();
const finite = z.number().finite().nonnegative();
const originSchema = z.enum(['personal','ia','usuario']);
export type Origin = z.infer<typeof originSchema>;
export const originName:Record<Origin,string> = {personal:'Personal',ia:'IA',usuario:'Você'};
const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(dateFrom(v).getTime()) && dateKey(dateFrom(v))===v,'Data inválida');
export const foodSchema=z.object({id:z.string(),name:z.string().min(1),kcal:finite.max(1000),protein:finite.max(100),carbs:finite.max(100),fat:finite.max(100),source:z.string(),unit:z.literal('g')});
export type Food=z.infer<typeof foodSchema>;
export const ingredientSchema=z.object({foodId:z.string(),name:z.string().min(1),grams:finite.positive().max(10000),kcal:finite,protein:finite,carbs:finite,fat:finite,source:z.string(),estimated:z.boolean(),minGrams:finite.optional(),maxGrams:finite.optional()});
export type Ingredient=z.infer<typeof ingredientSchema>;
export const mealSchema=z.object({id:z.string(),date:dateSchema,time:z.string().regex(/^\d{2}:\d{2}$/),name:z.string().min(1),items:z.array(ingredientSchema).min(1),method:z.enum(['manual','texto','foto','audio']),notes:z.string(),updatedAt:z.string()});
export type Meal=z.infer<typeof mealSchema>;
export const exerciseSchema=z.object({id:z.string(),name:z.string().min(1),muscle:z.string(),sets:z.number().int().min(1).max(15),reps:z.number().int().min(1).max(100),load:finite.max(1000),rest:z.number().int().min(0).max(1200),origin:originSchema});
export type Exercise=z.infer<typeof exerciseSchema>;
export const planSchema=z.object({id:z.string(),name:z.string().min(1),subtitle:z.string(),days:z.array(z.number().int().min(0).max(6)),exercises:z.array(exerciseSchema),origin:originSchema,version:z.number().int().positive()});
export type Plan=z.infer<typeof planSchema>;
export const setSchema=z.object({id:z.string(),reps:z.number().int().min(0).max(200),load:finite.max(1000),done:z.boolean(),rir:z.number().int().min(0).max(10)});
export const sessionExerciseSchema=exerciseSchema.extend({logs:z.array(setSchema),reason:z.string().optional()});
export const sessionSchema=z.object({id:z.string(),date:dateSchema,planId:z.string(),planVersion:z.number(),name:z.string(),startedAt:z.string(),finishedAt:z.string().nullable(),exercises:z.array(sessionExerciseSchema),restEnd:z.number().nullable(),notes:z.string()});
export type Session=z.infer<typeof sessionSchema>;
export const bodySchema=z.object({id:z.string(),date:dateSchema,weight:z.number().positive().max(500),fat:finite.max(75).nullable(),muscle:finite.max(200).nullable(),waist:finite.max(300).nullable(),device:z.string(),notes:z.string(),
 kind:z.enum(['measurement','bioimpedance']).optional(),measurementTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
 fatMass:finite.max(300).nullable().optional(),fatFreeMass:finite.max(300).nullable().optional(),waterPercent:finite.max(100).nullable().optional(),visceralFat:finite.max(100).nullable().optional(),basalMetabolism:finite.max(6000).nullable().optional(),height:finite.max(260).nullable().optional(),bmi:finite.max(100).nullable().optional(),muscleType:z.enum(['muscular','esqueletica','nao-informada']).optional(),
 source:z.enum(['manual','image','text']).optional(),importedAt:z.string().optional(),fileName:z.string().max(200).optional(),sourceText:z.string().max(30000).optional()
}).superRefine((b,ctx)=>{for(const key of ['muscle','fatMass','fatFreeMass'] as const)if(b[key]!=null&&b[key]!>b.weight)ctx.addIssue({code:'custom',path:[key],message:'A massa não pode ultrapassar o peso corporal.'});});
export type BodyRecord=z.infer<typeof bodySchema>;
export const recoverySchema=z.object({id:z.string(),date:dateSchema,sleep:finite.max(24),energy:z.number().int().min(1).max(10),soreness:z.number().int().min(0).max(10),notes:z.string()});
export type Recovery=z.infer<typeof recoverySchema>;
export const profileSchema=z.object({name:z.string().min(1),goal:z.enum(['Perder gordura','Ganhar massa','Recomposição corporal','Manter peso']),calories:z.number().min(1000).max(6000),protein:z.number().min(30).max(400),carbs:finite.max(900),fat:z.number().min(20).max(250),water:z.number().min(500).max(6000),targetWeight:z.number().min(30).max(300),aiConsent:z.boolean(),routineConsent:z.boolean(),trainTime:z.string(),mealTime:z.string()});
export type Profile=z.infer<typeof profileSchema>;
export const stateSchema=z.object({schemaVersion:z.literal(1),demo:z.boolean(),profile:profileSchema,meals:z.array(mealSchema),plans:z.array(planSchema),sessions:z.array(sessionSchema),body:z.array(bodySchema),recovery:z.array(recoverySchema),water:z.record(finite.max(20000)),reviewed:z.array(dateSchema),dismissed:z.array(z.string()),routineCorrections:z.record(z.string())});
export type AppState=z.infer<typeof stateSchema>;
export const defaultProfile:Profile={name:'Você',goal:'Recomposição corporal',calories:2000,protein:150,carbs:220,fat:60,water:2500,targetWeight:70,aiConsent:true,routineConsent:true,trainTime:'18:00',mealTime:'12:30'};
export const emptyState=():AppState=>({schemaVersion:1,demo:false,profile:{...defaultProfile},meals:[],plans:[],sessions:[],body:[],recovery:[],water:{},reviewed:[],dismissed:[],routineCorrections:{}});

// Values per 100g, small curated catalog. All entries refer to the stated preparation.
export const foods:Food[]=[
 {id:'rice',name:'Arroz branco, cozido',kcal:128,protein:2.5,carbs:28.1,fat:0.2,source:'TACO · 4ª edição · arroz tipo 1, cozido',unit:'g'},
 {id:'chicken',name:'Peito de frango, grelhado',kcal:159,protein:32,carbs:0,fat:2.5,source:'TACO · 4ª edição · peito sem pele, grelhado',unit:'g'},
 {id:'beans',name:'Feijão carioca, cozido',kcal:76,protein:4.8,carbs:13.6,fat:0.5,source:'TACO · 4ª edição · feijão carioca, cozido',unit:'g'},
 {id:'egg',name:'Ovo inteiro, cozido',kcal:146,protein:13.3,carbs:0.6,fat:9.5,source:'TACO · 4ª edição · ovo de galinha inteiro, cozido',unit:'g'},
 {id:'banana',name:'Banana prata',kcal:98,protein:1.3,carbs:26,fat:0.1,source:'TACO · 4ª edição · banana prata, crua',unit:'g'},
 {id:'oats',name:'Aveia em flocos',kcal:394,protein:13.9,carbs:66.6,fat:8.5,source:'TACO · 4ª edição · aveia, flocos, crua',unit:'g'},
 {id:'yogurt',name:'Iogurte natural',kcal:51,protein:4.1,carbs:1.9,fat:3,source:'TACO · 4ª edição · iogurte natural',unit:'g'},
 {id:'broccoli',name:'Brócolis, cozido',kcal:25,protein:2.1,carbs:4.4,fat:0.5,source:'TACO · 4ª edição · brócolis cozido',unit:'g'},
 {id:'olive',name:'Azeite de oliva',kcal:884,protein:0,carbs:0,fat:100,source:'TACO · 4ª edição · azeite de oliva extravirgem',unit:'g'},
 {id:'bread',name:'Pão francês',kcal:300,protein:8,carbs:58.6,fat:3.1,source:'TACO · 4ª edição · pão francês',unit:'g'},
 {id:'sweetpotato',name:'Batata-doce, cozida',kcal:77,protein:0.6,carbs:18.4,fat:0.1,source:'TACO · 4ª edição · batata-doce cozida',unit:'g'}
];
export function ingredient(food:Food,grams:number,estimated=false,minGrams?:number,maxGrams?:number):Ingredient {return ingredientSchema.parse({foodId:food.id,name:food.name,grams,kcal:food.kcal*grams/100,protein:food.protein*grams/100,carbs:food.carbs*grams/100,fat:food.fat*grams/100,source:food.source,estimated,minGrams,maxGrams});}
export function nutrients(items:Ingredient[]) {return items.reduce((a,i)=>({kcal:a.kcal+i.kcal,protein:a.protein+i.protein,carbs:a.carbs+i.carbs,fat:a.fat+i.fat}),{kcal:0,protein:0,carbs:0,fat:0});}
export function dailyTotals(state:AppState,date:string) {return nutrients(state.meals.filter(m=>m.date===date).flatMap(m=>m.items));}
export function weekDates(date:string) {const day=dateFrom(date).getDay(); const start=shiftDate(date,-((day+6)%7)); return Array.from({length:7},(_,i)=>shiftDate(start,i));}
export function monthCells(year:number,month:number):(string|null)[] {const first=new Date(year,month,1,12), offset=(first.getDay()+6)%7; return [...Array(offset).fill(null),...Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>dateKey(new Date(year,month,i+1,12)))];}
export function sessionVolume(session:Session) {return session.exercises.reduce((sum,ex)=>sum+ex.logs.filter(s=>s.done).reduce((n,s)=>n+s.reps*s.load,0),0);}
export function createSession(plan:Plan,date:string):Session {return {id:uid(),date,planId:plan.id,planVersion:plan.version,name:plan.name,startedAt:new Date().toISOString(),finishedAt:null,restEnd:null,notes:'',exercises:plan.exercises.map(ex=>({...ex,logs:Array.from({length:ex.sets},()=>({id:uid(),reps:ex.reps,load:ex.load,done:false,rir:2}))}))};}
export function completedSets(session:Session) {return session.exercises.flatMap(e=>e.logs).filter(s=>s.done).length;}
export function makePlan():Plan {return {id:uid(),name:'Treino A · Membros inferiores',subtitle:'Quadríceps, posteriores e glúteos',days:[1,4],origin:'personal',version:1,exercises:[['Agachamento livre','Quadríceps',4,10,40,120],['Leg press 45°','Quadríceps',3,12,100,90],['Cadeira extensora','Quadríceps',3,12,30,75],['Mesa flexora','Posteriores',3,12,25,75],['Elevação pélvica','Glúteos',3,12,40,90]].map(([name,muscle,sets,reps,load,rest])=>({id:uid(),name:String(name),muscle:String(muscle),sets:Number(sets),reps:Number(reps),load:Number(load),rest:Number(rest),origin:'personal'}))};}
export function demoState():AppState {
 return {...emptyState(),demo:true};
}
export type Suggestion={id:string;title:string;body:string;action:string;kind:'food'|'recovery'|'routine'|'training';evidence?:string};
export function suggestions(state:AppState,date:string):Suggestion[] {
 const out:Suggestion[]=[];const rec=state.recovery.find(r=>r.date===date);const total=dailyTotals(state,date);const meals=state.meals.filter(m=>m.date===date);
 if(rec&&rec.energy<=3)out.push({id:`rest-${date}`,title:'Hoje pede um pouco mais de cuidado',body:'Você registrou pouca disposição. Confira como se sente antes do treino e considere conversar com seu personal sobre o volume.',action:'Ver recuperação',kind:'recovery'});
 if(meals.length&&total.protein<state.profile.protein)out.push({id:`protein-${date}`,title:'Seu próximo prato pode ajudar na proteína',body:`Faltam aproximadamente ${number(state.profile.protein-total.protein)} g para a meta que você definiu. Use uma refeição que já funciona na sua rotina.`,action:'Planejar próxima refeição',kind:'food',evidence:'https://pubmed.ncbi.nlm.nih.gov/28698222/'});
 if(!meals.length)out.push({id:`log-${date}`,title:'Vamos começar pelo que você já comeu?',body:'Um registro ajuda a entender o dia. Você pode escrever, falar ou fotografar a sua refeição.',action:'Registrar refeição',kind:'food'});
 if(state.plans.length&&!state.sessions.some(s=>s.date===date))out.push({id:`workout-${date}`,title:'Seu treino está aqui quando você estiver pronto',body:`Sua janela preferida é ${state.profile.trainTime}. O plano continua disponível se o horário mudar.`,action:'Ver treino',kind:'training'});
 return out.filter(s=>!state.dismissed.includes(s.id));
}
export function routineInsights(state:AppState) {
 if(!state.profile.routineConsent)return [];
 const rows:{key:string;title:string;body:string;count:number}[]=[];
 const meals=state.meals.filter(m=>m.name==='Almoço'); const unique=new Set(meals.map(m=>m.date));
 if(unique.size>=5){const hours=meals.map(m=>Number(m.time.split(':')[0])*60+Number(m.time.split(':')[1])).sort((a,b)=>a-b);const median=hours[Math.floor(hours.length/2)]; rows.push({key:'lunch',title:`Almoço por volta das ${Math.floor(median/60)}h${String(median%60).padStart(2,'0')}`,body:`Padrão observado em ${unique.size} dias registrados. Pode mudar; você pode corrigir aqui.`,count:unique.size});}
 const finished=state.sessions.filter(s=>s.finishedAt);if(finished.length>=4){const hours=finished.map(s=>new Date(s.startedAt).getHours()).sort((a,b)=>a-b);rows.push({key:'workout',title:`Treinos próximos das ${hours[Math.floor(hours.length/2)]}h`,body:`Observado em ${finished.length} sessões concluídas. Ainda não demonstra que esse horário melhora seu desempenho.`,count:finished.length});}
 return rows.filter(r=>state.routineCorrections[r.key]!=='ocultar').map(r=>({...r,title:state.routineCorrections[r.key]||r.title}));
}
export function csv(rows:(string|number|boolean|null)[][]) {return '\ufeff'+rows.map(row=>row.map(value=>{let v=String(value??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}).join(';')).join('\r\n');}
export function download(name:string,content:Blob|string,type='text/plain;charset=utf-8') {const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
export function exportMeals(state:AppState){const rows:(string|number|boolean|null)[][]=[['id','data','horario','refeicao','alimento','quantidade_g','kcal','proteina_g','carboidrato_g','gordura_g','estimado','fonte']]; state.meals.forEach(m=>m.items.forEach(i=>rows.push([m.id,m.date,m.time,m.name,i.name,i.grams,i.kcal,i.protein,i.carbs,i.fat,i.estimated,i.source])));return csv(rows);}
export function exportSets(state:AppState){const rows:(string|number|boolean|null)[][]=[['sessao_id','data','treino','exercicio','origem','serie','carga_kg','repeticoes','rir','concluida']];state.sessions.forEach(s=>s.exercises.forEach(e=>e.logs.forEach((l,i)=>rows.push([s.id,s.date,s.name,e.name,originName[e.origin],i+1,l.load,l.reps,l.rir,l.done]))));return csv(rows);}
