import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {journalEditValue} from './journal-quantity';

interface Props {
  quantity:number;
  label:string;
  autoFocus?:boolean;
  onCommit:(value:number)=>void|false;
  onEnd?:()=>void;
}

export function JournalQuantityInput({quantity,label,autoFocus,onCommit,onEnd}:Props){
  const input=useRef<HTMLInputElement>(null);
  const cancel=useRef(false);
  const [focused,setFocused]=useState(false);
  const display=journalEditValue(quantity);
  const initialDisplay=useRef(display);
  useLayoutEffect(()=>{
    if(!focused&&input.current)input.current.value=display;
  },[display,focused]);
  useEffect(()=>{
    if(!focused)return;
    // Safari can leave a number field focused when tapping a non-focusable label.
    const outside=(event:PointerEvent)=>{
      if(event.target!==input.current)input.current?.blur();
    };
    document.addEventListener('pointerdown',outside,true);
    return ()=>document.removeEventListener('pointerdown',outside,true);
  },[focused]);
  return <input ref={input} type="number" min="0" step="any" inputMode="decimal" enterKeyHint="done"
    defaultValue={display} autoFocus={autoFocus} aria-label={label}
    onFocus={()=>{initialDisplay.current=display;cancel.current=false;setFocused(true)}}
    onBlur={event=>{
      const field=event.currentTarget,value=field.valueAsNumber;
      const changed=!cancel.current&&field.validity.valid&&Number.isFinite(value)&&value!==Number(initialDisplay.current)&&value!==quantity;
      const accepted=changed&&onCommit(value)!==false;
      field.value=accepted?journalEditValue(value):display;
      setFocused(false);
      onEnd?.();
    }}
    onKeyDown={event=>{
      if(event.key==='Enter'||event.key==='Escape'){
        event.preventDefault();event.stopPropagation();cancel.current=event.key==='Escape';event.currentTarget.blur();
      }
    }}/>;
}
