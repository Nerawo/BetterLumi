import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { localDate } from "./db";
import { formatLocalDate } from "./dates";
import { shiftMonth } from "./routing";
import { shiftDay, weekDates } from "./exercise-schedule";

/** Only the browsing/focus cursor is local; selected date remains owned by Today. */
export function DatePicker({selected,onSelect,min,max,label,children,field=false,clearable=false}:{selected:string;onSelect:(date:string)=>void;min?:string;max?:string;label?:string;children?:ReactNode;field?:boolean;clearable?:boolean}) {
 const {t,i18n}=useTranslation();
 const [open,setOpen]=useState(false),[cursor,setCursor]=useState(selected||min||localDate());
 const [yearMode,setYearMode]=useState(false);
 const year=Number(cursor.slice(0,4)),yearStart=Math.floor(year/12)*12;
 const [position,setPosition]=useState({top:0,left:0,maxHeight:420});
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const id=useId();
 const inRange=(date:string)=>(!min||date>=min)&&(!max||date<=max);
 const clamp=(date:string)=>min&&date<min?min:max&&date>max?max:date;
 const month=cursor.slice(0,7),first=month+"-01";
 const count=new Date(first+"T12:00:00");
 const total=new Date(count.getFullYear(),count.getMonth()+1,0).getDate();
 const offset=(count.getDay()+6)%7;
 const cells=Array.from({length:Math.ceil((total+offset)/7)*7},(_,index)=>index<offset||index>=offset+total?null:month+"-"+String(index-offset+1).padStart(2,"0"));
 const close=(restore=true)=>{setOpen(false);if(restore)trigger.current?.focus({preventScroll:true})};
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{
   const anchor=trigger.current?.getBoundingClientRect(),box=panel.current;if(!anchor||!box)return;
   const viewport=window.visualViewport;
   const left=viewport?.offsetLeft??0,top=viewport?.offsetTop??0,width=viewport?.width??innerWidth,height=viewport?.height??innerHeight;
   const margin=12,available=height-margin*2;
   const panelHeight=Math.min(box.scrollHeight,available);
   const below=anchor.bottom+8;
   const popupWidth=Math.min(336,width-margin*2);
   box.style.width=popupWidth+"px";
   const y=below+panelHeight<=top+height-margin?below:Math.max(top+margin,anchor.top-panelHeight-8);
   const x=Math.max(left+margin,Math.min(anchor.right-popupWidth,left+width-popupWidth-margin));
   setPosition({top:y,left:x,maxHeight:available});
  };
  if(panel.current?.showPopover&&!panel.current.matches(":popover-open"))panel.current.showPopover();
  place();const observer=new ResizeObserver(place);if(panel.current)observer.observe(panel.current);
  window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
  window.visualViewport?.addEventListener("resize",place);window.visualViewport?.addEventListener("scroll",place);
  return()=>{observer.disconnect();window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);window.visualViewport?.removeEventListener("resize",place);window.visualViewport?.removeEventListener("scroll",place)};
 },[open,month]);
 useEffect(()=>{if(open)panel.current?.querySelector<HTMLButtonElement>(yearMode?`[data-picker-year="${year}"]`:`[data-jump-date="${cursor}"]`)?.focus({preventScroll:true})},[open,cursor,yearMode]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close()}};
  document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape,true);
  return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape,true)};
 },[open]);
 return <>
  <button type="button" className={field?"date-field-trigger":"date-jump-trigger"} ref={trigger} aria-label={label??t("dateJump")} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{if(open)close();else{setYearMode(false);setCursor(clamp(selected||localDate()));setOpen(true)}}}>{children}<CalendarDays size={17}/></button>
  {open&&createPortal(<div ref={panel} id={id} className="date-jump-panel" popover="manual" role="dialog" aria-label={t("dateJump")} data-month={month} style={{top:position.top,left:position.left,maxHeight:position.maxHeight}} onKeyDown={event=>{
   if(event.key==="Tab"){close();return}
   if(!(event.target as HTMLElement).hasAttribute("data-jump-date"))return;
   let next:string|undefined;
   if(event.key==="ArrowLeft")next=shiftDay(cursor,-1);
   if(event.key==="ArrowRight")next=shiftDay(cursor,1);
   if(event.key==="ArrowUp")next=shiftDay(cursor,-7);
   if(event.key==="ArrowDown")next=shiftDay(cursor,7);
   if(event.key==="Home")next=weekDates(cursor)[0];
   if(event.key==="End")next=weekDates(cursor)[6];
   if(event.key==="PageUp")next=shiftMonth(cursor,event.shiftKey?-12:-1);
   if(event.key==="PageDown")next=shiftMonth(cursor,event.shiftKey?12:1);
   if(next){event.preventDefault();setCursor(clamp(next))}
  }}>
   <div className="date-jump-heading"><button type="button" aria-label={t(yearMode?"previousYears":"monthPrevious")} onClick={()=>setCursor(shiftMonth(cursor,yearMode?-144:-1))}><ChevronLeft size={17}/></button><h3 aria-live="polite"><button type="button" className="date-picker-year-trigger" aria-label={t("chooseYear")} aria-expanded={yearMode} onClick={()=>setYearMode(!yearMode)}>{yearMode?yearStart+"–"+(yearStart+11):formatLocalDate(first,i18n.language,"month")}</button></h3><button type="button" aria-label={t(yearMode?"nextYears":"monthNext")} onClick={()=>setCursor(shiftMonth(cursor,yearMode?144:1))}><ChevronRight size={17}/></button></div>
   {yearMode?<div className="date-picker-years" role="group" aria-label={t("chooseYear")}>{Array.from({length:12},(_,index)=>yearStart+index).map(value=><button type="button" key={value} data-picker-year={value} tabIndex={value===year?0:-1} aria-pressed={String(value)===selected.slice(0,4)} disabled={Boolean(min&&value<Number(min.slice(0,4))||max&&value>Number(max.slice(0,4)))} onClick={()=>{setCursor(clamp(shiftMonth(cursor,(value-year)*12)));setYearMode(false)}} onKeyDown={event=>{const delta=event.key==="ArrowLeft"?-1:event.key==="ArrowRight"?1:event.key==="ArrowUp"?-3:event.key==="ArrowDown"?3:0;if(delta){event.preventDefault();setCursor(clamp(shiftMonth(cursor,delta*12)))}}}>{value}</button>)}</div>:<div role="grid" aria-label={formatLocalDate(first,i18n.language,"month")} className="date-jump-grid">
    <div role="row" className="date-jump-weekdays">{weekDates(first).map(date=><span role="columnheader" key={date}>{formatLocalDate(date,i18n.language,"weekday")}</span>)}</div>
    {Array.from({length:cells.length/7},(_,row)=><div role="row" key={row}>{cells.slice(row*7,row*7+7).map((date,index)=>date?<button type="button" role="gridcell" key={date} data-jump-date={date} disabled={!inRange(date)} aria-label={formatLocalDate(date,i18n.language)} aria-selected={date===selected} aria-current={date===localDate()?"date":undefined} tabIndex={date===cursor?0:-1} onFocus={()=>setCursor(date)} onClick={()=>{onSelect(date);close()}}>{Number(date.slice(-2))}</button>:<span role="gridcell" key={index}/>)}</div>)}
   </div>}
   {clearable&&selected&&<button type="button" className="date-picker-clear text-link" onClick={()=>{onSelect("");close()}}>{t("clearDate")}</button>}
  </div>,trigger.current?.closest("dialog")??document.body)}
 </>;
}
