import {useLayoutEffect,useRef,type ComponentPropsWithoutRef} from 'react';

/** Keep the native editing buffer (including blank and unfinished decimals).
 * Numeric props synchronize external changes only while the user isn't typing.
 * Native constraints and the form's save handler still validate the result.
 */
export function NumberInput({value,defaultValue,inputMode='decimal',...props}:ComponentPropsWithoutRef<'input'>) {
  const input=useRef<HTMLInputElement>(null);
  const initial=useRef(value??defaultValue??'');
  const previous=useRef(value);
  useLayoutEffect(()=>{
    if(value!==undefined && value!==previous.current && input.current && document.activeElement!==input.current) {
      input.current.value=String(value??'');
      input.current.setCustomValidity('');
    }
    previous.current=value;
  },[value]);
  return <input {...props} ref={input} type="number" inputMode={inputMode} defaultValue={initial.current}/>;
}
