import type {IngredientPreference} from './ingredient-preferences';
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {GripVertical,ChevronDown,ChevronRight,ArrowRightLeft} from 'lucide-react';
import {Modal} from './ui';
import {aiMealImportIssues,type AIImportIssueCode} from './ai-meal-import';
const issueKeys:Record<AIImportIssueCode,string>={empty:'aiIssueEmpty',date:'aiIssueDate',type:'aiIssueType',amount:'aiIssueAmount',unit:'aiIssueUnit',weight:'aiIssueWeight',nutrition:'aiIssueNutrition',name:'aiIssueName',portion:'aiIssuePortion',split:'aiIssueSplit',draft:'aiIssueDraft',parse:'aiIssueParse'};
import {aiMealTypes} from './ai-meal-model';
import {aiMealDraftTotals,groupAIMealDraft,type AIMealDraft,type AIMealDraftRow} from './ai-meal-state';
import {moveAIMealRow,editAIMealGroupDate,undoAIMealSplit,aiMealPreviewWarnings,type AIMealGroupTarget} from './ai-meal-preview';
import {aiMealTypeKey,formatAINumber,displayAIMealUnit} from './AIMealFoodEditor';
function MoveFood({draft,row,close,move}:{draft:AIMealDraft;row:AIMealDraftRow;close:()=>void;move:(target:AIMealGroupTarget|null,before?:string)=>void}) {
 const {t}=useTranslation(),groups=groupAIMealDraft(draft).groups;
 const [destination,setDestination]=useState(row.item.date&&row.item.mealType?row.item.date+':'+row.item.mealType:'outside'),[date,setDate]=useState(row.item.date??''),[type,setType]=useState(row.item.mealType??''),[before,setBefore]=useState('');
 const target=destination==='outside'?null:destination==='new'?date&&type?{date,mealType:type as typeof aiMealTypes[number]}:null:(()=>{const group=groups.find(g=>g.date+':'+g.mealType===destination);return group?{date:group.date,mealType:group.mealType}:null})();
 const rows=draft.rows.filter(r=>r.item.path!==row.item.path&&(target?r.item.date===target.date&&r.item.mealType===target.mealType:!r.item.date||!r.item.mealType));
 return <Modal title={t('aiMove')} close={close} className="goal-editor-modal ai-move-editor"><form onSubmit={e=>{e.preventDefault();if(destination!=='new'||target){move(target,before||undefined);close()}}}><div className="ai-editor-body">
  <p>{row.item.name}</p><label>{t('aiMove')}<select aria-label={t('aiMove')} value={destination} onChange={e=>{setDestination(e.target.value);setBefore('')}}><option value="outside">{t('aiOutside')}</option>{groups.map(g=><option key={g.date+g.mealType} value={g.date+':'+g.mealType}>{g.date} · {t(aiMealTypeKey[g.mealType])}</option>)}<option value="new">{t('aiNewGroup')}</option></select></label>
  {destination==='new'&&<div className="ai-fields-two"><label>{t('aiDate')}<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>{t('aiMealType')}<select aria-label={t('aiMealType')} required value={type} onChange={e=>setType(e.target.value)}><option value="">{t('aiUnresolved')}</option>{aiMealTypes.map(type=><option key={type} value={type}>{t(aiMealTypeKey[type])}</option>)}</select></label></div>}
  <label>{t('aiPosition')}<select aria-label={t('aiPosition')} value={before} onChange={e=>setBefore(e.target.value)}><option value="">{t('aiAtEnd')}</option>{rows.map(r=><option key={r.item.path} value={r.item.path}>{t('aiBeforeFood',{name:r.item.name})}</option>)}</select></label>
 </div><div className="form-actions"><button type="button" onClick={close}>{t('aiCancel')}</button><button className="primary" type="submit">{t('aiMoveApply')}</button></div></form></Modal>;
}
export function AIMealPreview({draft,change,edit,preferences,importMeals,importing,blocked,importError,duplicates,reviewDuplicates}:{importMeals:(allowDuplicates?:boolean)=>void;importing:boolean;blocked:boolean;importError:string;duplicates:string[];reviewDuplicates:()=>void;preferences:Record<string,IngredientPreference>;draft:AIMealDraft;change:(fn:(draft:AIMealDraft)=>AIMealDraft)=>void;edit:(row:AIMealDraftRow)=>void}) {
 const {t,i18n}=useTranslation(),[collapsed,setCollapsed]=useState<Set<string>>(()=>new Set()),[moving,setMoving]=useState<AIMealDraftRow|null>(null),[announcement,setAnnouncement]=useState('');
 const [dragged,setDragged]=useState<{name:string;x:number;y:number}|null>(null),list=useRef<HTMLDivElement>(null);
 const drag=useRef<{path:string;x:number;y:number;startX:number;startY:number;active:boolean;frame:number}|null>(null);
 const latest=useRef({draft,change});latest.current={draft,change};
 const cleanup=()=>{if(drag.current)cancelAnimationFrame(drag.current.frame);drag.current=null;setDragged(null);list.current?.querySelectorAll('.ai-drop-active').forEach(el=>el.classList.remove('ai-drop-active'))};
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&drag.current){cleanup();setAnnouncement(t('aiDragCancelled'))}};document.addEventListener('keydown',escape);return()=>{if(drag.current)cancelAnimationFrame(drag.current.frame);document.removeEventListener('keydown',escape)}},[t]);
 const dropTarget=(x:number,y:number)=>{
  const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-ai-drop]');if(!el||!list.current?.contains(el))return null;
  const date=el.dataset.aiDate,type=el.dataset.aiType,target=date&&type?{date,mealType:type as typeof aiMealTypes[number]}:null;
  let before=el.dataset.aiBefore;
  if(before&&y>(el.getBoundingClientRect().top+el.getBoundingClientRect().bottom)/2){const siblings=[...el.parentElement!.querySelectorAll<HTMLElement>(':scope > [data-ai-before]')],at=siblings.indexOf(el);before=siblings[at+1]?.dataset.aiBefore}
  return {el,target,before};
 };
 const tick=()=>{const d=drag.current;if(!d?.active)return;const box=list.current?.getBoundingClientRect();if(box&&list.current){const delta=d.y<box.top+40?-8:d.y>box.bottom-40?8:0;if(delta)list.current.scrollTop+=delta}const target=dropTarget(d.x,d.y);list.current?.querySelectorAll('.ai-drop-active').forEach(el=>el.classList.remove('ai-drop-active'));target?.el.classList.add('ai-drop-active');d.frame=requestAnimationFrame(tick)};
 const start=(e:ReactPointerEvent<HTMLButtonElement>,row:AIMealDraftRow)=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={path:row.item.path,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false,frame:0}};
 const pointerMove=(e:ReactPointerEvent<HTMLButtonElement>,name:string)=>{const d=drag.current;if(!d)return;d.x=e.clientX;d.y=e.clientY;if(!d.active&&Math.hypot(d.x-d.startX,d.y-d.startY)>6){d.active=true;d.frame=requestAnimationFrame(tick)}if(d.active){e.preventDefault();setDragged({name,x:d.x,y:d.y})}};
 const finish=(e:ReactPointerEvent<HTMLButtonElement>)=>{const d=drag.current,target=d?.active?dropTarget(e.clientX,e.clientY):null;if(d&&target){latest.current.change(value=>moveAIMealRow(value,d.path,target.target,target.before));setAnnouncement(t('aiMoved'))}cleanup()};
 const issues=aiMealImportIssues(draft),invalidRows=new Set(issues.filter(i=>i.path).map(i=>i.path));
 const {groups,unresolved}=groupAIMealDraft(draft),totals=aiMealDraftTotals(draft),complete=totals.nutrition.calories!==null,warnings=aiMealPreviewWarnings(draft);
 const foodRow=(row:AIMealDraftRow)=><div className="ai-food-row" key={row.item.path} data-ai-drop data-ai-before={row.item.path} data-ai-date={row.item.date??''} data-ai-type={row.item.mealType??''}>
  <button type="button" className="ai-drag-handle" aria-label={t('aiDrag')+' '+row.item.name} onPointerDown={e=>start(e,row)} onPointerMove={e=>pointerMove(e,row.item.name)} onPointerUp={finish} onPointerCancel={cleanup} onLostPointerCapture={()=>{if(drag.current)cleanup()}}><GripVertical size={17}/></button>
  <button type="button" className="ai-food-main" onClick={()=>edit(row)}><span className="ai-food-description"><span className="ai-food-name">{row.item.name}</span><small>{row.item.amount===null?t('aiUnknown'):formatAINumber(row.item.amount,i18n.language)} {displayAIMealUnit(row,i18n.language,preferences)}{row.item.weightG!==null&&!(canonicalGrams(row.item.unit)&&row.item.amount===row.item.weightG)?' · '+formatAINumber(row.item.weightG,i18n.language)+' g':''}</small>{issues.filter(i=>i.path===row.item.path).map(i=><small className="ai-import-issue" key={i.code}>{t(issueKeys[i.code])}</small>)}{warnings[row.item.path]&&<small>{t(warnings[row.item.path]==='zero'?'aiCheckZero':'aiCheckDuplicate')}</small>}</span><span className="ai-row-calories">{formatAINumber(row.item.nutrition.calories,i18n.language)} <small>kcal</small></span><ChevronRight size={14}/></button>
  <button type="button" className="ai-move-button" aria-label={t('aiMove')+' '+row.item.name} onClick={()=>setMoving(row)}><ArrowRightLeft size={15}/></button>
 </div>;
 return <section className="ai-preview" aria-label={t('aiPreviewTitle')}>
  <header className="ai-preview-heading"><div><h2>{t('aiPreviewTitle')}</h2><small>{t('aiItems',{count:draft.rows.length})}</small></div><div className="ai-preview-total">{formatAINumber(complete?totals.nutrition.calories:totals.knownNutrition.calories,i18n.language)} <span>kcal</span></div></header>
  {!complete&&<p className="ai-helper">{t('aiTotalIncomplete')}</p>}
  {Object.entries(draft.splits??{}).map(([path,parent])=><div className="ai-split-undo" key={path}><span>{parent.item.name}</span><button type="button" onClick={()=>change(d=>undoAIMealSplit(d,path))}>{t('aiSplitUndo')}</button></div>)}
  <div className="ai-preview-list" ref={list}>
   {groups.map(group=>{const key=group.date+':'+group.mealType,closed=collapsed.has(key),target={date:group.date,mealType:group.mealType};return <section className="ai-meal-group" key={key}>
    <div className="ai-group-heading" data-ai-drop data-ai-date={group.date} data-ai-type={group.mealType}>
     <button type="button" aria-label={t(closed?'aiExpand':'aiCollapse')+' '+t(aiMealTypeKey[group.mealType])} aria-expanded={!closed} onClick={()=>setCollapsed(old=>{const next=new Set(old);next.has(key)?next.delete(key):next.add(key);return next})}><ChevronDown className={closed?'ai-closed':''} size={16}/><strong>{t(aiMealTypeKey[group.mealType])}</strong><small>{group.rows.length}</small></button>
     <label className="ai-group-date"><span className="sr-only">{t('aiDate')}</span><input aria-label={t('aiDate')+' '+t(aiMealTypeKey[group.mealType])} type="date" value={group.date} onChange={e=>{if(e.target.value)change(d=>editAIMealGroupDate(d,target,e.target.value))}}/></label>
    </div>
    {closed?<p className="ai-group-summary">{[...group.rows.slice(0,3).map(row=>row.item.name),...(group.rows.length>3?[t('aiMoreFoods',{count:group.rows.length-3})]:[])].join(' · ')}</p>:<div className="ai-group-body">{group.rows.map(foodRow)}</div>}
   </section>})}
   {unresolved.map(foodRow)}
   {!draft.rows.length&&<p className="ai-helper">{t('aiNoFoods')}</p>}
   <div className="ai-flat-drop" data-ai-drop>{t('aiFlatDrop')}</div>
  </div>
  <div className="ai-confirmation" aria-busy={importing}>
   {!!issues.length&&<div className="ai-import-validation" id="ai-import-issues">{issues.filter(i=>!i.path).map(i=><small key={i.code}>{t(issueKeys[i.code])}</small>)}{!!invalidRows.size&&<button type="button" onClick={()=>{const row=draft.rows.find(r=>invalidRows.has(r.item.path));if(row)edit(row)}}>{t('aiFixItems',{count:invalidRows.size})}</button>}</div>}
   {importError&&<small role="alert">{importError}</small>}
   {duplicates.length?<div className="ai-duplicate-review"><small role="alert">{t('aiImportDuplicate',{names:draft.rows.filter(r=>duplicates.includes(r.item.path)).map(r=>r.item.name).join(' · ')})}</small><div><button type="button" onClick={reviewDuplicates}>{t('aiReviewDuplicates')}</button><button type="button" className="primary" disabled={importing||blocked||!!issues.length} onClick={()=>importMeals(true)}>{t(importing?'aiImporting':'aiImportAnyway')}</button></div></div>:<button type="button" className="primary" disabled={importing||blocked||!!issues.length} aria-describedby={issues.length?'ai-import-issues':undefined} onClick={()=>importMeals()}>{t(importing?'aiImporting':'aiConfirm')}</button>}
  </div>
  <span className="sr-only" role="status">{announcement}</span>{dragged&&<div className="ai-drag-ghost" style={{left:Math.min(dragged.x,innerWidth-140),top:dragged.y+16}}>{dragged.name}</div>}
  {moving&&<MoveFood draft={draft} row={moving} close={()=>setMoving(null)} move={(target,before)=>{change(d=>moveAIMealRow(d,moving.item.path,target,before));setAnnouncement(t('aiMoved'))}}/>}
 </section>;
}
const canonicalGrams=(unit:string)=>['g','克','gram','grams'].includes(unit.toLowerCase());
