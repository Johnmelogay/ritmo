import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIdentity } from './Identity';

export function CollapsibleCard({ id, title, subtitle, children, defaultOpen=false, className='' }: { id:string;title:string;subtitle?:string;children:ReactNode;defaultOpen?:boolean;className?:string }) {
  const {user}=useIdentity();const contentId=useId();const key=`ritmo-${user?.uid??'local'}-card-${id}`;
  const [open,setOpen]=useState(()=>{try{const saved=localStorage.getItem(key);return saved===null?defaultOpen:saved==='open';}catch{return defaultOpen;}});
  function toggle(){setOpen(previous=>{const next=!previous;try{localStorage.setItem(key,next?'open':'closed');}catch{/* UI preferences must not block the app. */}return next;});}
  return <section className={`card collapsible-card ${open?'is-open':''} ${className}`}><button className="collapse-toggle" type="button" aria-expanded={open} aria-controls={contentId} onClick={toggle}><span><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</span><ChevronDown size={20}/></button><div id={contentId} className="collapse-content" hidden={!open}>{children}</div></section>;
}
