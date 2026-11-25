import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {journalEditValue} from './journal-quantity';

interface Props {
  quantity:number|null;
  name?:string;
  format?:(value:number)=>string;
  onClear?:()=>void;
  validateOnSubmit?:boolean;
  required?:boolean;
  min?:number;
  label:string;
  autoFocus?:boolean;
  onCommit:(value:number)=>void|false;
  onEnd?:()=>void;
}

export function JournalQuantityInput({quantity,label,name,format=journalEditValue,autoFocus,onCommit,onClear,onEnd,validateOnSubmit,required,min=0}:Props){
  const input=useRef<HTMLInputElement>(null);
  const cancel=useRef(false);
  const [focused,setFocused]=useState(false);
  const display=quantity===null?'':format(quantity);
  const initialDisplay=useRef(display);
  useLayoutEffect(()=>{
    if(!focused&&input.current&&(!validateOnSubmit||input.current.validity.valid))input.current.value=display;
  },[display,focused,validateOnSubmit]);
  useEffect(()=>{
    if(!focused)return;
    // Safari can leave a number field focused when tapping a non-focusable label.
    const outside=(event:PointerEvent)=>{
      if(event.target!==input.current)input.current?.blur();
    };
    document.addEventListener('pointerdown',outside,true);
    return ()=>document.removeEventListener('pointerdown',outside,true);
  },[focused]);
  return <input ref={input} name={name} placeholder={onClear?"—":undefined} type="number" min={min} required={required} step="any" inputMode="decimal" enterKeyHint="done"
    defaultValue={display} autoFocus={autoFocus} aria-label={label}
    onFocus={()=>{initialDisplay.current=display;cancel.current=false;setFocused(true)}}
    onBlur={event=>{
      const field=event.currentTarget,value=field.valueAsNumber;
      if(validateOnSubmit&&!cancel.current&&!field.validity.valid&&!(onClear&&field.validity.valueMissing&&!field.validity.badInput)){
        setFocused(false);
        return;
      }
      const changed=!cancel.current&&field.validity.valid&&Number.isFinite(value)&&(initialDisplay.current===''||value!==Number(initialDisplay.current))&&value!==quantity;
      const accepted=changed&&onCommit(value)!==false;
      const cleared=!cancel.current&&field.value===''&&!field.validity.badInput&&!!onClear;
      if(cleared&&quantity!==null)onClear();
      field.value=cleared?'':accepted?format(value):display;
      setFocused(false);
      onEnd?.();
    }}
    onKeyDown={event=>{
      if(event.key==='Enter'||event.key==='Escape'){
        event.preventDefault();event.stopPropagation();cancel.current=event.key==='Escape';event.currentTarget.blur();
      }
    }}/>;
}
