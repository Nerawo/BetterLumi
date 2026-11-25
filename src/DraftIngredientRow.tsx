import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react';
import {GripHorizontal} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {DraftConfirmation} from './RecipeDraftJournal';

interface Props {
  id:string; name:string; children:ReactNode;
  onDrop:(group:string|undefined,before:string|undefined)=>void;
  onReplace:()=>void; onDelete:()=>void;
}
interface Gesture {
  id:number; x:number; y:number; startX:number; startY:number;
  kind:'handle'|'drag'|'identity'|'swipe'; originTop:number; hold?:ReturnType<typeof setTimeout>; frame?:number;
}
export function DraftIngredientRow({id,name,children,onDrop,onReplace,onDelete}:Props){
  const {t}=useTranslation();
  const shell=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|undefined>(undefined);
  const consumedHold=useRef(false);
  const marker=useRef<HTMLElement|undefined>(undefined),[revealed,setRevealed]=useState(false);
  const [confirmation,setConfirmation]=useState<'replace'|'delete'>();
  const row=()=>shell.current!.querySelector<HTMLElement>('.draft-ingredient')!;
  function stop(){
    const g=gesture.current;if(g){clearTimeout(g.hold);cancelAnimationFrame(g.frame??0)}
    gesture.current=undefined;marker.current?.removeAttribute('data-insertion');marker.current=undefined;
    if(shell.current){delete shell.current.dataset.gesture;shell.current.style.removeProperty('--draft-swipe');row().style.removeProperty('transform')}
  }
  useEffect(()=>{
    const handle=shell.current?.querySelector<HTMLButtonElement>('.draft-grip');
    const surface=shell.current;
    const reserveHandle=(event:TouchEvent)=>{if(event.cancelable)event.preventDefault()};
    const reserveSwipe=(event:TouchEvent)=>{
      if(gesture.current?.kind==='swipe'&&event.cancelable)event.preventDefault();
    };
    const finishHold=(event:TouchEvent)=>{
      if(consumedHold.current&&event.cancelable)event.preventDefault();
      consumedHold.current=false;
    };
    handle?.addEventListener('touchstart',reserveHandle,{passive:false});
    surface?.addEventListener('touchmove',reserveSwipe,{passive:false});
    surface?.addEventListener('touchend',finishHold,{passive:false});
    const cancel=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&(gesture.current||shell.current?.hasAttribute('data-revealed'))){
        e.preventDefault();stop();setRevealed(false)
      }
    };
    document.addEventListener('keydown',cancel);return()=>{
      handle?.removeEventListener('touchstart',reserveHandle);
      surface?.removeEventListener('touchmove',reserveSwipe);
      surface?.removeEventListener('touchend',finishHold);
      document.removeEventListener('keydown',cancel);stop()
    };
  },[]);
  useEffect(()=>{
    if(!revealed)return;
    const outside=(e:Event)=>{if(!(e.target instanceof Element)||!shell.current?.contains(e.target)||!e.target.closest('.draft-remove'))setRevealed(false)};
    document.addEventListener('pointerdown',outside,true);
    return()=>document.removeEventListener('pointerdown',outside,true);
  },[revealed]);
  function destination(x:number,y:number){
    const group=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-group-id]');
    if(!group||group.closest('.journal-group-editor')!==shell.current?.closest('.journal-group-editor'))return;
    const peers=Array.from(group.querySelectorAll<HTMLElement>('.draft-row-shell')).filter(el=>el!==shell.current);
    const next=peers.find(el=>{const box=el.getBoundingClientRect();return y<box.top+box.height/2});
    return {group:group.dataset.groupId||undefined,before:next?.dataset.lineId,marker:next??group.querySelector<HTMLElement>('.line-add')!};
  }
  function follow(){
    const g=gesture.current;if(!g||g.kind!=='drag'||!shell.current)return;
    const scroll=shell.current.closest<HTMLElement>('.recipe-editor-scroll')!;
    const bounds=scroll.getBoundingClientRect();
    if(g.y>=bounds.top&&g.y<=bounds.bottom){
      if(g.y<bounds.top+38)scroll.scrollTop-=7;
      if(g.y>bounds.bottom-38)scroll.scrollTop+=7;
    }
    row().style.transform='translateY('+(g.y-g.startY+g.originTop-shell.current.getBoundingClientRect().top)+'px)';
    const target=destination(g.x,g.y)?.marker;
    if(target!==marker.current){marker.current?.removeAttribute('data-insertion');target?.setAttribute('data-insertion','');marker.current=target}
    g.frame=requestAnimationFrame(follow);
  }
  function start(e:ReactPointerEvent){
    const target=e.target as Element;
    if(e.button!==0||!e.isPrimary||gesture.current)return;
    consumedHold.current=false;
    const handle=target.closest('.draft-grip');
    if(!handle&&e.pointerType==='mouse')return;
    if(!handle&&(!target.closest('.draft-ingredient')||target.closest('button,input,select,a,details,.draft-amount')))return;
    const g:Gesture={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,originTop:shell.current!.getBoundingClientRect().top,kind:handle?'handle':'identity'};
    gesture.current=g;
    if(handle){handle.setPointerCapture(e.pointerId);return}
    if(e.pointerType!=='mouse'&&target.closest('.draft-ingredient-name')){
      g.hold=setTimeout(()=>{consumedHold.current=true;stop();setConfirmation('replace')},520);
      shell.current!.dataset.gesture='hold';
    }
  }
  function move(e:ReactPointerEvent){
    const g=gesture.current;if(!g||g.id!==e.pointerId)return;
    g.x=e.clientX;g.y=e.clientY;const dx=g.x-g.startX,dy=g.y-g.startY;
    if(Math.hypot(dx,dy)<8)return;
    clearTimeout(g.hold);
    if(g.kind==='handle'){g.kind='drag';shell.current!.dataset.gesture='drag';follow()}
    if(g.kind==='identity'){
      if(dx>=0||-dx<1.4*Math.abs(dy)){stop();return}
      g.kind='swipe';shell.current!.dataset.gesture='swipe';shell.current!.setPointerCapture(e.pointerId);
    }
    if(g.kind==='swipe')shell.current!.style.setProperty('--draft-swipe',Math.max(0,-dx)+'px');
  }
  function end(e:ReactPointerEvent){
    const g=gesture.current;if(!g||g.id!==e.pointerId)return;
    const target=g.kind==='drag'?destination(e.clientX,e.clientY):undefined;
    if(g.kind==='swipe')setRevealed(g.startX-e.clientX>=36);
    stop();if(target)onDrop(target.group,target.before);
  }
  return <div ref={shell} data-line-id={id} data-revealed={revealed||undefined} className="draft-row-shell"
    onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={stop} onLostPointerCapture={e=>{if(e.target instanceof Element && (e.target.closest('.draft-grip')||e.target===shell.current))stop()}}
    onContextMenu={e=>{if((e.target as Element).closest('.draft-ingredient-name'))e.preventDefault()}}>
    <button className="draft-remove" disabled={!revealed} aria-hidden={!revealed} type="button" onClick={()=>{setRevealed(false);setConfirmation('delete')}}>{t('delete')}</button>
    <div className="recipe-line draft-ingredient">
      <button className="draft-grip" type="button" aria-label={t('journalLineActions')+' '+name} aria-haspopup="true"
        onClick={e=>{if(e.detail===0){const menu=shell.current!.querySelector('details')!;menu.open=true;menu.querySelector('summary')?.focus()}}}><GripHorizontal size={15}/></button>
      {children}
    </div>
    {confirmation==='delete'&&<DraftConfirmation title={t('draftRemoveLine',{name})}
      action={t('delete')} onCancel={()=>setConfirmation(undefined)} onConfirm={onDelete}/>}
    {confirmation==='replace'&&<DraftConfirmation title={t('draftReplaceTitle')} description={t('draftReplaceDescription',{name})}
      action={t('draftReplace')} onCancel={()=>setConfirmation(undefined)} onConfirm={()=>{setConfirmation(undefined);onReplace()}}/>}
  </div>
}
