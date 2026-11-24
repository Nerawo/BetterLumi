import {Plus} from 'lucide-react';
import {effectiveCookingRecipe} from './cooking-effective';
import {isBuiltInRecipe} from './data/builtInRecipes';
import {AddFood,type MealDraft} from './Meals';
import {MakeBatchModal} from './FoodStorage';
import {journalQuantity} from './journal-quantity';
import {JournalMethod} from './JournalMethod';
import {NumberInput} from './NumberInput';
import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Recipe,PantryItem} from './domain';
import {Modal,type Notice} from './ui';
import {recipeServingLines,recipeYield} from './recipe-nutrition';
import {recipeSections,changeCookingServings,setCookingQuantity,restoreCookingQuantity,type CookingSession} from './cooking-journal';
import {openCookingSession,saveCookingSession,discardCookingSession,updateRecipeFromCooking} from './cooking-session';
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
 const [batchServings,setBatchServings]=useState<number>();
 const [resetConfirm,setResetConfirm]=useState(false);
 const [updateConfirm,setUpdateConfirm]=useState(false),[batchRecipe,setBatchRecipe]=useState<Recipe>();
 const saving=useRef(false),stepping=useRef(false),quantitySaving=useRef(false),quantityIntent=useRef(false),mealIntent=useRef(false);
 const currentSession=useRef<CookingSession|undefined>(undefined),body=useRef<HTMLDivElement>(null),mealScroll=useRef(0);
 const initialization=useRef<{recipeId:string;revision:number;promise:Promise<CookingSession>}|undefined>(undefined),mounted=useRef(false),leaving=useRef(false),pending=useRef<Promise<unknown>>(Promise.resolve());
 useEffect(()=>{let alive=true;setQuantityEdit(undefined);
  // StrictMode rehearses effects: reuse initialization rather than abandoning the same live session.
  if(!initialization.current||initialization.current.recipeId!==recipe.id||initialization.current.revision!==recipe.revision)initialization.current={recipeId:recipe.id,revision:recipe.revision,promise:openCookingSession(recipe,!initialization.current||initialization.current.recipeId!==recipe.id)};
  const opening=initialization.current.promise;pending.current=opening;
  opening.then(s=>{if(alive){setSession(s);currentSession.current=s;setAmount(String(s.servings));setError('')}}).catch(()=>{if(alive)setError(t('journalError'))});return()=>{alive=false}},[recipe.id,recipe.revision]);
 // Route exits unmount this mode; nested dialogs leave it mounted. A new visit always starts fresh,
 // including after a browser termination that cannot finish an asynchronous settings write.
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;queueMicrotask(()=>{if(mounted.current)return;void pending.current.catch(()=>{}).then(async()=>{const loaded=await initialization.current?.promise.catch(()=>undefined),active=currentSession.current??loaded;if(!mounted.current&&active)await discardCookingSession(active)}).catch(()=>{})})}},[]);
 useEffect(()=>{
  let disposed=false,requesting=false,lock:WakeLockSentinel|undefined;
  const acquire=async()=>{if(disposed||requesting||document.visibilityState!=='visible'||!navigator.wakeLock||lock&&!lock.released)return;requesting=true;try{const next=await navigator.wakeLock.request('screen');if(disposed)await next.release();else lock=next}catch{/* Optional enhancement; never blocks cooking. */}finally{requesting=false}};
  void acquire();document.addEventListener('visibilitychange',acquire);
  return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);void lock?.release().catch(()=>{})};
 },[]);
 const commit=async(next:CookingSession)=>{
  const previous=currentSession.current;if(!previous||saving.current||leaving.current)return false;
  saving.current=true;setBusy(true);setError('');currentSession.current=next;setSession(next);
  const task=saveCookingSession(previous,next);pending.current=task;
  try{await task;return true}catch{currentSession.current=previous;setSession(previous);setAmount(String(previous.servings));setError(t('journalError'));return false}finally{saving.current=false;setBusy(false)}
 };
 const leave=async()=>{
  if(leaving.current)return;leaving.current=true;quantityIntent.current=true;setBusy(true);
  try{await pending.current.catch(()=>{});const active=currentSession.current;if(active)await discardCookingSession(active);currentSession.current=undefined;close()}
  catch{leaving.current=false;setError(t('journalError'));setBusy(false)}
 };
 const finishPreparation=async(done:()=>void,kind:'meal'|'batch'='meal')=>{
  leaving.current=true;setBusy(true);const active=currentSession.current;
  try{if(active)await discardCookingSession(active);currentSession.current=undefined}catch{notice(t(kind==='batch'?'journalBatchSessionError':'journalMealSessionError'))}
  done();
 };
 const resetPreparation=async(confirmed=false)=>{
  const current=currentSession.current;if(!current||saving.current)return;
  const meaningful=current.checked.length||current.quantityOverrides?.length||current.servings!==recipeYield(recipe)||amount!==String(recipeYield(recipe))||!!quantityEdit;
  if(meaningful&&!confirmed){setResetConfirm(true);return}
  if(await commit({...current,version:2,servings:recipeYield(recipe),checked:[],quantityOverrides:[],needsReview:false})){setAmount(String(recipeYield(recipe)));setQuantityEdit(undefined);setQuantityError('');setResetConfirm(false)}
 };
 const saveQuantity=async(id:string,unit:string,raw:string)=>{
  const current=currentSession.current;if(!current||quantitySaving.current||saving.current)return false;
  const n=Number(raw);if(!raw.trim()||!Number.isFinite(n)||n<0){setQuantityError(t('journalQuantityInvalid'));return false}
  quantitySaving.current=true;
  try{const quantity=unit==='fraction'?n/100:n,index=current.entries.findIndex(e=>e.id===id),derived=recipeServingLines(recipe,current.servings)[index]?.quantity;
   const next=quantity!==0&&quantity===derived?restoreCookingQuantity(current,id):setCookingQuantity(current,id,quantity,unit);
   effectiveCookingRecipe(recipe,next);if(!await commit(next))return false;setQuantityEdit(undefined);setQuantityError('');return true}catch{setQuantityError(t('journalQuantityInvalid'));return false}finally{quantitySaving.current=false}
 };
 const applyServings=async(n=Number(amount))=>{
  const current=currentSession.current;if(!current||saving.current)return false;
  if(!Number.isFinite(n)||n<=0){setAmount(String(current.servings));return false}
  if(n===current.servings)return true;
  if((current.checked.length||current.quantityOverrides?.length)&&!window.confirm(t(current.quantityOverrides?.length?'journalServingOverrideReset':'journalServingReset'))){setAmount(String(current.servings));return false}
  setQuantityEdit(undefined);setAmount(String(n));return commit(changeCookingServings(current,n,true));
 };
 const prepareDestination=async()=>{
  mealIntent.current=false;if(saving.current)return;
  if(quantityEdit){const index=session?.entries.findIndex(e=>e.id===quantityEdit.id)??-1;if(index<0||!await saveQuantity(quantityEdit.id,recipe.lines[index].unit,quantityEdit.value))return}
  if(!await applyServings())return;
  const current=currentSession.current;if(!current)return;
  try{effectiveCookingRecipe(recipe,current)}catch{setError(t('journalQuantityInvalid'));return}
  mealScroll.current=body.current?.scrollTop??0;
  return current.servings;
 };
 const beginMeal=async()=>{const servings=await prepareDestination();if(servings&&currentSession.current)setMealDraft({date,recipe:effectiveCookingRecipe(recipe,currentSession.current),recipeServings:servings,onCommitted:savedDate=>{void finishPreparation(()=>mealSaved(savedDate))}})};
 const beginBatch=async()=>{const servings=await prepareDestination();if(servings&&currentSession.current){setBatchRecipe(effectiveCookingRecipe(recipe,currentSession.current));setBatchServings(servings)}};
 const updateRecipe=async()=>{if(saving.current||!currentSession.current)return;saving.current=true;setBusy(true);setError('');try{const task=updateRecipeFromCooking(recipe,currentSession.current);pending.current=task;const next=await task;currentSession.current=next.session;setSession(next.session);setUpdateConfirm(false)}catch{setError(t('journalError'))}finally{saving.current=false;setBusy(false)}};
 const cancelMeal=()=>{setMealDraft(undefined);requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=mealScroll.current})};
 const cancelBatch=()=>{setBatchServings(undefined);requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=mealScroll.current})};
 const lines=session?recipeServingLines(recipe,session.servings):[];
 const stepperAmount=Number.isFinite(Number(amount))&&Number(amount)>0?Number(amount):session?.servings??1;
 const sections=recipeSections({...recipe,lines});
 const meaningfulOverrides=!!session?.quantityOverrides?.some(o=>{const index=session.entries.findIndex(e=>e.id===o.entryId);return index>=0&&o.fingerprint===session.entries[index].fingerprint&&o.unit===lines[index]?.unit&&o.quantity!==lines[index]?.quantity});
 return <><Modal title={recipe.name} eyebrow="COOKING JOURNAL" close={()=>void leave()} className="recipe-detail-modal cooking-mode">
  <div ref={body} className="journal-scroll">
   {error&&<p role="alert">{error} {!session&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{const next=await openCookingSession(recipe,true);setSession(next);currentSession.current=next;setAmount(String(next.servings));setError('')}catch{setError(t('journalError'))}finally{setBusy(false)}}}>{t('journalRestart')}</button>}</p>}
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
         <span className="journal-quantity-measure" aria-hidden="true"><span className="journal-quantity-value">{journalQuantity({...l,quantity})}{" "}</span><span className="journal-quantity-unit">{unitLabel}</span></span>
         {quantityEdit?.id===id?<span className="journal-quantity-edit">
          <NumberInput autoFocus enterKeyHint="done" aria-label={t('journalQuantityFor',{name:l.name})} type="number" inputMode="decimal" step="any" min="0" onBlur={e=>{const next=e.relatedTarget;if(quantityIntent.current||next instanceof Element&&next.closest('.journal-quantity-edit'))return;void saveQuantity(id,l.unit,e.currentTarget.value)}} value={quantityEdit.value} disabled={busy} onChange={e=>{setQuantityError('');setQuantityEdit({id,value:e.target.value})}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();quantityIntent.current=true;setQuantityEdit(undefined)}if(e.key==='Enter'){e.preventDefault();e.stopPropagation();quantityIntent.current=true;void saveQuantity(id,l.unit,e.currentTarget.value)}}}/><span className="journal-quantity-unit">{unitLabel}</span>
          <span className="journal-quantity-actions"><button type="button" disabled={busy} aria-label={t('journalQuantitySave')} onPointerDown={()=>{quantityIntent.current=true}} onPointerCancel={()=>{quantityIntent.current=false}} onClick={()=>{quantityIntent.current=true;void saveQuantity(id,l.unit,quantityEdit.value)}}>✓</button>
          <button type="button" disabled={busy} aria-label={t('journalQuantityCancel')} onPointerDown={()=>{quantityIntent.current=true}} onPointerCancel={()=>{quantityIntent.current=false}} onClick={()=>{quantityIntent.current=true;setQuantityEdit(undefined);setQuantityError('')}}>×</button>
          </span>{quantityError&&<span role="alert">{quantityError}</span>}
         </span>:<><button type="button" className="journal-quantity-trigger" disabled={busy} aria-label={t('journalQuantityFor',{name:l.name})} title={override?t('journalQuantityOverridden'):t('journalQuantityEdit')} onClick={()=>{quantityIntent.current=false;setQuantityError('');setQuantityEdit({id,value:String(l.unit==='fraction'?quantity*100:quantity)})}}><span className="journal-quantity-value">{journalQuantity({...l,quantity})}{" "}</span><span className="journal-quantity-unit">{unitLabel}</span></button>
         <span className="journal-quantity-actions">{override&&<button type="button" className="journal-quantity-restore" disabled={busy} aria-label={t('journalQuantityRestore',{name:l.name})} onClick={async()=>{if(await commit(restoreCookingQuantity(session,id)))setQuantityEdit(undefined)}}>↶</button>}</span></>}
        </small></span>
       </div>})}
      </div>)}
     </section>
    </div>
   </>}
  </div>
  <div className="form-actions journal-footer"><div className="journal-prep-actions"><button type="button" className="journal-reset" disabled={!session||busy} onPointerDown={()=>{quantityIntent.current=true;mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false;quantityIntent.current=false}} onClick={()=>{mealIntent.current=false;void resetPreparation()}}>{t('journalResetPreparation')}</button>{meaningfulOverrides&&!isBuiltInRecipe(recipe)&&<button type="button" className="journal-update" disabled={!session||busy} onPointerDown={()=>{quantityIntent.current=true;mealIntent.current=true}} onPointerCancel={()=>{quantityIntent.current=false;mealIntent.current=false}} onClick={async()=>{if(await prepareDestination())setUpdateConfirm(true)}}>{t("journalUpdateRecipe")}</button>}</div><button type="button" className="primary" disabled={!session||busy} onPointerDown={()=>{quantityIntent.current=true;mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false;quantityIntent.current=false}} onClick={()=>void beginMeal()}><Plus size={14} aria-hidden="true"/>{t('journalAddMeal')}</button><button type="button" className="secondary journal-add-storage" disabled={!session||busy} onPointerDown={()=>{quantityIntent.current=true;mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false;quantityIntent.current=false}} onClick={()=>void beginBatch()}><Plus size={14} aria-hidden="true"/>{t('journalAddStorage')}</button></div>
 </Modal>{updateConfirm&&<Modal title={t("journalUpdateRecipe")} close={()=>{if(!busy)setUpdateConfirm(false)}} className="goal-editor-modal journal-update-confirm"><div className="modal-scroll"><p>{t("journalUpdateRecipeConfirm")}</p>{error&&<p role="alert">{error}</p>}</div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setUpdateConfirm(false)}>{t("cancel")}</button><button type="button" className="primary" disabled={busy} onClick={()=>void updateRecipe()}>{t("journalUpdateRecipe")}</button></div></Modal>}{resetConfirm&&<Modal title={t('journalResetPreparation')} close={()=>{if(!busy)setResetConfirm(false)}} className="goal-editor-modal journal-reset-confirm"><div className="modal-scroll"><p>{t('journalResetPreparationConfirm')}</p></div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setResetConfirm(false)}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void resetPreparation(true)}>{t('journalResetPreparation')}</button></div></Modal>}{mealDraft&&<AddFood draft={mealDraft} recipes={recipes} pantry={pantry} close={cancelMeal} notice={notice}/>}{batchServings!==undefined&&<MakeBatchModal recipes={recipes} pantry={pantry} initialRecipe={batchRecipe??recipe} initialServings={batchServings} close={cancelBatch} notice={notice} onCommitted={()=>{void finishPreparation(close,'batch')}}/>}</>;
}
