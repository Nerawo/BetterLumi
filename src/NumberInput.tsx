import {useLayoutEffect,useRef,type ComponentPropsWithoutRef} from 'react';

/** Keep the native editing buffer (including blank and unfinished decimals).
 * Numeric props synchronize external changes only while the user isn't typing.
 * Native constraints and the form's save handler still validate the result.
 */
export function NumberInput({value,defaultValue,inputMode='decimal',restingValue,onFocus,onBlur,...props}:ComponentPropsWithoutRef<'input'>&{restingValue?:string}) {
  const input=useRef<HTMLInputElement>(null);
  const initial=useRef(restingValue??value??defaultValue??'');
  const previous=useRef(value);
  useLayoutEffect(()=>{
    if(value!==undefined && value!==previous.current && input.current && document.activeElement!==input.current) {
      input.current.value=String(restingValue??value??'');
      input.current.setCustomValidity('');
    }
    previous.current=value;
  },[value,restingValue]);
  return <input {...props} ref={input} type="number" inputMode={inputMode} defaultValue={initial.current} onFocus={e=>{if(restingValue!==undefined&&value!==undefined)e.currentTarget.value=String(value);onFocus?.(e)}} onBlur={e=>{onBlur?.(e);if(restingValue!==undefined&&e.currentTarget.validity.valid)e.currentTarget.value=restingValue}}/>;
}
