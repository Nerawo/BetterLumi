import {DraftUnitPicker} from './DraftUnitPicker';
import {builtInFoods} from './data/builtInFoods';
import {convertRecipeLine} from './recipe-draft-units';
import {Plus,Pencil,Check} from 'lucide-react';
import {effectiveCookingRecipe,changeCookingUnit,cookingPreparationLines,type MealPreparation} from './cooking-effective';
import {isBuiltInRecipe} from './data/builtInRecipes';
import {AddFood,type MealDraft} from './Meals';
import {MakeBatchModal} from './FoodStorage';
import {journalQuantity} from './journal-quantity';
import {JournalMethod} from './JournalMethod';
import {JournalQuantityInput} from './JournalQuantityInput';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Recipe,PantryItem,RecipeLine} from './domain';
import {Modal,type Notice} from './ui';
import {recipeYield} from './recipe-nutrition';
import {recipeSections,changeCookingServings,setCookingQuantity,restoreCookingQuantity,visibleCookingEntries,hasCookingIngredientChanges,replaceCookingIngredient,addCookingIngredient,removeCookingIngredient,resetCookingPreparation,type CookingSession} from './cooking-journal';
import {openCookingSession,saveCookingSession,discardCookingSession,updateRecipeFromCooking,updateCookingMethod} from './cooking-session';
import {householdUnitLabel} from './household-units';
import {useIngredientPreferences} from './useIngredientPreferences';
import './cooking-journal-locale';
import './cooking-journal.css';
import './cooking-mode-compact.css';
import {JournalHeading} from './JournalHeading';
import {registerRouteLeaveGuard} from './routing';
import {IngredientPicker} from './IngredientPicker';
import {StoredFoodPicker} from './StoredFoodPicker';
import {storedRecipeLine} from './recipe-storage';
import {DraftIngredientRow} from './DraftIngredientRow';
import {preferredFoodUnit,personalQuantity,personalNutrition,userChoice} from './ingredient-preferences';
import {recipeUnitFactors} from './recipe-draft-units';
import type {FoodChoice} from './reference-library';
import {referenceName} from './reference-library';

