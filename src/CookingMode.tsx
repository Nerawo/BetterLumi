import {Plus,Pencil} from 'lucide-react';
import {AddFood,type MealDraft} from './Meals';
import {journalQuantity} from './journal-quantity';
import {JournalMethod} from './JournalMethod';
import {NumberInput} from './NumberInput';
import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Recipe,PantryItem} from './domain';
import {Modal,type Notice} from './ui';
import {recipeServingLines,recipeYield} from './recipe-nutrition';
import {recipeSections,changeCookingServings,setCookingQuantity,restoreCookingQuantity,type CookingSession} from './cooking-journal';
import {openCookingSession,saveCookingSession} from './cooking-session';
import {householdUnitLabel} from './household-units';
import {useIngredientPreferences} from './useIngredientPreferences';
import './cooking-journal-locale';
import './cooking-journal.css';
import './cooking-mode-compact.css';
import {JournalHeading} from './JournalHeading';

export function CookingMode({recipe,recipes,pantry,date,notice,mealSaved,close}:{recipe:Recipe;recipes:Recipe[];pantry:PantryItem[];date:string;notice:Notice;mealSaved:(date:string)=>void;close:()=>void}){
 const {t,i18n}=useTranslation(),preferences=useIngredientPreferences();
 const [session,setSession]=useState<CookingSession>(),[amount,setAmount]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [quantityEdit,setQuantityEdit]=useState<{id:string;value:string}>(),[quantityError,setQuantityError]=useState('');
 const [mealDraft,setMealDraft]=useState<MealDraft>();
 const saving=useRef(false),stepping=useRef(false),quantitySaving=useRef(false),quantityIntent=useRef(false),mealIntent=useRef(false);
 const currentSession=useRef<CookingSession|undefined>(undefined),body=useRef<HTMLDivElement>(null),mealScroll=useRef(0);
 useEffect(()=>{let alive=true;setSession(undefined);currentSession.current=undefined;setQuantityEdit(undefined);openCookingSession(recipe).then(s=>{if(alive){setSession(s);currentSession.current=s;setAmount(String(s.servings));setError('')}}).catch(()=>{if(alive)setError(t('journalError'))});return()=>{alive=false}},[recipe.id,recipe.revision,t]);
 useEffect(()=>{
  let disposed=false,requesting=false,lock:WakeLockSentinel|undefined;
  const acquire=async()=>{if(disposed||requesting||document.visibilityState!=='visible'||!navigator.wakeLock||lock&&!lock.released)return;requesting=true;try{const next=await navigator.wakeLock.request('screen');if(disposed)await next.release();else lock=next}catch{/* Optional enhancement; never blocks cooking. */}finally{requesting=false}};
  void acquire();document.addEventListener('visibilitychange',acquire);
  return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);void lock?.release().catch(()=>{})};
 },[]);
 const commit=async(next:CookingSession)=>{
  const previous=currentSession.current;if(!previous||saving.current)return false;
  saving.current=true;setBusy(true);setError('');currentSession.current=next;setSession(next);
  try{await saveCookingSession(previous,next);return true}catch{currentSession.current=previous;setSession(previous);setAmount(String(previous.servings));setError(t('journalError'));return false}finally{saving.current=false;setBusy(false)}
 };
 const saveQuantity=async(id:string,unit:string,raw:string)=>{
  const current=currentSession.current;if(!current||quantitySaving.current||saving.current)return false;
  const n=Number(raw);if(!raw.trim()||!Number.isFinite(n)||n<0){setQuantityError(t('journalQuantityInvalid'));return false}
  quantitySaving.current=true;
  try{const next=setCookingQuantity(current,id,unit==='fraction'?n/100:n,unit);if(!await commit(next))return false;setQuantityEdit(undefined);setQuantityError('');return true}finally{quantitySaving.current=false}
 };
 const applyServings=async(n=Number(amount))=>{
  const current=currentSession.current;if(!current||saving.current)return false;
  if(!Number.isFinite(n)||n<=0){setAmount(String(current.servings));return false}
  if(n===current.servings)return true;
  if((current.checked.length||current.quantityOverrides?.length)&&!window.confirm(t(current.quantityOverrides?.length?'journalServingOverrideReset':'journalServingReset'))){setAmount(String(current.servings));return false}
  setQuantityEdit(undefined);setAmount(String(n));return commit(changeCookingServings(current,n,true));
 };
 const beginMeal=async()=>{
  mealIntent.current=false;if(saving.current)return;
  if(quantityEdit){const index=session?.entries.findIndex(e=>e.id===quantityEdit.id)??-1;if(index<0||!await saveQuantity(quantityEdit.id,recipe.lines[index].unit,quantityEdit.value))return}
  if(!await applyServings())return;
  const current=currentSession.current;if(!current)return;
  mealScroll.current=body.current?.scrollTop??0;
  setMealDraft({date,recipe,recipeServings:current.servings,onCommitted:savedDate=>{void (async()=>{
   const active=currentSession.current;
   if(active&&!await commit({...active,status:'completed'}))notice(t('journalMealSessionError'));
   mealSaved(savedDate);
  })()}});
 };
 const cancelMeal=()=>{setMealDraft(undefined);requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=mealScroll.current})};
 const lines=session?recipeServingLines(recipe,session.servings):[];
 const stepperAmount=Number.isFinite(Number(amount))&&Number(amount)>0?Number(amount):session?.servings??1;
 const sections=recipeSections({...recipe,lines});
 return <><Modal title={recipe.name} eyebrow="COOKING JOURNAL" close={close} className="recipe-detail-modal cooking-mode">
  <div ref={body} className="journal-scroll">
   {error&&<p role="alert">{error} {!session&&<button type="button" disabled={busy} onClick={async()=>{if(!window.confirm(t('journalResetConfirm')))return;setBusy(true);try{const next=await openCookingSession(recipe,true);setSession(next);currentSession.current=next;setAmount(String(next.servings));setError('')}catch{setError(t('journalError'))}finally{setBusy(false)}}}>{t('journalRestart')}</button>}</p>}
   {session&&<>
    <div className="journal-session-controls"><label><span>{t('journalYield')}</span><span className="journal-serving-stepper"><button type="button" disabled={busy||stepperAmount<=0.5} aria-label={t('journalDecrease')} onPointerDown={()=>{stepping.current=true}} onTouchStart={()=>{stepping.current=true}} onPointerCancel={()=>{stepping.current=false}} onPointerUp={()=>{requestAnimationFrame(()=>{stepping.current=false})}} onClick={()=>applyServings(Math.max(0.5,stepperAmount-0.5))}>−</button><input aria-label={t('journalYield')} type="number" inputMode="decimal" min="0.01" step="any" value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)} onBlur={()=>{if(!stepping.current&&!mealIntent.current)void applyServings()}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/><button type="button" disabled={busy} aria-label={t('journalIncrease')} onPointerDown={()=>{stepping.current=true}} onTouchStart={()=>{stepping.current=true}} onPointerCancel={()=>{stepping.current=false}} onPointerUp={()=>{requestAnimationFrame(()=>{stepping.current=false})}} onClick={()=>applyServings(stepperAmount+0.5)}>+</button></span></label><span role="status">{t('journalProgress',{done:session.checked.length,total:lines.length})}</span><small>{t('journalOriginal',{count:recipeYield(recipe)})}</small></div>
    {session.needsReview&&<p role="status">{t('journalReview')} <button type="button" disabled={busy} onClick={()=>void commit({...session,checked:[],needsReview:false})}>{t('journalRestart')}</button></p>}
    <div className="cooking-journal-columns">
     <section><h3><JournalHeading>Method</JournalHeading></h3><JournalMethod text={recipe.instructions||t('notRecorded')}/></section>
     <section><h3><JournalHeading>Ingredients</JournalHeading></h3>
      {sections.filter(g=>g.lines.length).map(g=><div className="journal-ingredient-group" key={g.id}>{(recipe.ingredientGroups?.length??0)>0&&<h4><JournalHeading>{g.name||t('journalUngrouped')}</JournalHeading></h4>}
       {g.lines.map(l=>{const index=lines.indexOf(l),id=session.entries[index].id,checked=session.checked.includes(id),override=session.quantityOverrides?.find(o=>o.entryId===id),quantity=override?.quantity??l.quantity,unitLabel=l.unit==='fraction'?'% '+t('storageReference'):l.unit==='g'?t('gramsUnit'):l.unit==='serving'?t('servingUnit'):householdUnitLabel(l.ingredientId,l.unit,i18n.language,preferences[l.ingredientId]?.units);return <div className={'journal-check-row'+(checked?' is-checked':'')+(quantityEdit?.id===id?' is-editing':'')} key={id}>
        <input id={`cooking-check-${id}`} type="checkbox" aria-label={l.name} checked={checked} disabled={busy} onChange={()=>void commit({...session,checked:checked?session.checked.filter(x=>x!==id):[...session.checked,id]})}/>
        <span><span><label htmlFor={`cooking-check-${id}`}>{l.name}</label></span><small className={'journal-quantity'+(override?' is-overridden':'')}>
         {quantityEdit?.id===id?<span className="journal-quantity-edit">
          <NumberInput autoFocus enterKeyHint="done" aria-label={t('journalQuantityFor',{name:l.name})} type="number" inputMode="decimal" step="any" min="0" onBlur={e=>{const next=e.relatedTarget;if(quantityIntent.current||next instanceof Element&&next.closest('.journal-quantity-edit'))return;void saveQuantity(id,l.unit,e.currentTarget.value)}} value={quantityEdit.value} disabled={busy} onChange={e=>{setQuantityError('');setQuantityEdit({id,value:e.target.value})}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();quantityIntent.current=true;setQuantityEdit(undefined)}if(e.key==='Enter'){e.preventDefault();e.stopPropagation();quantityIntent.current=true;void saveQuantity(id,l.unit,e.currentTarget.value)}}}/><span className="journal-quantity-unit">{unitLabel}</span>
          <button type="button" disabled={busy} aria-label={t('journalQuantitySave')} onPointerDown={()=>{quantityIntent.current=true}} onPointerCancel={()=>{quantityIntent.current=false}} onClick={()=>{quantityIntent.current=true;void saveQuantity(id,l.unit,quantityEdit.value)}}>✓</button>
          <button type="button" disabled={busy} aria-label={t('journalQuantityCancel')} onPointerDown={()=>{quantityIntent.current=true}} onPointerCancel={()=>{quantityIntent.current=false}} onClick={()=>{quantityIntent.current=true;setQuantityEdit(undefined);setQuantityError('')}}>×</button>
          {quantityError&&<span role="alert">{quantityError}</span>}
         </span>:<button type="button" className="journal-quantity-trigger" disabled={busy} aria-label={t('journalQuantityFor',{name:l.name})} title={override?t('journalQuantityOverridden'):t('journalQuantityEdit')} onClick={()=>{quantityIntent.current=false;setQuantityError('');setQuantityEdit({id,value:String(l.unit==='fraction'?quantity*100:quantity)})}}>{journalQuantity({...l,quantity})} {unitLabel}<Pencil size={10} aria-hidden="true"/></button>}
         {override&&quantityEdit?.id!==id&&<button type="button" className="journal-quantity-restore" disabled={busy} aria-label={t('journalQuantityRestore',{name:l.name})} onClick={async()=>{if(await commit(restoreCookingQuantity(session,id)))setQuantityEdit(undefined)}}>↶</button>}
        </small></span>
       </div>})}
      </div>)}
     </section>
    </div>
   </>}
  </div>
  <div className="form-actions journal-footer"><button type="button" disabled={!session||busy} onClick={()=>{if(session&&window.confirm(t('journalResetConfirm')))void commit({...session,checked:[],needsReview:false})}}>{t('journalReset')}</button><button type="button" className="primary" disabled={!session||busy} onPointerDown={()=>{quantityIntent.current=true;mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false;quantityIntent.current=false}} onClick={()=>void beginMeal()}><Plus size={14} aria-hidden="true"/>{t('journalAddMeal')}</button></div>
 </Modal>{mealDraft&&<AddFood draft={mealDraft} recipes={recipes} pantry={pantry} close={cancelMeal} notice={notice}/>}</>;
}
