import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import {Modal} from './ui';
import {confirmDelete} from './DeleteConfirmation';
import {loadStickyNotes,newStickyNote,sortStickyNotes,type StickyNote,type StickyNoteChange} from './sticky-notes';
import './sticky-note-locale';
import './sticky-notes.css';
export function useStickyNotes(recipeId:string,mealId=''){
 return useLiveQuery(()=>loadStickyNotes(recipeId,mealId),[recipeId,mealId]);
}
export function useStickyNoteChanges(){
 const [changes,setChanges]=useState<StickyNoteChange[]>([]);
 const stage=(change:StickyNoteChange)=>setChanges(old=>{
  const first=old.find(c=>c.before.id===change.before.id),rest=old.filter(c=>c.before.id!==change.before.id);
  if(first?.fresh&&change.text===null)return rest;
  return [...rest,{...change,before:first?.before??change.before,fresh:first?.fresh??change.fresh}];
 });
 return {changes,stage};
}
export function StickyNotes({notes,recipeId='',meal,changes=[],onChange,staged=false}:{notes:StickyNote[]|undefined;recipeId?:string;meal?:{id:string;date:string};changes?:StickyNoteChange[];onChange:(change:StickyNoteChange)=>void|Promise<void>;staged?:boolean}){
 const {t,i18n}=useTranslation(),[editing,setEditing]=useState<{note:StickyNote;fresh:boolean}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const byId=new Map((notes??[]).map(n=>[n.id,n]));for(const change of changes){if(change.text===null)byId.delete(change.before.id);else byId.set(change.before.id,{...change.before,text:change.text})}
 const visible=sortStickyNotes([...byId.values()]);
 const created=(n:StickyNote)=>{const date=new Date(n.createdAt);return Number.isNaN(date.getTime())?n.createdAt:new Intl.DateTimeFormat(i18n.language.startsWith('zh')?'zh-CN':'en',{year:'numeric',month:'2-digit',day:'2-digit'}).format(date)};
 return <section className="little-notes unified-sticky-notes" aria-label={t('sharedNotes')}>
  <button type="button" className="text-link" disabled={!notes} onClick={()=>{setError('');setEditing({note:newStickyNote(recipeId,meal),fresh:true})}}>{t('writeNote')}</button>
  {staged&&<small className="sticky-notes-hint">{t(recipeId?'noteSharedHint':'notePrivateHint')}</small>}
  <div className="notes-grid">{visible.map(n=><div className="paper-note" key={n.id}>
   <button type="button" className="note-text preserved-text" onClick={()=>{setError('');setEditing({note:n,fresh:!!changes.find(c=>c.before.id===n.id)?.fresh})}}>{n.text}</button>
   <small className="sticky-note-meta" title={t('noteCreated',{date:created(n)})}>{t(n.origin==='meal'?'noteMealOrigin':'noteRecipeOrigin')} · {created(n)}{n.mealDate?' · '+t('noteMealDate',{date:n.mealDate}):''}</small>
   <details className="note-menu"><summary aria-label={t('noteMenu')}>⋯</summary><button type="button" onClick={()=>confirmDelete('note',n.text,async()=>{try{await onChange({before:n,text:null})}catch{setError(t('noteConflict'))}})}>{t('delete')}</button></details>
  </div>)}</div>
  {error&&!editing&&<p role="alert">{error}</p>}
  {editing&&createPortal(<Modal title={t(editing.fresh?'addNote':'edit')} close={()=>{if(!busy)setEditing(null)}} className="goal-editor-modal sticky-note-editor"><form onSubmit={async e=>{e.preventDefault();e.stopPropagation();if(busy)return;const text=String(new FormData(e.currentTarget).get('text')).trim();if(!text)return;setBusy(true);try{await onChange({before:editing.note,text,fresh:editing.fresh});setEditing(null)}catch{setError(t('noteConflict'))}finally{setBusy(false)}}}><div className="modal-scroll"><label>{t('noteText')}<textarea name="text" rows={4} required defaultValue={editing.note.text}/></label>{error&&<p role="alert">{error}</p>}</div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setEditing(null)}>{t('cancel')}</button><button className="primary" disabled={busy}>{t('save')}</button></div></form></Modal>,document.body)}
 </section>;
}
