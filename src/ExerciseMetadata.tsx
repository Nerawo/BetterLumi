import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ChevronDown,X} from "lucide-react";
import {ExerciseNotes} from "./ExerciseNotes";
import type {Notice} from "./ui";

export const trainingKeys=["cardio","anaerobic","strength","other"];
export const bodyKeys=["waist","thighs","shoulders","backBody","abdomen","glutes","chest","arms","calves"];
export interface ExerciseMetadataValue {trainingTags?:string[];bodyParts?:string[]}
export function ExerciseTags({value}:{value:ExerciseMetadataValue}){
 const {t}=useTranslation();
 if(!value.trainingTags?.length&&!value.bodyParts?.length)return null;
 return <div className="tag-list exercise-tags">{(value.trainingTags??[]).map(k=><span key={k}>{t(k)}</span>)}{(value.bodyParts??[]).map(k=><span key={k}>{k.startsWith("custom:")?k.slice(7):k.startsWith("preset:")?t(k.slice(7)):k}</span>)}</div>;
}
export function ExerciseRowDetails({value,notice}:{value:ExerciseMetadataValue & {notes?:string};notice:Notice}){
 if(!value.trainingTags?.length&&!value.bodyParts?.length&&!value.notes)return null;
 return <div className="exercise-row-details"><ExerciseTags value={value}/>{value.notes&&<ExerciseNotes text={value.notes} notice={notice}/>}</div>;
}
export function ExerciseMetadataEditor({value,onChange}:{value:ExerciseMetadataValue;onChange:(value:ExerciseMetadataValue)=>void}){
 const {t}=useTranslation(),[custom,setCustom]=useState("");
 const tags=value.trainingTags??[],parts=value.bodyParts??[];
 const label=(key:string)=>key.startsWith("custom:")?key.slice(7):key.startsWith("preset:")?t(key.slice(7)):key;
 const toggle=(values:string[],key:string)=>values.includes(key)?values.filter(v=>v!==key):[...values,key];
 const add=()=>{const key="custom:"+custom.trim();if(custom.trim()&&!parts.includes(key))onChange({...value,bodyParts:[...parts,key]});setCustom("")};
 return <div className="exercise-metadata-editor">
 <fieldset className="tag-picker"><legend>{t("trainingTags")}</legend>{trainingKeys.map(key=><label key={key}><input type="checkbox" checked={tags.includes(key)} onChange={()=>onChange({...value,trainingTags:toggle(tags,key)})}/>{t(key)}</label>)}</fieldset>
 <details className="exercise-body-parts"><summary><span>{t("bodyParts")}<small>{parts.map(label).join(" · ")}</small></span><ChevronDown size={15}/></summary>
 <fieldset className="tag-picker"><legend className="visually-hidden">{t("bodyParts")}</legend>{bodyKeys.map(key=><label key={key}><input type="checkbox" checked={parts.includes("preset:"+key)} onChange={()=>onChange({...value,bodyParts:toggle(parts,"preset:"+key)})}/>{t(key)}</label>)}</fieldset>
 <div className="custom-tag"><input aria-label={t("customBodyPart")} placeholder={t("customBodyPart")} value={custom} onChange={e=>setCustom(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add()}}}/><button type="button" className="secondary" onClick={add}>{t("add")}</button></div>
 <div className="tag-list">{parts.map(key=><button type="button" key={key} aria-label={t("delete")+" "+label(key)} onClick={()=>onChange({...value,bodyParts:parts.filter(p=>p!==key)})}>{label(key)}<X size={12}/></button>)}</div>
 </details></div>;
}
