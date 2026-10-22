import {useTranslation} from "react-i18next";
import {Copy} from "lucide-react";
import type {Notice} from "./ui";
async function copyUrl(url:string){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url);return}catch{/* Fall back for browsers without clipboard permission. */}}
 const field=document.createElement("textarea"),focused=document.activeElement as HTMLElement|null;
 field.value=url;field.readOnly=true;field.style.cssText="position:fixed;left:-9999px;top:0;font-size:16px";document.body.append(field);
 try{field.select();field.setSelectionRange(0,url.length);if(!document.execCommand("copy"))throw Error("Copy failed")}finally{field.remove();focused?.focus({preventScroll:true})}
}
export function ExerciseNotes({text,notice}:{text:string;notice:Notice}) {
 const {t}=useTranslation();
 const pieces:React.ReactNode[]=[];const urls=Array.from(text.matchAll(/https?:\/\/[^\s<>"“”，。；！？、]+/g));let last=0;
 for(const match of urls){let url=match[0].replace(/[.,;!]+$/u,"");for(const [opening,closing] of [["(",")"],["[","]"],["（","）"]])while(url.endsWith(closing)&&url.split(closing).length>url.split(opening).length)url=url.slice(0,-1);pieces.push(text.slice(last,match.index));pieces.push(<span className="note-url" key={match.index}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a><button type="button" className="icon-button" aria-label={t("copyUrl")+" · "+url} onClick={async()=>{try{await copyUrl(url);notice(t("urlCopied"))}catch{notice(t("copyUrlFailed"))}}}><Copy size={13}/></button></span>);last=match.index!+url.length;}
 pieces.push(text.slice(last));return <p className="exercise-notes preserved-text">{pieces}</p>;
}
