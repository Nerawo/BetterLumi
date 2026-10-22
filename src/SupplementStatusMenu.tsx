import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {useTranslation} from "react-i18next";
import {ChevronDown} from "lucide-react";
import type {Check} from "./db";
const values=["unconfirmed","taken","skipped"] as const;
export function SupplementStatusMenu({value,name,disabled,onChange}:{value:Check["status"];name:string;disabled:boolean;onChange:(value:Check["status"])=>Promise<void>}) {
 const {t}=useTranslation(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener("pointerdown",outside);menu.current?.querySelectorAll<HTMLButtonElement>("button")[values.indexOf(value)]?.focus({preventScroll:true});return()=>document.removeEventListener("pointerdown",outside)},[open]);
 const [above,setAbove]=useState(false);
 useLayoutEffect(()=>{if(!open||!trigger.current||!menu.current)return;const rect=trigger.current.getBoundingClientRect(),viewport=window.visualViewport,top=viewport?.offsetTop??0,bottom=top+(viewport?.height??innerHeight),navigation=document.querySelector('.mobile-nav')?.getBoundingClientRect().top??bottom,spaceBelow=Math.min(bottom,navigation)-rect.bottom;setAbove(spaceBelow<menu.current.offsetHeight+8&&rect.top-top>spaceBelow)},[open]);
 const close=()=>{setOpen(false);trigger.current?.focus({preventScroll:true})};
 return <div className="supplement-status-menu" data-placement={above?"above":"below"} ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();close()}if(open&&["ArrowDown","ArrowUp","Home","End"].includes(e.key)){e.preventDefault();const buttons=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button")??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[e.key==="Home"?0:e.key==="End"?2:(index+(e.key==="ArrowDown"?1:2))%3]?.focus()}}}>
 <button type="button" className="supplement-status" data-status={value} ref={trigger} aria-label={name+" · "+t(value)} aria-haspopup="menu" aria-expanded={open} disabled={disabled||busy} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setOpen(true)}}}>{t(value)}<ChevronDown size={13}/></button>
 {open&&<div className="supplement-status-options" ref={menu} role="menu" aria-label={name}>{values.map(status=><button key={status} type="button" role="menuitemradio" aria-checked={status===value} onClick={async()=>{close();setBusy(true);try{await onChange(status)}finally{setBusy(false)}}}>{t(status)}</button>)}</div>}
 </div>;
}
