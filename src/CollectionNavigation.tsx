import {useRef,type RefObject} from 'react';
import {MoreHorizontal} from 'lucide-react';
export function CollectionNavigation({items,active,onChange,label,allLabel,manageLabel,manage,managementRef}:{items:{id:string;name:string;label?:string}[];active:string;onChange:(id:string)=>void;label:string;allLabel:string;manageLabel?:string;manage?:()=>void;managementRef?:RefObject<HTMLButtonElement|null>}){
 const root=useRef<HTMLDivElement>(null);
 const choose=(id:string)=>{onChange(id);requestAnimationFrame(()=>{const selected=root.current?.querySelector<HTMLElement>('[aria-selected=true]'),scroll=selected?.closest<HTMLElement>('.collection-pill-scroll');if(selected&&scroll){const a=selected.getBoundingClientRect(),b=scroll.getBoundingClientRect();if(a.left<b.left)scroll.scrollLeft+=a.left-b.left;else if(a.right>b.right)scroll.scrollLeft+=a.right-b.right}})};
 const pill=(item:{id:string;name:string;label?:string})=><button type="button" role="tab" aria-label={item.label} key={item.id} aria-selected={active===item.id} tabIndex={active===item.id?0:-1} onClick={()=>choose(item.id)}>{item.name}</button>;
 return <div className="category-bar collection-navigation"><div className="category-tabs editorial-pill-nav" role="tablist" aria-label={label} ref={root} onKeyDown={event=>{
  const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
  if(next!==null){event.preventDefault();buttons[next]?.focus({preventScroll:true});choose(next===0?'':items[next-1].id)}
 }}>{pill({id:'',name:allLabel})}<div className="collection-pill-scroll">{items.map(pill)}</div></div>{manage&&<button type="button" ref={managementRef} aria-label={manageLabel} onClick={manage}><MoreHorizontal size={18}/></button>}</div>;
}
