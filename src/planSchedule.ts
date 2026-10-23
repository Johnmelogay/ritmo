import { dateFrom, shiftDate, today, weekDates, type AppState, type Plan } from './domain';

export const mondayFirst=[1,2,3,4,5,6,0];
export function planSchedule(state:Pick<AppState,'plans'|'sessions'>, date=today()){
  const knownIds=new Set(state.plans.map(plan=>plan.id));
  const matches=(plan:Plan,id:string,name:string)=>id===plan.id||!knownIds.has(id)&&name===plan.name;
  const week=new Set(weekDates(date));
  return state.plans.map(plan=>{
    const completed=state.sessions.filter(session=>session.finishedAt&&session.date<=date&&matches(plan,session.planId,session.name));
    let nextDate:string|null=null;
    for(let offset=0;offset<15;offset++){
      const candidate=shiftDate(date,offset);
      if(plan.days.includes(dateFrom(candidate).getDay())&&!completed.some(session=>session.date===candidate)){nextDate=candidate;break;}
    }
    return {plan,nextDate,isToday:nextDate===date,doneToday:completed.some(session=>session.date===date),completedThisWeek:completed.filter(session=>week.has(session.date)).sort((a,b)=>a.date.localeCompare(b.date)),weekOrder:Math.min(7,...plan.days.map(day=>mondayFirst.indexOf(day)))};
  }).sort((a,b)=>(a.nextDate??'9999').localeCompare(b.nextDate??'9999')||a.weekOrder-b.weekOrder||a.plan.name.localeCompare(b.plan.name,'pt-BR'));
}
