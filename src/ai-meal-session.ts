import {createAIMealDraft,validateAIMealDraft,type AIMealDraft} from './ai-meal-state';
import {saveAIMealDraft,discardAIMealDraft} from './ai-meal-storage';
import {importAIMeals,AIImportError} from './ai-meal-import';
/** Each mounted visit owns its draft identity. Old sessions, other tabs and receipts are never adopted or erased. */
export function createAIMealSession(){
 type Snapshot={draft:AIMealDraft;status:'saving'|'saved'|'importing';error:'storage'|null};
 let snapshot:Snapshot={draft:createAIMealDraft(),status:'saved',error:null};
 const journalKey='betterlumi.ai-meal-session.v1:'+snapshot.draft.id,listeners=new Set<()=>void>();
 let generation=0,saved=0,revision=0,closing=false,timer:ReturnType<typeof setTimeout>|undefined,task:Promise<void>|null=null;
 let importTask:ReturnType<typeof importAIMeals>|null=null,discardTask:Promise<void>|null=null;
 const emit=(next:Snapshot)=>{snapshot=next;listeners.forEach(fn=>fn())};
 const removeJournal=()=>{try{localStorage.removeItem(journalKey)}catch{/* Stored draft remains fenced by its visit identity. */}};
 const journal=()=>{try{localStorage.setItem(journalKey,JSON.stringify(snapshot.draft))}catch{/* IndexedDB saving still runs. */}};
 const dirty=()=>!!snapshot.draft.raw.trim()||snapshot.draft.rows.length>0||Object.keys(snapshot.draft.splits??{}).length>0;
 const flush=():Promise<void>=>{
  clearTimeout(timer);timer=undefined;if(task)return task;
  if(closing||generation===saved)return Promise.resolve();
  const run=async()=>{while(!closing&&generation!==saved){const at=generation,value={...structuredClone(snapshot.draft),revision};try{const stored=await saveAIMealDraft(value);revision=stored.revision;saved=at;const next={...snapshot.draft,importId:stored.importId,revision};emit({...snapshot,draft:next,status:generation===at?'saved':'saving',error:null});if(generation===at)removeJournal();else journal()}catch{emit({...snapshot,status:'saved',error:'storage'});break}}};
  task=run();void task.then(()=>{task=null},()=>{task=null});return task;
 };
 const change=(update:(draft:AIMealDraft)=>AIMealDraft)=>{
  if(closing||snapshot.error||importTask||snapshot.status==='importing')throw Error('Session is not editable');
  const next=validateAIMealDraft(update(structuredClone(snapshot.draft)));next.revision=revision;generation++;emit({draft:next,status:'saving',error:null});journal();clearTimeout(timer);timer=setTimeout(()=>void flush(),180);
 };
 const importDraft=(language:'zh'|'en',allowDuplicates=false)=>{
  if(importTask)return importTask;
  const run=async()=>{if(closing)throw new AIImportError('conflict');await flush();if(closing||snapshot.error)throw new AIImportError('conflict');emit({...snapshot,status:'importing'});try{const result=await importAIMeals(structuredClone(snapshot.draft),language,allowDuplicates);revision=result.nextDraft.revision;generation++;saved=generation;removeJournal();emit({draft:result.nextDraft,status:'saved',error:null});return result}catch(error){emit({...snapshot,status:'saved'});throw error}};
  importTask=run();void importTask.then(()=>{importTask=null},()=>{importTask=null});return importTask;
 };
 const discard=()=>{
  if(discardTask)return discardTask;closing=true;clearTimeout(timer);timer=undefined;
  discardTask=(async()=>{await task;try{await importTask}catch{/* Failed imports remain untouched until the user explicitly discards them. */}try{if(dirty()||generation!==saved)await discardAIMealDraft({...snapshot.draft,revision})}finally{removeJournal()}})();
  // A failed cleanup retains its versioned draft in storage, but it is never restored into another visit.
  void discardTask.catch(()=>{});return discardTask;
 };
 return {subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},getSnapshot:()=>snapshot,isImporting:()=>importTask!==null,dirty,change,flush,importDraft,discard};
}
