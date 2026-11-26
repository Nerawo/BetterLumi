import {useEffect,useRef,useState,type PointerEvent} from 'react';

type Gesture={
 id:string;pointer:number;start:number;y:number;initialScroll:number;frame:number;
 rows:HTMLElement[];positions:DOMRect[];from:number;to:number;scroll:HTMLElement;
};
export function useCollectionDrag(move:(id:string,target:string)=>void){
 const gesture=useRef<Gesture|null>(null),[dragging,setDragging]=useState<string|null>(null);
 const finish=(commit:boolean)=>{
  const g=gesture.current;if(!g)return;
  gesture.current=null;cancelAnimationFrame(g.frame);
  for(const row of g.rows)row.style.removeProperty('transform');
  setDragging(null);
  if(commit&&g.to!==g.from)void move(g.id,g.rows[g.to].dataset.categoryId!);
 };
 useEffect(()=>()=>finish(false),[]);
 const position=(g:Gesture)=>{
  const delta=g.y-g.start+g.scroll.scrollTop-g.initialScroll,source=g.positions[g.from];
  const center=source.top+source.height/2+delta;
  let to=g.from;
  for(const [i,r] of g.positions.entries()){
   if(i>g.from&&center>=r.top+r.height/2)to=i;
   if(i<g.from&&center<=r.top+r.height/2){to=i;break}
  }
  g.to=to;
  for(const [i,row] of g.rows.entries()){
   const offset=i===g.from?delta:i>g.from&&i<=to?-source.height:i<g.from&&i>=to?source.height:0;
   row.style.transform='translateY('+offset+'px)';
  }
 };
 const start=(event:PointerEvent<HTMLButtonElement>,id:string)=>{
  if(event.button!==0||gesture.current)return;
  const list=event.currentTarget.closest<HTMLElement>('.managed-category-list')!;
  const rows=Array.from(list.querySelectorAll<HTMLElement>('[data-category-id]')),from=rows.findIndex(row=>row.dataset.categoryId===id);
  const scroll=list.scrollHeight>list.clientHeight?list:list.closest<HTMLElement>('.modal-scroll')!;
  const g:Gesture={id,pointer:event.pointerId,start:event.clientY,y:event.clientY,initialScroll:scroll.scrollTop,frame:0,rows,positions:rows.map(row=>row.getBoundingClientRect()),from,to:from,scroll};
  gesture.current=g;event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  setDragging(id);
  const tick=()=>{
   if(gesture.current!==g)return;
   const rect=scroll.getBoundingClientRect();
   if(Math.abs(g.y-g.start)>3){if(g.y<rect.top+36)scroll.scrollTop-=7;else if(g.y>rect.bottom-36)scroll.scrollTop+=7}
   position(g);g.frame=requestAnimationFrame(tick);
  };
  g.frame=requestAnimationFrame(tick);
 };
 return {dragging,handle:(id:string)=>({
  onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>start(e,id),
  onPointerMove:(e:PointerEvent<HTMLButtonElement>)=>{const g=gesture.current;if(g?.pointer===e.pointerId){g.y=e.clientY;position(g)}},
  onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>{const g=gesture.current;if(g?.pointer===e.pointerId){g.y=e.clientY;position(g);finish(true)}},
  onPointerCancel:()=>finish(false),onLostPointerCapture:()=>finish(false),
 })};
}