export function CookingMode({recipe,recipes,pantry,date,notice,mealSaved,close,preparation,onReturnMeal}:{preparation?:MealPreparation;onReturnMeal?:(prepared:Recipe)=>void;recipe:Recipe;recipes:Recipe[];pantry:PantryItem[];date:string;notice:Notice;mealSaved:(date:string)=>void;close:()=>void}){
 const {t,i18n}=useTranslation(),preferences=useIngredientPreferences();
 const [session,setSession]=useState<CookingSession>(),[amount,setAmount]=useState(''),[error,setError]=useState(''),[savingUI,setBusy]=useState(false);
 const busy=savingUI||!!session&&session.recipeRevision!==recipe.revision;
 const [unitMenu,setUnitMenu]=useState<string>();
 const [quantityEdit,setQuantityEdit]=useState<string>();
 const quantityWrite=useRef<Promise<unknown>|undefined>(undefined);
 const [methodEdit,setMethodEdit]=useState<{recipe:Recipe;text:string}>(),[methodError,setMethodError]=useState('');
 const methodScroll=useRef(0),methodInput=useRef<HTMLTextAreaElement>(null),methodDirty=useRef(false),methodSaving=useRef(false);
 const hasMethodChanges=!!methodEdit&&methodEdit.text!==methodEdit.recipe.instructions;methodDirty.current=hasMethodChanges;
 const [mealDraft,setMealDraft]=useState<MealDraft>();
 const [picking,setPicking]=useState<'pantry'|'batch'>(),[removing,setRemoving]=useState<{id:string;name:string}>();
 const [batchServings,setBatchServings]=useState<number>();
 const [resetConfirm,setResetConfirm]=useState(false);
 const [updateConfirm,setUpdateConfirm]=useState(false),[batchRecipe,setBatchRecipe]=useState<Recipe>();
 const saving=useRef(false),stepping=useRef(false),mealIntent=useRef(false);
 const recipeSnapshot=useRef(recipe);
 const [replacement,setReplacement]=useState<{id:string;fingerprint:string}>();
 const currentSession=useRef<CookingSession|undefined>(undefined),body=useRef<HTMLDivElement>(null),mealScroll=useRef(0);
 const initialization=useRef<{recipeId:string;revision:number;promise:Promise<CookingSession>}|undefined>(undefined),mounted=useRef(false),leaving=useRef(false),pending=useRef<Promise<unknown>>(Promise.resolve());
 const confirmMethodLeave=()=>!methodSaving.current&&(!methodDirty.current||window.confirm(t('journalMethodDiscardConfirm')));
 useEffect(()=>{const release=registerRouteLeaveGuard(()=>confirmMethodLeave());const unload=(event:BeforeUnloadEvent)=>{if(methodDirty.current){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',unload);return()=>{release();window.removeEventListener('beforeunload',unload)}},[t]);
 useLayoutEffect(()=>{const input=methodInput.current;if(input){input.style.height='auto';input.style.height=input.scrollHeight+'px'}},[methodEdit?.text]);
 useEffect(()=>{let alive=true;setQuantityEdit(undefined);
  // StrictMode rehearses effects: reuse initialization rather than abandoning the same live session.
  if(!initialization.current||initialization.current.recipeId!==recipe.id||initialization.current.revision!==recipe.revision)initialization.current={recipeId:recipe.id,revision:recipe.revision,promise:openCookingSession(recipe,!initialization.current||initialization.current.recipeId!==recipe.id,!initialization.current?preparation:undefined)};
  const opening=initialization.current.promise;pending.current=opening;
  opening.then(s=>{if(alive){recipeSnapshot.current=recipe;setSession(s);currentSession.current=s;setAmount(String(s.servings));setError('')}}).catch(()=>{if(alive)setError(t('journalError'))});return()=>{alive=false}},[recipe.id,recipe.revision]);
 // Route exits unmount this mode; nested dialogs leave it mounted. A new visit always starts fresh,
 // including after a browser termination that cannot finish an asynchronous settings write.
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;queueMicrotask(()=>{if(mounted.current)return;void pending.current.catch(()=>{}).then(async()=>{const loaded=await initialization.current?.promise.catch(()=>undefined),active=currentSession.current??loaded;if(!mounted.current&&active)await discardCookingSession(active)}).catch(()=>{})})}},[]);
 useEffect(()=>{
  let disposed=false,requesting=false,lock:WakeLockSentinel|undefined;
  const acquire=async()=>{if(disposed||requesting||document.visibilityState!=='visible'||!navigator.wakeLock||lock&&!lock.released)return;requesting=true;try{const next=await navigator.wakeLock.request('screen');if(disposed)await next.release();else lock=next}catch{/* Optional enhancement; never blocks cooking. */}finally{requesting=false}};
  void acquire();document.addEventListener('visibilitychange',acquire);
  return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);void lock?.release().catch(()=>{})};
 },[]);
 const commit=async(next:CookingSession,quantityOnly=false)=>{
  const previous=currentSession.current;if(!previous||saving.current||leaving.current)return false;
  // Apply the amount before the next tap. Persist dependent changes in tap order.
  if(!quantityOnly){saving.current=true;setBusy(true)}
  setError('');currentSession.current=next;setSession(next);
  const write=async()=>{
   try{await saveCookingSession(previous,next)}
   catch(error){currentSession.current=previous;setSession(previous);setAmount(String(previous.servings));throw error}
  };
  const task=quantityWrite.current?quantityWrite.current.then(write):write();
  if(quantityOnly)quantityWrite.current=task;
  pending.current=task;
  try{await task;return true}catch{setError(t('journalError'));return false}
  finally{
   if(quantityWrite.current===task)quantityWrite.current=undefined;
   if(!quantityOnly){saving.current=false;setBusy(false)}
  }
 };
 const leave=async()=>{
  if(leaving.current||!confirmMethodLeave())return;leaving.current=true;setBusy(true);
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
  const meaningful=current.checked.length||current.quantityOverrides?.length||current.servings!==recipeYield(recipe)||hasCookingIngredientChanges(current)||amount!==String(recipeYield(recipe))||!!quantityEdit;
  if(meaningful&&!confirmed){setResetConfirm(true);return}
  if(await commit(resetCookingPreparation(recipe,current))){setAmount(String(recipeYield(recipe)));setQuantityEdit(undefined);setResetConfirm(false)}
 };
 const saveQuantity=(id:string,unit:string,value:number)=>{
  const current=currentSession.current;if(!current)return;
  try{
   const quantity=unit==='fraction'?value/100:value;
   const index=visibleCookingEntries(current).findIndex(entry=>entry.id===id);
   const derived=cookingPreparationLines(recipe,current)[index]?.quantity;
   const next=quantity!==0&&quantity===derived?restoreCookingQuantity(current,id):setCookingQuantity(current,id,quantity,unit);
   effectiveCookingRecipe(recipe,next);
   void commit(next,true);
  }catch{setError(t('journalQuantityInvalid'));return false}
 };
 const applyServings=async(n=Number(amount))=>{
  const current=currentSession.current;if(!current||saving.current)return false;
  if(!Number.isFinite(n)||n<=0){setAmount(String(current.servings));return false}
  if(n===current.servings)return true;
  if((current.checked.length||current.quantityOverrides?.length||hasCookingIngredientChanges(current))&&!window.confirm(t(hasCookingIngredientChanges(current)?'journalServingIngredientsReset':current.quantityOverrides?.length?'journalServingOverrideReset':'journalServingReset'))){setAmount(String(current.servings));return false}
  setQuantityEdit(undefined);setAmount(String(n));return commit(changeCookingServings(current,n,true));
 };
 const prepareDestination=async()=>{
  mealIntent.current=false;if(saving.current)return;
  try{await quantityWrite.current}catch{return}
  if(!await applyServings())return;
  const current=currentSession.current;if(!current)return;
  try{if(!effectiveCookingRecipe(recipe,current).lines.length){setError(t('journalIngredientsEmpty'));return}}catch{setError(t('journalQuantityInvalid'));return}
  mealScroll.current=body.current?.scrollTop??0;
  return current.servings;
 };
 const beginMeal=async()=>{
  const servings=await prepareDestination(),active=currentSession.current;
  if(!servings||!active)return;
  const prepared=effectiveCookingRecipe(recipe,active);
  if(onReturnMeal){
   const entries=visibleCookingEntries(active);
   const lines=prepared.lines.map((line,i)=>{
    const id=entries[i].id;
    return {...line,lineId:id};
   });
   await finishPreparation(()=>onReturnMeal({...prepared,lines}));
  }else{
   setMealDraft({date,fromCooking:true,recipe:prepared,recipeServings:servings,onCommitted:savedDate=>{void finishPreparation(()=>mealSaved(savedDate))}});
  }
 };
 const beginBatch=async()=>{const servings=await prepareDestination();if(servings&&currentSession.current){setBatchRecipe(effectiveCookingRecipe(recipe,currentSession.current));setBatchServings(servings)}};
 const updateRecipe=async()=>{if(saving.current||!currentSession.current)return;saving.current=true;setBusy(true);setError('');try{const task=updateRecipeFromCooking(recipe,currentSession.current);pending.current=task;const next=await task;recipeSnapshot.current=next.recipe;currentSession.current=next.session;setSession(next.session);setUpdateConfirm(false)}catch{setError(t('journalError'))}finally{saving.current=false;setBusy(false)}};
 const finishMethodEdit=()=>{methodDirty.current=false;setMethodEdit(undefined);setMethodError('');requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=methodScroll.current})};
 const saveMethod=async()=>{
  if(!methodEdit||!currentSession.current||saving.current||leaving.current)return;
  methodSaving.current=true;saving.current=true;setBusy(true);setMethodError('');
  try{const task=updateCookingMethod(methodEdit.recipe,currentSession.current,methodEdit.text);pending.current=task;const next=await task;recipeSnapshot.current=next.recipe;currentSession.current=next.session;setSession(next.session);finishMethodEdit()}
  catch{setMethodError(t('journalMethodSaveError'))}finally{methodSaving.current=false;saving.current=false;setBusy(false)}
 };
 const cancelMeal=()=>{setMealDraft(undefined);requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=mealScroll.current})};
 const cancelBatch=()=>{setBatchServings(undefined);requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=mealScroll.current})};
 if(!session||session.recipeRevision===recipe.revision)recipeSnapshot.current=recipe;
 const viewRecipe=recipeSnapshot.current;
 const lines=session?cookingPreparationLines(viewRecipe,session):[];
 const entries=session?visibleCookingEntries(session):[];
 const closePicker=()=>{setPicking(undefined);setReplacement(undefined)};
 const chooseLine=async(line:RecipeLine)=>{
  const current=currentSession.current;
  if(!current||busy)return;
  try{
   if(replacement&&!visibleCookingEntries(current).some(e=>e.id===replacement.id&&e.fingerprint===replacement.fingerprint))throw Error('Ingredient changed');
   const next=replacement?replaceCookingIngredient(current,replacement.id,line):addCookingIngredient(current,line);
   if(await commit(next))closePicker();
  }catch{closePicker();setError(t('journalError'))}
 };
 const chooseFood=(choice:FoodChoice)=>{
  const pref=preferences[choice.item.id],units=recipeUnitFactors(choice,pref);
  const preferred=preferredFoodUnit(choice,pref);
  const unit=units.has(preferred)?preferred:units.keys().next().value;
  if(!unit){closePicker();setError(t('journalQuantityInvalid'));return}
  const quantity=personalQuantity(choice,unit);
  void chooseLine({ingredientId:choice.item.id,name:choice.kind==='user'?choice.item.name:referenceName(choice.item,i18n.language),
   quantity,unit,nutrition:personalNutrition(choice,quantity,unit,pref)});
 };
 const requestRemoval=(id:string)=>{const current=currentSession.current;if(!current||busy)return;const at=visibleCookingEntries(current).findIndex(e=>e.id===id),line=cookingPreparationLines(recipe,current)[at];if(line)setRemoving({id,name:line.name})};
 const stepperAmount=Number.isFinite(Number(amount))&&Number(amount)>0?Number(amount):session?.servings??1;
 const sections=recipeSections({...viewRecipe,lines});
 const meaningfulOverrides=!!session&&(hasCookingIngredientChanges(session)||session.quantityOverrides?.some(o=>{const index=entries.findIndex(e=>e.id===o.entryId);return index>=0&&o.fingerprint===entries[index].fingerprint&&o.unit===lines[index]?.unit&&o.quantity!==lines[index]?.quantity}));
 return <><Modal title={viewRecipe.name} eyebrow="COOKING JOURNAL" close={()=>void leave()} className="recipe-detail-modal cooking-mode">
  <div ref={body} className="journal-scroll">
   {error&&<p role="alert">{error} {!session&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{const next=await openCookingSession(recipe,true,preparation);setSession(next);currentSession.current=next;setAmount(String(next.servings));setError('')}catch{setError(t('journalError'))}finally{setBusy(false)}}}>{t('journalRestart')}</button>}</p>}
   {session&&<>
    <div className="journal-session-controls"><label><span>{t('journalYield')}</span><span className="journal-serving-stepper"><button type="button" disabled={busy||stepperAmount<=0.5} aria-label={t('journalDecrease')} onPointerDown={()=>{stepping.current=true}} onTouchStart={()=>{stepping.current=true}} onPointerCancel={()=>{stepping.current=false}} onPointerUp={()=>{requestAnimationFrame(()=>{stepping.current=false})}} onClick={()=>applyServings(Math.max(0.5,stepperAmount-0.5))}>−</button><input aria-label={t('journalYield')} type="number" inputMode="decimal" min="0.01" step="any" value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)} onBlur={()=>{if(!stepping.current&&!mealIntent.current)void applyServings()}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/><button type="button" disabled={busy} aria-label={t('journalIncrease')} onPointerDown={()=>{stepping.current=true}} onTouchStart={()=>{stepping.current=true}} onPointerCancel={()=>{stepping.current=false}} onPointerUp={()=>{requestAnimationFrame(()=>{stepping.current=false})}} onClick={()=>applyServings(stepperAmount+0.5)}>+</button></span></label><span role="status">{t('journalProgress',{done:session.checked.length,total:lines.length})}</span><small>{t('journalOriginal',{count:recipeYield(viewRecipe)})}</small></div>
    {session.needsReview&&<p role="status">{t('journalReview')} <button type="button" disabled={busy} onClick={()=>void commit({...session,checked:[],needsReview:false})}>{t('journalRestart')}</button></p>}
    <div className="cooking-journal-columns">
     <section className="journal-method-section">
      <div className="journal-method-heading"><h3><JournalHeading>Method</JournalHeading></h3>{!isBuiltInRecipe(recipe)&&<button type="button" className={'journal-method-edit-trigger'+(methodEdit?' journal-method-confirm':'')} aria-label={t(methodEdit?'journalMethodSave':'journalMethodEdit')} aria-expanded={methodEdit!==undefined} aria-controls="journal-method-input" disabled={busy} onClick={()=>{if(methodEdit){void saveMethod();return}methodScroll.current=body.current?.scrollTop??0;setMethodError('');setMethodEdit({recipe,text:recipe.instructions})}}>{methodEdit?<Check size={16} aria-hidden="true"/>:<Pencil size={14} aria-hidden="true"/>}</button>}</div>
      {methodEdit?<div className="journal-method-editor"><textarea ref={methodInput} id="journal-method-input" autoFocus aria-label={t('journalMethodText')} value={methodEdit.text} disabled={busy} onChange={e=>setMethodEdit({...methodEdit,text:e.target.value})}/>{methodError&&<p role="alert">{methodError}</p>}</div>:<JournalMethod text={viewRecipe.instructions||t('notRecorded')}/>}
     </section>
     <section className="journal-ingredients-section"><div className="journal-method-heading journal-ingredients-heading"><h3><JournalHeading>Ingredients</JournalHeading></h3><button type="button" className="journal-ingredient-add" aria-label={t('ingredientPickerAdd')} disabled={busy} onClick={()=>setPicking('pantry')}><Plus size={16} aria-hidden="true"/></button></div>{!lines.length&&<p className="muted">{t('journalIngredientsEmpty')}</p>}
      {sections.filter(g=>g.lines.length).map(g=><div className="journal-ingredient-group" key={g.id}>{(viewRecipe.ingredientGroups?.length??0)>0&&<h4><JournalHeading>{g.name||t('journalUngrouped')}</JournalHeading></h4>}
       {g.lines.map(l=>{const index=lines.indexOf(l),id=entries[index].id,checked=session.checked.includes(id),override=session.quantityOverrides?.find(o=>o.entryId===id),quantity=override?.quantity??l.quantity,labelFor=(unit:string)=>unit==='fraction'?'% '+t('storageReference'):unit==='g'?t('gramsUnit'):unit==='serving'?t('servingUnit'):householdUnitLabel(l.ingredientId,unit,i18n.language,preferences[l.ingredientId]?.units);
        const unitLabel=labelFor(l.unit),item=pantry.find(p=>p.id===l.ingredientId),builtin=builtInFoods.find(b=>b.id===l.ingredientId);
        const choice=item?userChoice(item):builtin?{kind:'built-in' as const,item:builtin}:null;
        const factors=choice&&l.source!=='batch'?recipeUnitFactors(choice,preferences[l.ingredientId]):new Map<string,number>();
        const options=Array.from(factors.keys()).filter(unit=>convertRecipeLine({...l,quantity},unit,factors)).map(value=>({value,label:labelFor(value)}));
        const picker=<DraftUnitPicker open={unitMenu===id} setOpen={open=>setUnitMenu(open?id:undefined)} units={{name:l.name,value:l.unit,label:unitLabel,options,fixed:options.length<2,disabled:busy,
         change:unit=>{if(busy||!currentSession.current)return;try{void commit(changeCookingUnit(viewRecipe,currentSession.current,id,unit,factors))}catch{setError(t('journalQuantityInvalid'))}}}}/>;
        return <DraftIngredientRow key={id} id={id} name={l.name} cookingRemoval={()=>requestRemoval(id)} onReplace={()=>{setReplacement({id,fingerprint:entries[index].fingerprint});setPicking("pantry")}} disabled={busy||!!picking}><div className={'journal-check-row'+(checked?' is-checked':'')+(quantityEdit===id?' is-editing':'')} key={id} tabIndex={0} role="group" aria-label={l.name} aria-description={t('journalRemoveHint')} aria-keyshortcuts="Delete Shift+F10" onKeyDown={event=>{if(event.target===event.currentTarget&&!busy&&!quantityEdit&&(event.key==="Delete"||event.shiftKey&&event.key==="F10")){event.preventDefault();requestRemoval(id)}}}>
        <input id={`cooking-check-${id}`} type="checkbox" aria-label={l.name} checked={checked} disabled={busy} onChange={()=>void commit({...session,checked:checked?session.checked.filter(x=>x!==id):[...session.checked,id]})}/>
        <span><span><span className="journal-line-name" role="button" tabIndex={0} aria-label={t("replaceIngredient")+" "+l.name}>{l.name}</span></span><small className={'journal-quantity'+(override?' is-overridden':'')}>
         <span className="journal-amount-ink" aria-hidden="true"/><span className="journal-quantity-measure" aria-hidden="true"><span className="journal-quantity-value">{journalQuantity({...l,quantity})}{" "}</span><span className="journal-quantity-unit">{unitLabel}</span></span>
         {quantityEdit===id?<span className="journal-quantity-edit">
          <JournalQuantityInput autoFocus quantity={l.unit==='fraction'?quantity*100:quantity} label={t('journalQuantityFor',{name:l.name})}
            onCommit={value=>saveQuantity(id,l.unit,value)} onEnd={()=>setQuantityEdit(undefined)}/>
         </span>:<button type="button" className="journal-quantity-trigger" disabled={busy} aria-label={t('journalQuantityFor',{name:l.name})} title={override?t('journalQuantityOverridden'):t('journalQuantityEdit')} onClick={()=>setQuantityEdit(id)}><span className="journal-quantity-value">{journalQuantity({...l,quantity})}{" "}</span></button>}
         {override&&<button type="button" className="journal-quantity-restore" disabled={busy} aria-label={t('journalQuantityRestore',{name:l.name})} onClick={()=>{const current=currentSession.current;if(current)void commit(restoreCookingQuantity(current,id))}}>↶</button>}
         <span className="journal-quantity-unit cooking-unit-choice">{picker}</span>
        </small></span>
       </div></DraftIngredientRow>})}
      </div>)}
     </section>
    </div>
   </>}
  </div>
  <div className="form-actions journal-footer"><div className="journal-prep-actions"><button type="button" className="journal-reset" disabled={!session||busy} onPointerDown={()=>{mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false}} onClick={()=>{mealIntent.current=false;void resetPreparation()}}>{t('journalResetPreparation')}</button>{meaningfulOverrides&&!isBuiltInRecipe(recipe)&&<button type="button" className="journal-update" disabled={!session||busy||hasMethodChanges||!lines.length} title={hasMethodChanges?t('journalMethodSaveFirst'):undefined} onPointerDown={()=>{mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false}} onClick={async()=>{if(await prepareDestination())setUpdateConfirm(true)}}>{t("journalUpdateRecipe")}</button>}</div><button type="button" className="primary" disabled={!session||busy||hasMethodChanges||!lines.length} title={hasMethodChanges?t('journalMethodSaveFirst'):undefined} onPointerDown={()=>{mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false}} onClick={()=>void beginMeal()} data-confirm-preparation={onReturnMeal?true:undefined}>{!onReturnMeal&&<Plus size={14} aria-hidden="true"/>}{t(onReturnMeal?'journalConfirmPreparation':'journalAddMeal')}</button>{!onReturnMeal&&<button type="button" className="secondary journal-add-storage" disabled={!session||busy||hasMethodChanges||!lines.length} title={hasMethodChanges?t('journalMethodSaveFirst'):undefined} onPointerDown={()=>{mealIntent.current=true}} onPointerCancel={()=>{mealIntent.current=false}} onClick={()=>void beginBatch()}><Plus size={14} aria-hidden="true"/>{t('journalAddStorage')}</button>}</div>
 </Modal>{picking==='pantry'&&<IngredientPicker items={pantry} close={closePicker} onChooseStoredFood={()=>setPicking('batch')} onSelect={item=>chooseFood(userChoice(item))} onSelectBuiltIn={item=>chooseFood({kind:'built-in',item})}/>}{picking==='batch'&&<StoredFoodPicker close={closePicker} onSelect={batch=>void chooseLine(storedRecipeLine(batch))}/>}{removing&&<Modal title={t('journalRemoveTitle',{name:removing.name})} close={()=>{if(!busy)setRemoving(undefined)}} className="goal-editor-modal journal-remove-confirm"><div className="modal-scroll"><p>{t('journalRemoveHelp')}</p></div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setRemoving(undefined)}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={async()=>{const current=currentSession.current;if(current&&await commit(removeCookingIngredient(current,removing.id)))setRemoving(undefined)}}>{t('journalRemove')}</button></div></Modal>}{updateConfirm&&<Modal title={t("journalUpdateRecipe")} close={()=>{if(!busy)setUpdateConfirm(false)}} className="goal-editor-modal journal-update-confirm"><div className="modal-scroll"><p>{t("journalUpdateRecipeConfirm")}</p>{error&&<p role="alert">{error}</p>}</div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setUpdateConfirm(false)}>{t("cancel")}</button><button type="button" className="primary" disabled={busy} onClick={()=>void updateRecipe()}>{t("journalUpdateRecipe")}</button></div></Modal>}{resetConfirm&&<Modal title={t('journalResetPreparation')} close={()=>{if(!busy)setResetConfirm(false)}} className="goal-editor-modal journal-reset-confirm"><div className="modal-scroll"><p>{t('journalResetPreparationConfirm')}</p></div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setResetConfirm(false)}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void resetPreparation(true)}>{t('journalResetPreparation')}</button></div></Modal>}{mealDraft&&<AddFood draft={mealDraft} recipes={recipes} pantry={pantry} close={cancelMeal} notice={notice}/>}{batchServings!==undefined&&<MakeBatchModal recipes={recipes} pantry={pantry} initialRecipe={batchRecipe??recipe} initialServings={batchServings} close={cancelBatch} notice={notice} onCommitted={()=>{void finishPreparation(close,'batch')}}/>}</>;
}
