import {useEffect,useSyncExternalStore} from 'react';
import {createAIMealDraft,validateAIMealDraft,type AIMealDraft} from './ai-meal-state';
import {loadAIMealDraft,saveAIMealDraft} from './ai-meal-storage';
import {newId} from './ids';
import {hasAIMealImportReceipt,importAIMeals,AIImportError} from './ai-meal-import';
const recoveryPrefix='betterlumi.ai-meal-recovery.v1:';
type Snapshot={draft:AIMealDraft|null;status:'loading'|'saving'|'saved'|'importing'|'error';error:'storage'|'conflict'|'recovery'|null;recoveries:string[]};
let snapshot:Snapshot={draft:null,status:'loading',error:null,recoveries:[]},started=false,generation=0,savedGeneration=0,revision=0;
let task:Promise<void>|null=null,timer:ReturnType<typeof setTimeout>|undefined;
const listeners=new Set<()=>void>();
let recoveryKey='';
let importTask:ReturnType<typeof importAIMeals>|null=null;
function emit(next:Snapshot){snapshot=next;for(const listener of listeners)listener()}
function key(){if(recoveryKey)return recoveryKey;try{let id=sessionStorage.getItem('betterlumi.ai-meal-tab');if(!id){id=newId();sessionStorage.setItem('betterlumi.ai-meal-tab',id)}recoveryKey=recoveryPrefix+id}catch{recoveryKey=recoveryPrefix+newId()}return recoveryKey}
function journal(draft:AIMealDraft){try{localStorage.setItem(key(),JSON.stringify(draft));return true}catch{return false}}
function readRecovery(k:string):AIMealDraft {const draft=validateAIMealDraft(JSON.parse(localStorage.getItem(k)??''));if(draft.id!=='current')throw Error('Invalid recovery identity');return draft}
async function start(){
 if(started)return;started=true;
 try{
  const stored=await loadAIMealDraft('current');revision=stored?.revision??0;
  let keys:string[]=[];try{keys=Object.keys(localStorage).filter(k=>k.startsWith(recoveryPrefix))}catch{/* IndexedDB drafts still work if recovery storage is unavailable. */}
  // A receipt wins over any stale browser journal left by an interrupted successful import.
  const unfinished:string[]=[];for(const k of keys){const recovered=readRecovery(k);if(await hasAIMealImportReceipt(recovered.importId)){try{localStorage.removeItem(k)}catch{/* Receipt remains authoritative. */}}else unfinished.push(k)}keys=unfinished;
  const own=keys.includes(key())?key():keys.length===1?keys[0]:null;
  if(own){const recovered=readRecovery(own);if(recovered.revision!==revision){emit({draft:recovered,status:'error',error:'conflict',recoveries:keys});return}if(own!==key())journal(recovered);generation=1;emit({draft:recovered,status:'saving',error:null,recoveries:[]});void flush();return}
  if(keys.length>1){emit({draft:stored??createAIMealDraft('','current'),status:'error',error:'recovery',recoveries:keys});return}
  emit({draft:stored??createAIMealDraft('','current'),status:'saved',error:null,recoveries:[]});
 }catch{emit({...snapshot,status:'error',error:'storage'})}
}
export function changeAIMealDraft(update:(draft:AIMealDraft)=>AIMealDraft){
 if(!snapshot.draft||snapshot.error||snapshot.status==='importing')throw Error('Draft is not ready');
 const next=validateAIMealDraft(update(structuredClone(snapshot.draft)));next.revision=revision;generation++;
 const protectedLocally=journal(next);emit({draft:next,status:'saving',error:null,recoveries:[]});
 if(timer)clearTimeout(timer);timer=setTimeout(()=>void flush(),protectedLocally?180:0);
}
async function flush():Promise<void>{
 if(timer){clearTimeout(timer);timer=undefined}
 if(task)return task;
 if(!snapshot.draft||snapshot.error||snapshot.status==='importing'||generation===savedGeneration)return;
 const run=async()=>{
  while(snapshot.draft&&!snapshot.error&&generation!==savedGeneration){
   const at=generation,value={...structuredClone(snapshot.draft),revision};
   try{const saved=await saveAIMealDraft(value);revision=saved.revision;savedGeneration=at;
    const next={...snapshot.draft,importId:saved.importId,revision};
    if(generation===at){try{localStorage.removeItem(key())}catch{/* Retained recovery remains readable on reopen. */}}
    else journal(next);
    emit({...snapshot,draft:next,status:generation===at?'saved':'saving'});
   }catch{emit({...snapshot,status:'error',error:'conflict'});break}
  }
 };
 task=run();try{await task}finally{task=null}
}
/** Explicitly selected recovery never overwrites a newer IndexedDB draft. */
export function chooseAIMealRecovery(k:string){try{const recovered=readRecovery(k);journal(recovered);const error=recovered.revision===revision?null:'conflict';generation++;emit({draft:recovered,status:error?'error':'saving',error,recoveries:error?[k]:[]});if(!error)void flush()}catch{emit({...snapshot,status:'error',error:'storage'})}}
/** Flush pending edits, then fence autosaves until the import transaction commits or rolls back. */
export function importCurrentAIMealDraft(language:'zh'|'en',allowDuplicates=false){
 if(importTask)return importTask;
 const run=async()=>{
  if(timer){clearTimeout(timer);timer=undefined}
  if(snapshot.draft&&!snapshot.draft.importId)generation++;
  await flush();
  if(!snapshot.draft||snapshot.error)throw new AIImportError('conflict');
  const draft=structuredClone(snapshot.draft);emit({...snapshot,status:'importing'});
  try{
   const result=await importAIMeals(draft,language,allowDuplicates);
   revision=result.nextDraft.revision;generation++;savedGeneration=generation;
   try{const raw=localStorage.getItem(key());if(raw){const journalDraft=validateAIMealDraft(JSON.parse(raw));if(journalDraft.importId===draft.importId)localStorage.removeItem(key())}}catch{/* Persisted receipt prevents stale-journal resurrection on reload. */}
   emit({draft:result.nextDraft,status:'saved',error:null,recoveries:[]});return result;
  }catch(error){emit({...snapshot,status:'saved'});throw error}
 };
 importTask=run();void importTask.then(()=>{importTask=null},()=>{importTask=null});return importTask;
}
export function useAIMealDraft(){
 const value=useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>snapshot);
 useEffect(()=>{void start();const hide=()=>{if(snapshot.draft&&generation!==savedGeneration)journal(snapshot.draft);void flush()};window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',hide);return()=>{hide();window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',hide)}},[]);
 return {...value,change:changeAIMealDraft,chooseRecovery:chooseAIMealRecovery,importDraft:importCurrentAIMealDraft};
}
