import { describe, it, expect } from 'vitest';
import { bodySchema, type BodyRecord } from './domain';
import { parseBioText, latestBioimpedance, matchingEvaluation, validateBodyRecord, bioReport } from './bioimpedance';
const record=(date:string,overrides:Partial<BodyRecord>={}):BodyRecord=>({id:date,date,weight:82,fat:20,muscle:35,waist:null,device:'InBody',notes:'',kind:'bioimpedance',...overrides});
describe('importação e cronologia da bioimpedância',()=>{
 it('extrai vírgula decimal, data do exame e massas distintas',()=>{
  const {draft}=parseBioText('Nascimento: 01/02/1990\nData da avaliação: 06/10/2026\nPeso (kg): 82,8\nGordura corporal (%): 19,5\nMassa muscular esquelética (kg): 36,4\nMassa livre de gordura (kg): 66,6\nMetabolismo basal (kcal/dia): 1.756\nInBody 270');
  expect(draft).toMatchObject({date:'2026-10-06',weight:'82.8',fat:'19.5',muscle:'36.4',muscleType:'esqueletica',fatFreeMass:'66.6',basalMetabolism:'1756'});
 });
 it('não converte gordura em kg ou água em litros em porcentagem',()=>{
  const {draft}=parseBioText('Peso: 80\nGordura corporal (kg): 16\nÁgua corporal (L): 42\nMassa livre de gordura: 64');
  expect(draft.fat).toBe('');expect(draft.waterPercent).toBe('');expect(draft.muscle).toBe('');expect(draft.date).toBe('');
 });
 it('deixa resultados ambíguos, referências e datas inválidas para revisão',()=>{
  const {draft}=parseBioText('Data: 31/02/2026\nPeso: 80\nPeso: 82\nGordura corporal: 10 - 20');
  expect(draft.date).toBe('');expect(draft.weight).toBe('');expect(draft.fat).toBe('');
 });
 it('o upload mais recente não substitui um exame com data mais recente',()=>{
  const latest=record('2026-10-05',{importedAt:'2026-10-05T10:00:00Z'}),old=record('2026-09-05',{importedAt:'2026-10-06T10:00:00Z'});
  expect(latestBioimpedance([latest,old])?.id).toBe(latest.id);
  expect(latestBioimpedance([latest,record('2026-10-06',{kind:'measurement',fat:null,muscle:null})])?.id).toBe(latest.id);
 });
 it('usa horário do exame para ordenar avaliações no mesmo dia',()=>{
  const early=record('2026-10-05',{id:'a',measurementTime:'08:00',importedAt:'2026-10-06'}),late=record('2026-10-05',{id:'b',measurementTime:'18:00',importedAt:'2026-10-05'});
  expect(latestBioimpedance([late,early])?.id).toBe('b');
 });
 it('detecta reimportação e permite avaliações em aparelhos ou horários distintos',()=>{
  const saved=record('2026-10-05',{id:'saved'});
  expect(matchingEvaluation([saved],record('2026-10-05',{id:'import'}))?.id).toBe('saved');
  expect(matchingEvaluation([saved],record('2026-10-05',{id:'other',device:'Tanita'}))).toBeUndefined();
 });
 it('rejeita data futura e massa acima do peso, preserva backups antigos',()=>{
  expect(()=>validateBodyRecord(record('2026-10-07'),'2026-10-06')).toThrow();
  expect(()=>bodySchema.parse(record('2026-10-05',{muscle:90}))).toThrow();
  expect(bodySchema.parse({id:'legacy',date:'2026-10-05',weight:80,fat:null,muscle:null,waist:null,device:'',notes:''}).weight).toBe(80);
 });
 it('relatório compara exames cronológicos e preserva valores ausentes',()=>{
  const report=bioReport([record('2026-10-05',{weight:81,fat:null}),record('2026-09-05',{weight:82})]);
  expect(report.weightChange).toBe(-1);expect(report.fatChange).toBeNull();
 });
});
