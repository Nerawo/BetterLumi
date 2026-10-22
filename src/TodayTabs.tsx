import {useLayoutEffect,useRef,type KeyboardEvent,type ReactNode} from "react";
import {useTranslation} from "react-i18next";

export const todayTabs=["food","activity","supplements","weight","more","calculator"] as const;
export type TodayTab=typeof todayTabs[number];
export function TodayTabs({active,onChange,children}:{active:TodayTab;onChange:(tab:TodayTab)=>void;children:Record<TodayTab,ReactNode>}){
 const {t,i18n}=useTranslation(),buttons=useRef<Partial<Record<TodayTab,HTMLButtonElement|null>>>({});
 // Restoring a tab should reveal its pill without moving the page vertically.
 useLayoutEffect(()=>{const button=buttons.current[active],bar=button?.closest('.today-navigation-strip');if(!button||!(bar instanceof HTMLElement))return;const reveal=()=>{const a=button.getBoundingClientRect(),b=bar.getBoundingClientRect();if(a.right>b.right)bar.scrollLeft+=a.right-b.right;else if(a.left<b.left)bar.scrollLeft-=b.left-a.left};reveal();const observer=new ResizeObserver(reveal);observer.observe(bar);Array.from(bar.children).forEach(child=>observer.observe(child));return()=>observer.disconnect()},[active,i18n.language]);
 const select=(tab:TodayTab)=>{onChange(tab);buttons.current[tab]?.scrollIntoView({block:"nearest",inline:"nearest"})};
 const keyboard=(event:KeyboardEvent<HTMLButtonElement>,tab:TodayTab)=>{
  const index=todayTabs.indexOf(tab);
  const next=event.key==="ArrowRight"?(index+1)%todayTabs.length:event.key==="ArrowLeft"?(index+todayTabs.length-1)%todayTabs.length:event.key==="Home"?0:event.key==="End"?todayTabs.length-1:null;
  if(next===null)return;
  event.preventDefault();select(todayTabs[next]);buttons.current[todayTabs[next]]?.focus({preventScroll:true});
 };
 return <div className="today-journal today-tabs">
  <div className="today-navigation-strip"><div className="today-tab-bar" role="tablist" aria-label={t("todaySections")} aria-orientation="horizontal">
   {todayTabs.map(tab=><button type="button" role="tab" id={"today-tab-"+tab} aria-controls={"today-panel-"+tab} aria-selected={active===tab} tabIndex={active===tab?0:-1} ref={node=>{buttons.current[tab]=node}} key={tab} onClick={()=>select(tab)} onKeyDown={event=>keyboard(event,tab)}>{t("todayTab"+tab)}</button>)}
  </div></div>
  {todayTabs.map(tab=><section className="today-tab-panel" role="tabpanel" id={"today-panel-"+tab} aria-labelledby={"today-tab-"+tab} hidden={active!==tab} tabIndex={0} key={tab}>{children[tab]}</section>)}
 </div>;
}
