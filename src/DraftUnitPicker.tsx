import {useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';

export interface DraftUnits {
  name:string;
  value:string;
  label:string;
  options:{value:string;label:string}[];
  fixed:boolean;
  change:(unit:string)=>void;
}

export function DraftUnitPicker({units,open,setOpen}:{units:DraftUnits;open:boolean;setOpen:(value:boolean)=>void}){
  const {t}=useTranslation();
  const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
  const id=useId();
  const [placed,setPlaced]=useState(false);
  const close=(restoreFocus:boolean)=>{
    setOpen(false);
    if(restoreFocus)trigger.current?.focus({preventScroll:true});
  };
  useLayoutEffect(()=>{
    if(!open||units.fixed){setPlaced(false);if(open)setOpen(false);return}
    const anchor=trigger.current!,popup=menu.current!,modal=anchor.closest('dialog')!;
    const scroller=anchor.closest('.recipe-editor-scroll')!;
    const viewport=window.visualViewport;
    const place=()=>{
      const a=anchor.getBoundingClientRect(),m=modal.getBoundingClientRect(),body=scroller.getBoundingClientRect();
      const top=Math.max(body.top,viewport?.offsetTop??0)+3;
      const bottom=Math.min(body.bottom,(viewport?.offsetTop??0)+(viewport?.height??innerHeight))-3;
      if(a.bottom<top||a.top>bottom){setOpen(false);return}
      const left=Math.max(body.left,viewport?.offsetLeft??0)+4;
      const right=Math.min(body.right,(viewport?.offsetLeft??0)+(viewport?.width??innerWidth))-4;
      popup.style.maxWidth=Math.max(0,right-left)+'px';
      const above=a.top-top-2,below=bottom-a.bottom-2;
      const upward=below<popup.scrollHeight+2&&above>below;
      popup.style.maxHeight=Math.max(0,upward?above:below)+'px';
      const x=Math.max(left,Math.min(right-popup.offsetWidth,a.right-popup.offsetWidth));
      popup.style.left=(x-m.left-modal.clientLeft)+'px';
      popup.style.top=((upward?a.top-2-popup.offsetHeight:a.bottom+2)-m.top-modal.clientTop)+'px';
      setPlaced(true);
    };
    place();
    popup.querySelector<HTMLElement>('[aria-checked=true]')?.focus({preventScroll:true});
    const outside=(e:PointerEvent)=>{
      if(!popup.contains(e.target as Node)&&!anchor.contains(e.target as Node))setOpen(false);
    };
    document.addEventListener('pointerdown',outside,true);
    scroller.addEventListener('scroll',place,{passive:true});
    window.addEventListener('resize',place);
    viewport?.addEventListener('resize',place);
    viewport?.addEventListener('scroll',place);
    return ()=>{
      document.removeEventListener('pointerdown',outside,true);
      scroller.removeEventListener('scroll',place);
      window.removeEventListener('resize',place);
      viewport?.removeEventListener('resize',place);
      viewport?.removeEventListener('scroll',place);
    };
  },[open,setOpen,units.fixed]);
  const dialog=trigger.current?.closest('dialog');
  if(units.fixed)return <span className="draft-unit-text" data-unit={units.value}>{units.label}</span>;
  return <><button ref={trigger} type="button" className="draft-unit-trigger" data-unit={units.value} aria-label={t('draftChangeUnit')+' '+units.name}
    aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} disabled={units.fixed}
    onClick={()=>setOpen(!open)}>{units.label}</button>
    {open&&dialog&&createPortal(<div id={id} ref={menu} className="draft-unit-menu" role="menu" aria-label={t('draftChangeUnit')}
      style={{opacity:placed?1:0}} onKeyDown={e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return}
        if(e.key==='Tab'){close(true);return}
        const buttons=Array.from(e.currentTarget.querySelectorAll('button'));
        const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        const count=buttons.length;
        const next=({
          ArrowDown:(index+1)%count,ArrowUp:(index-1+count)%count,
          Home:0,End:count-1
        } as Record<string,number>)[e.key];
        if(next!==undefined){e.preventDefault();buttons[next].focus()}
      }}>
      {units.options.map(o=><button key={o.value} data-unit={o.value} type="button" role="menuitemradio" aria-checked={o.value===units.value}
        tabIndex={o.value===units.value?0:-1} onClick={()=>{units.change(o.value);close(true)}}>
        {o.label}
      </button>)}
    </div>,dialog)}
  </>;
}
