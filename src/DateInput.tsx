import { useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { DatePicker } from "./DatePicker";
import { formatLocalDate } from "./dates";
/** Canonical native form validation, with one shared custom picker for all interaction. */
export function DateInput({value,defaultValue,onChange,onClick,className="",...props}:Omit<InputHTMLAttributes<HTMLInputElement>,"type">) {
 const {t,i18n}=useTranslation();const [local,setLocal]=useState(String(defaultValue??""));const input=useRef<HTMLInputElement>(null);
 const selected=String(value??local);
 const update=(date:string)=>{setLocal(date);if(input.current){input.current.value=date;onChange?.({target:input.current,currentTarget:input.current} as ChangeEvent<HTMLInputElement>)}};
 return <span className={"localized-date-field "+className}>
  <DatePicker field label={String(props["aria-label"]??t("date"))} selected={selected} onSelect={update} min={props.min===undefined?undefined:String(props.min)} max={props.max===undefined?undefined:String(props.max)} clearable={!props.required}><span className="localized-date-value">{selected?formatLocalDate(selected,i18n.language):t("selectDate")}</span></DatePicker>
  <input {...props} ref={input} type="date" className="canonical-date-input" aria-hidden="true" tabIndex={-1} value={selected} onInvalid={event=>{event.preventDefault();event.currentTarget.parentElement?.querySelector<HTMLButtonElement>("button")?.focus()}} onChange={event=>{setLocal(event.target.value);onChange?.(event)}}/>
 </span>;
}
