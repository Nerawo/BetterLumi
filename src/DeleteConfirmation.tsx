import {useEffect,useRef,useState,useSyncExternalStore} from "react";
import {useTranslation} from "react-i18next";
import {X} from "lucide-react";

export type DeleteKind="meal"|"exercise"|"exercisePlan"|"recipe"|"ingredient"|"supplement"|"weight"|"todo"|"note"|"category"|"ingredientTag";
type Request={kind:DeleteKind;name:string;action:()=>Promise<unknown>;done:()=>void;trigger:HTMLElement|null};
let current:Request|null=null;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
const snapshot=()=>current;
const publish=()=>listeners.forEach(listener=>listener());

/** All callers retain their original deletion action; only this host can execute it. */
export function confirmDelete(kind:DeleteKind,name:string|undefined,action:()=>Promise<unknown>):Promise<void>{
 if(current)return Promise.resolve();
 return new Promise(done=>{current={kind,name:name??"",action,done,trigger:document.activeElement instanceof HTMLElement?document.activeElement:null};publish()});
}
export function DeleteConfirmationHost(){
 const request=useSyncExternalStore(subscribe,snapshot,snapshot);
 return request?<DeleteDialog key={request.kind+request.name} request={request}/>:null;
}
function DeleteDialog({request}:{request:Request}){
 const {t}=useTranslation(),dialog=useRef<HTMLDialogElement>(null),cancelButton=useRef<HTMLButtonElement>(null),lock=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{dialog.current?.showModal();cancelButton.current?.focus();return()=>{dialog.current?.close()}},[]);
 const close=()=>{
  current=null;publish();request.done();
  requestAnimationFrame(()=>{
   if(request.trigger?.isConnected)request.trigger.focus({preventScroll:true});
   else {const main=document.querySelector<HTMLElement>('main');if(main){const previous=main.getAttribute('tabindex');main.setAttribute('tabindex','-1');main.focus({preventScroll:true});if(previous===null)main.removeAttribute('tabindex');else main.setAttribute('tabindex',previous)}}
  });
 };
 const cancel=()=>{if(!lock.current)close()};
 return <dialog ref={dialog} className="delete-confirmation-modal" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" aria-modal="true" aria-busy={busy} onKeyDown={event=>{
  if(event.key!=="Tab")return;
  const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),first=buttons[0],last=buttons.at(-1);
  if(!first){event.preventDefault();return}
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }} onCancel={event=>{event.preventDefault();cancel()}} onClick={event=>{if(event.target===dialog.current)cancel()}}>
  <div className="delete-dialog-head"><h2 id="delete-dialog-title">{t("deleteTitle_"+request.kind)}</h2><button type="button" className="icon-button" aria-label={t("close")} disabled={busy} onClick={cancel}><X size={19}/></button></div>
  <p id="delete-dialog-description" className="delete-record-name">{request.name?t("deleteNamedRecord",{name:request.name}):t("deleteUnnamedRecord")}</p>
  <p className="delete-warning">{t(request.kind==="ingredientTag"?"deleteIngredientTagWarning":request.kind==="category"?"deleteCategoryWarning":"deleteShortWarning")}</p>
  {error&&<p role="alert" className="delete-error">{t("failedMessage")}</p>}
  <div className="delete-dialog-actions"><button ref={cancelButton} type="button" autoFocus disabled={busy} onClick={cancel}>{t("cancel")}</button><button type="button" className="delete-destructive" disabled={busy} onClick={async()=>{
   if(lock.current)return;lock.current=true;setBusy(true);setError(false);
   try{await request.action();close()}catch{setError(true);setBusy(false);lock.current=false}
  }}>{t(busy?"deletingRecord":"confirmDeleteAction")}</button></div>
 </dialog>;
}
