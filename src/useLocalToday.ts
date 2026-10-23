import { useEffect, useState } from 'react';
import { today } from './domain';

export function useLocalToday(){
 const [date,setDate]=useState(today);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const tick=()=>{setDate(today());const next=new Date();next.setHours(24,0,1,0);clearTimeout(timer);timer=setTimeout(tick,Math.max(1000,next.getTime()-Date.now()));};tick();document.addEventListener('visibilitychange',tick);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 return date;
}
