import {useEffect,useRef,type HTMLAttributes} from 'react';

/** No pointer-down cancellation: ordinary checkbox taps and native scrolling stay native. */
export function useCookingRemoval(remove:(id:string)=>void,disabled:boolean){
 const callback=useRef(remove);callback.current=remove;
 const timer=useRef<number|undefined>(undefined),gesture=useRef<{id:string;x:number;y:number;type:string;started:number;blocked:boolean;fired:boolean}|undefined>(undefined);
 const suppress=useRef<{id:string;until:number}|undefined>(undefined);
 const cancel=()=>{window.clearTimeout(timer.current);timer.current=undefined};
 const request=(id:string)=>{cancel();if(gesture.current)gesture.current.fired=true;suppress.current={id,until:performance.now()+1200};callback.current(id)};
 const control=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('button,input,textarea,select,a,[contenteditable=true],.journal-quantity');
 useEffect(()=>{
  const move=(e:PointerEvent)=>{const g=gesture.current;if(g&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>10){g.blocked=true;suppress.current={id:g.id,until:performance.now()+1200};cancel()}};
  const scroll=()=>{const g=gesture.current;if(g){g.blocked=true;suppress.current={id:g.id,until:performance.now()+1200}}cancel()};
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',cancel);window.addEventListener('pointercancel',scroll);window.addEventListener('scroll',scroll,true);
  return()=>{cancel();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',cancel);window.removeEventListener('pointercancel',scroll);window.removeEventListener('scroll',scroll,true)};
 },[]);
 useEffect(()=>{if(disabled)cancel()},[disabled]);
 return (id:string):HTMLAttributes<HTMLDivElement>=>({
  onPointerDown:e=>{cancel();suppress.current=undefined;gesture.current=undefined;if(disabled||control(e.target))return;gesture.current={id,x:e.clientX,y:e.clientY,type:e.pointerType,started:performance.now(),blocked:false,fired:false};if(e.button===0)timer.current=window.setTimeout(()=>{if(gesture.current?.id===id&&!gesture.current.blocked)request(id)},650)},
  onClickCapture:e=>{if(suppress.current?.id===id&&performance.now()<suppress.current.until){e.preventDefault();e.stopPropagation();suppress.current=undefined}},
  onContextMenu:e=>{if(control(e.target))return;e.preventDefault();if(disabled)return;const g=gesture.current;if(g?.id===id&&(g.blocked||g.fired||g.type==='touch'&&performance.now()-g.started<650))return;request(id)},
  onKeyDown:e=>{if(!disabled&&!control(e.target)&&(e.key==='Delete'||e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey)){e.preventDefault();request(id)}}
 });
}
