import {useState,type ReactNode} from 'react';
import './ingredient-journal.css';
import {DraftUnitPicker} from './DraftUnitPicker';
import {JournalQuantityInput} from './JournalQuantityInput';

export function IngredientChoice<T extends string>({label,value,options,onChange}:{
  label:string; value:T; options:readonly {value:T;label:string}[]; onChange:(value:T)=>void;
}){
  const [open,setOpen]=useState(false);
  return <DraftUnitPicker open={open} setOpen={setOpen} units={{name:label,accessibleLabel:label,value,
    label:options.find(option=>option.value===value)?.label??value,options:[...options],fixed:options.length===1,
    change:key=>{const option=options.find(o=>o.value===key);if(option)onChange(option.value)}}}/>;
}

// Package labels can include small decimal quantities. Formatting is display-only.
const labelAmount=(value:number)=>String(Number(value.toPrecision(15)));
export function IngredientAmount({name,label,inputLabel=label,value,onChange,unit,compact=false,min,required}:{
  name:string;label:string;inputLabel?:string;value:number|null;onChange:(value:number|null)=>void;unit?:ReactNode;compact?:boolean;min?:number;required?:boolean;
}){
  return <div className={compact?'ingredient-journal-row ingredient-reference-phrase':'ingredient-journal-row'}>
    <span>{label}</span>
    <div className="ingredient-amount draft-amount">
      <JournalQuantityInput name={name} label={inputLabel} quantity={value} format={labelAmount} min={min} required={required} validateOnSubmit
        onCommit={onChange} onClear={()=>onChange(null)}/>
      {unit}
      <span className="journal-amount-ink" aria-hidden="true"/>
    </div>
  </div>;
}
