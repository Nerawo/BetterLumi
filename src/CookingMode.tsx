import {journalQuantity} from './journal-quantity';
import {JournalMethod} from './JournalMethod';
import {NumberInput} from './NumberInput';
import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Recipe} from './domain';
import {Modal} from './ui';
import {recipeServingLines,recipeYield} from './recipe-nutrition';
import {recipeSections,changeCookingServings,setCookingQuantity,restoreCookingQuantity,type CookingSession} from './cooking-journal';
import {openCookingSession,saveCookingSession} from './cooking-session';
import {householdUnitLabel} from './household-units';
import {useIngredientPreferences} from './useIngredientPreferences';
import './cooking-journal-locale';
import './cooking-journal.css';
import './cooking-mode-compact.css';
import {JournalHeading} from './JournalHeading';

export function CookingMode({recipe,close}:{recipe:Recipe;close:()=>void}){
 const {t,i18n}=useTranslation(),preferences=useIngredientPreferences();
 const [session,setSession]=useState<CookingSession>(),[amount,setAmount]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [quantityEdit,setQuantityEdit]=useState<{id:string;value:string}>(),[quantityError,setQuantityError]=useState('');
 const saving=useRef(false),stepping=useRef(false);
 useEffect(()=>{let alive=true;setSession(undefined);setQuantityEdit(undefined);openCookingSession(recipe).then(s=>{if(alive){setSession(s);setAmount(String(s.servings));setError('')}}).catch(()=>{if(alive)setError(t('journalError'))});return()=>{alive=false}},[recipe.id,recipe.revision,t]);
 useEffect(()=>{
  let disposed=false,requesting=false,lock:WakeLockSentinel|undefined;
  const acquire=async()=>{if(disposed||requesting||document.visibilityState!=='visible'||!navigator.wakeLock||lock&&!lock.released)return;requesting=true;try{const next=await navigator.wakeLock.request('screen');if(disposed)await next.release();else lock=next}catch{/* Optional enhancement; never blocks cooking. */}finally{requesting=false}};
  void acquire();document.addEventListener('visibilitychange',acquire);
  return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);void lock?.release().catch(()=>{})};
 },[]);
 const commit=async(next:CookingSession,finish=false)=>{
  if(!session||saving.current)return;saving.current=true;setBusy(true);setError('');setSession(next);
  try{await saveCookingSession(session,next);if(finish)close();return true}catch{setSession(session);setAmount(String(session.servings));setError(t('journalError'));return false}finally{saving.current=false;setBusy(false)}
 };
 const applyServings=(n=Number(amount))=>{
  if(!session||saving.current)return;
  if(!Number.isFinite(n)||n<=0){setAmount(String(session.servings));return}
  if(n===session.servings)return;
  if(n!==session.servings&&(session.checked.length||session.quantityOverrides?.length)&&!window.confirm(t(session.quantityOverrides?.length?'journalServingOverrideReset':'journalServingReset'))){setAmount(String(session.servings));return}
  setQuantityEdit(undefined);setAmount(String(n));void commit(changeCookingServings(session,n,true));
 };
 const lines=session?recipeServingLines(recipe,session.servings):[];
 const stepperAmount=Number.isFinite(Number(amount))&&Number(amount)>0?Number(amount):session?.servings??1;
 const sections=recipeSections({...recipe,lines});
 return <Modal title={recipe.name} eyebrow="COOKING JOURNAL" close={close} className="recipe-detail-modal cooking-mode">
  <div className="journal-scroll">
   {error&&<p role="alert">{error} {!session&&<button type="button" disabled={busy} onClick={async()=>{if(!window.confirm(t('journalResetConfirm')))return;setBusy(true);try{const next=await openCookingSession(recipe,true);setSession(next);setAmount(String(next.servings));setError('')}catch{setError(t('journalError'))}finally{setBusy(false)}}}>{t('journalRestart')}</button>}</p>}
   {session&&<>
    <div className="journal-session-controls"><label><span>{t('journalYield')}</span><span className="journal-serving-stepper"><button type="button" disabled={busy||stepperAmount<=0.5} aria-label={t('journalDecrease')} onPointerDown={()=>{stepping.current=true}} onTouchStart={()=>{stepping.current=true}} onPointerCancel={()=>{stepping.current=false}} onPointerUp={()=>{requestAnimationFrame(()=>{stepping.current=false})}} onClick={()=>applyServings(Math.max(0.5,stepperAmount-0.5))}>−</button><input aria-label={t('journalYield')} type="number" inputMode="decimal" min="0.01" step="any" value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)} onBlur={()=>{if(!stepping.current)applyServings()}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/><button type="button" disabled={busy} aria-label={t('journalIncrease')} onPointerDown={()=>{stepping.current=true}} onTouchStart={()=>{stepping.current=true}} onPointerCancel={()=>{stepping.current=false}} onPointerUp={()=>{requestAnimationFrame(()=>{stepping.current=false})}} onClick={()=>applyServings(stepperAmount+0.5)}>+</button></span></label><span role="status">{t('journalProgress',{done:session.checked.length,total:lines.length})}</span><small>{t('journalOriginal',{count:recipeYield(recipe)})}</small></div>
    {session.needsReview&&<p role="status">{t('journalReview')} <button type="button" disabled={busy} onClick={()=>void commit({...session,checked:[],needsReview:false})}>{t('journalRestart')}</button></p>}
    <div className="cooking-journal-columns">
     <section><h3><JournalHeading>Method</JournalHeading></h3><JournalMethod text={recipe.instructions||t('notRecorded')}/></section>
     <section><h3><JournalHeading>Ingredients</JournalHeading></h3>
      {sections.filter(g=>g.lines.length).map(g=><div className="journal-ingredient-group" key={g.id}>{(recipe.ingredientGroups?.length??0)>0&&<h4><JournalHeading>{g.name||t('journalUngrouped')}</JournalHeading></h4>}
       {g.lines.map(l=>{const index=lines.indexOf(l),id=session.entries[index].id,checked=session.checked.includes(id),override=session.quantityOverrides?.find(o=>o.entryId===id),quantity=override?.quantity??l.quantity,unitLabel=l.unit==='fraction'?'% '+t('storageReference'):l.unit==='g'?t('gramsUnit'):l.unit==='serving'?t('servingUnit'):householdUnitLabel(l.ingredientId,l.unit,i18n.language,preferences[l.ingredientId]?.units);return <div className={'journal-check-row'+(checked?' is-checked':'')} key={id}>
        <input id={`cooking-check-${id}`} type="checkbox" aria-label={l.name} checked={checked} disabled={busy} onChange={()=>void commit({...session,checked:checked?session.checked.filter(x=>x!==id):[...session.checked,id]})}/>
        <span><span><label htmlFor={`cooking-check-${id}`}>{l.name}</label></span><small className={'journal-quantity'+(override?' is-overridden':'')}>
         {quantityEdit?.id===id?<span className="journal-quantity-edit">
          <NumberInput autoFocus aria-label={t('journalQuantityFor',{name:l.name})} type="number" inputMode="decimal" step="any" min="0" value={quantityEdit.value} disabled={busy} onChange={e=>{setQuantityError('');setQuantityEdit({id,value:e.target.value})}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setQuantityEdit(undefined)}}}/><span>{unitLabel}</span>
          <button type="button" disabled={busy} aria-label={t('journalQuantitySave')} onClick={async()=>{const raw=quantityEdit.value.trim(),n=Number(raw);if(!raw||!Number.isFinite(n)||n<0){setQuantityError(t('journalQuantityInvalid'));return}const next=setCookingQuantity(session,id,l.unit==='fraction'?n/100:n,l.unit);if(await commit(next)){setQuantityEdit(undefined);setQuantityError('')}}}>✓</button>
          <button type="button" disabled={busy} aria-label={t('journalQuantityCancel')} onClick={()=>{setQuantityEdit(undefined);setQuantityError('')}}>×</button>
          {quantityError&&<span role="alert">{quantityError}</span>}
         </span>:<button type="button" className="journal-quantity-trigger" disabled={busy} aria-label={t('journalQuantityFor',{name:l.name})} title={override?t('journalQuantityOverridden'):t('journalQuantityEdit')} onClick={()=>{setQuantityError('');setQuantityEdit({id,value:String(l.unit==='fraction'?quantity*100:quantity)})}}>{journalQuantity({...l,quantity})} {unitLabel}</button>}
         {override&&<button type="button" className="journal-quantity-restore" disabled={busy} aria-label={t('journalQuantityRestore',{name:l.name})} onClick={async()=>{if(await commit(restoreCookingQuantity(session,id)))setQuantityEdit(undefined)}}>↶</button>}
        </small></span>
       </div>})}
      </div>)}
     </section>
    </div>
   </>}
  </div>
  <div className="form-actions journal-footer"><button type="button" disabled={!session||busy} onClick={()=>{if(session&&window.confirm(t('journalResetConfirm')))void commit({...session,checked:[],needsReview:false})}}>{t('journalReset')}</button><button type="button" className="primary" disabled={!session||busy} onClick={()=>{if(session)void commit({...session,status:'completed'},true)}}>{t('journalFinish')}</button></div>
 </Modal>;
}
