import { describe, expect, it } from 'vitest';
import { createSession, emptyState, ingredient, foods, type AppState, type Plan } from './domain';
import { daysBetween, seasonProgress } from './season';
import { mondayFirst, planSchedule } from './planSchedule';

const plan=(id:string,days:number[]):Plan=>({id,name:id,days,subtitle:'',origin:'usuario',version:1,exercises:[]});
function state():AppState{const next=emptyState();next.profile.season={name:'Ciclo real',startDate:'2026-10-13',days:60,workoutsPerWeek:4,startWeight:80,targetWeight:76};return next;}
describe('challenge uses the calendar without fabricating physiological progress',()=>{
 it('counts the start day inclusively and clamps before/after the cycle',()=>{
  expect(seasonProgress(state(),'2026-10-16')).toMatchObject({day:4,total:60,remaining:56,ended:false,notStarted:false});
  expect(seasonProgress(state(),'2026-10-12')).toMatchObject({day:0,notStarted:true});
  expect(seasonProgress(state(),'2026-12-20')).toMatchObject({day:60,remaining:0,ended:true});
 });
 it('uses civil dates independent of daylight saving time',()=>{expect(daysBetween('2026-03-07','2026-03-09')).toBe(2);});
 it('counts only completed, in-period workouts against the full cycle target',()=>{
  const next=state(),finished=createSession(plan('A',[2]),'2026-10-13'),unfinished=createSession(plan('B',[5]),'2026-10-16');finished.finishedAt='2026-10-13T18:00:00Z';const future={...finished,id:'future',date:'2026-10-20'};next.sessions=[finished,unfinished,future];
  const progress=seasonProgress(next,'2026-10-16')!;expect(progress.training.done).toBe(1);expect(progress.training.pct).toBeCloseTo(100/progress.training.target);expect(progress.training.pct).toBeLessThan(100);
 });
 it('ignores future measurements and does not score missing or maintenance weights',()=>{
  const next=state();next.body=[{id:'future',date:'2026-11-01',weight:76,fat:null,muscle:null,waist:null,device:'',notes:''}];expect(seasonProgress(next,'2026-10-16')!.weight.available).toBe(false);
  next.body=[{...next.body[0],date:'2026-10-16',weight:78}];expect(seasonProgress(next,'2026-10-16')!.weight.pct).toBe(50);
  next.profile.season!.targetWeight=80;expect(seasonProgress(next,'2026-10-16')!.weight.available).toBe(false);
 });
 it('labels nutritional coverage, never a partly logged day as dietary adherence',()=>{
  const next=state();next.meals=[{id:'m',date:'2026-10-16',time:'12:00',name:'Almoço',method:'manual',notes:'',updatedAt:'',items:[ingredient(foods[0],100)]}];const progress=seasonProgress(next,'2026-10-16')!;
  expect(progress.nutrition).toMatchObject({logged:1,reviewed:0,considered:4,pct:25});expect(progress.nutrition.detail).toContain('com refeições');
 });
});
describe('plan priority follows the next unfinished occurrence with Monday-first weekdays',()=>{
 it('puts today first, then upcoming days; completed today rotates to its next date',()=>{
  const next=emptyState();next.plans=[plan('Segunda',[1]),plan('Sexta',[5]),plan('Terça',[2])];expect(planSchedule(next,'2026-10-16').map(entry=>entry.plan.id)).toEqual(['Sexta','Segunda','Terça']);
  const session=createSession(next.plans[1],'2026-10-16');session.finishedAt='2026-10-16T18:00:00Z';next.sessions=[session];expect(planSchedule(next,'2026-10-16').map(entry=>entry.plan.id)).toEqual(['Segunda','Terça','Sexta']);
 });
 it('does not count an unfinished workout or a namesake copy as completed',()=>{
  const next=emptyState();next.plans=[plan('A',[5]),{...plan('B',[5]),name:'A'}];const session=createSession(next.plans[0],'2026-10-16');next.sessions=[session];expect(planSchedule(next,'2026-10-16')[0].isToday).toBe(true);session.finishedAt='done';const result=planSchedule(next,'2026-10-16');expect(result.find(entry=>entry.plan.id==='B')!.isToday).toBe(true);
 });
 it('keeps multiple weekly occurrences and places unscheduled plans last',()=>{
  const next=emptyState();next.plans=[plan('Livre',[]),plan('A',[1,3]),plan('B',[2])];const session=createSession(next.plans[1],'2026-10-19');session.finishedAt='done';next.sessions=[session];expect(planSchedule(next,'2026-10-19').map(entry=>entry.plan.id)).toEqual(['B','A','Livre']);expect(mondayFirst).toEqual([1,2,3,4,5,6,0]);
 });
});
