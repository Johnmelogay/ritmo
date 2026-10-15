import { useEffect } from 'react';
export function KeyboardFrame(){
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>document.documentElement.style.setProperty('--keyboard-offset',`${Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)}px`);update();viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);return()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);document.documentElement.style.removeProperty('--keyboard-offset');};},[]);
 return null;
}
