import {Pencil} from 'lucide-react';

interface TextFieldProps {
  name:string;
  label:string;
  value:string;
  onChange:(text:string)=>void;
  placeholder:string;
  required?:boolean;
  maxLength?:number;
  showPencil?:boolean;
}
export function JournalTextField({name,label,value,onChange,placeholder,required,maxLength,showPencil=true}:TextFieldProps){
  return <label className="draft-name">
    <span>{label}</span>
    <span className="draft-name-line">
      <span aria-hidden="true" className={value?'':'muted'}>{value||placeholder}</span>
      <input name={name} aria-label={label} required={required} value={value} maxLength={maxLength}
        placeholder={placeholder} enterKeyHint="done" onChange={event=>onChange(event.target.value)}
        onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.blur()}}}/>
      {showPencil&&(required||value)&&<Pencil size={13} strokeWidth={1.5} aria-hidden="true"/>}
    </span>
  </label>;
}
