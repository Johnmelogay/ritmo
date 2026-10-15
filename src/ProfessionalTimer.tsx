import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Clock3, Pause, Play, X } from 'lucide-react';
import type { Session } from './domain';
import type { SessionPatch } from './TrainingSession';

const clock=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
export function SessionClock({startedAt}:{startedAt:string}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const tick=()=>setNow(Date.now());const id=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',tick);};},[]);
 return <span className="session-clock"><Clock3 size={16}/>Tempo de treino: {clock(Math.max(0,Math.floor((now-new Date(startedAt).getTime())/1000)))}</span>;
}
export function ProfessionalTimer({session,onPatch}:{session:Session;onPatch:SessionPatch}){
 const [now,setNow]=useState(Date.now()),[sound,setSound]=useState(false);const audio=useRef<AudioContext|null>(null),announced=useRef<number|null>(null);
 const paused=session.restPausedSeconds!=null;const seconds=paused?session.restPausedSeconds!:session.restEnd?Math.max(0,Math.ceil((session.restEnd-now)/1000)):0;
 useEffect(()=>{setNow(Date.now());if(!session.restEnd)return;const tick=()=>setNow(Date.now()),id=setInterval(tick,500);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',tick);};},[session.restEnd]);
 useEffect(()=>{if(!session.restEnd||seconds!==0||paused||announced.current===session.restEnd)return;announced.current=session.restEnd;if(sound&&audio.current&&document.visibilityState==='visible'){const oscillator=audio.current.createOscillator(),gain=audio.current.createGain();oscillator.frequency.value=880;gain.gain.value=.12;oscillator.connect(gain);gain.connect(audio.current.destination);oscillator.start();oscillator.stop(audio.current.currentTime+.3);}},[session.restEnd,seconds,paused,sound]);
 useEffect(()=>()=>{void audio.current?.close();},[]);
 if(!session.restEnd&&!paused)return null;
 const total=Math.max(1,session.restDuration??seconds),fraction=Math.min(1,seconds/total);
 function start(duration:number){onPatch(current=>({...current,restEnd:Date.now()+duration*1000,restPausedSeconds:null,restDuration:duration}));}
 return <section className="professional-timer" role="timer" aria-label="Cronômetro de descanso"><div className="timer-dial" style={{background:`conic-gradient(#446f4d ${fraction*360}deg,#dfe9da 0deg)`}}><div><strong>{clock(seconds)}</strong><span>{paused?'Pausado':seconds?'Descanso':'Pode continuar'}</span></div></div><div className="timer-controls"><div className="timer-heading"><strong>Seu intervalo</strong><button className="icon-button" aria-label="Encerrar descanso" onClick={()=>onPatch(current=>({...current,restEnd:null,restPausedSeconds:null}))}><X size={20}/></button></div><div className="timer-main-actions"><button className="button secondary" onClick={()=>{if(paused)start(session.restPausedSeconds!);else onPatch(current=>({...current,restPausedSeconds:Math.max(0,Math.ceil(((current.restEnd??Date.now())-Date.now())/1000)),restEnd:null}));}}>{paused?<Play size={18}/>:<Pause size={18}/>} {paused?'Continuar':'Pausar'}</button><button className="button secondary" onClick={()=>{if(paused)onPatch(current=>({...current,restPausedSeconds:Math.min(3600,(current.restPausedSeconds??0)+15),restDuration:Math.min(3600,(current.restDuration??seconds)+15)}));else start(Math.min(3600,seconds+15));}}>+15s</button><button className="button primary" onClick={()=>onPatch(current=>({...current,restEnd:null,restPausedSeconds:null}))}><Check size={18}/>Pular</button></div><div className="timer-presets">{[30,60,90,120].map(duration=><button key={duration} onClick={()=>start(duration)} aria-label={`Definir descanso de ${duration} segundos`}>{duration}s</button>)}</div><button className="text-button" onClick={async()=>{if(!sound){try{audio.current??=new AudioContext();await audio.current.resume();setSound(true);}catch{setSound(false);}}else setSound(false);}}><Bell size={15}/>Som: {sound?'ligado':'desligado'}</button><small>O tempo continua ao alternar apps. O iPhone pode suspender sons em segundo plano.</small></div></section>;
}
