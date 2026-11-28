import {stockViews,stockView,liveStockLines} from './stock-view';
import {livePreparation,needsUnitReview} from './live-nutrition';
import {concreteRecipe,concreteLines} from './families';
import {useIngredientPreferences} from './useIngredientPreferences';
import {ingredientNutrition,ingredientNutritionFactor} from './domain';
import {JournalHeading} from './JournalHeading';
import {JournalTextField} from './JournalTextField';
import {IngredientAmount} from './IngredientJournalFields';
import {MealBasics,MealChoice,MealPhoto} from './MealJournal';
import {lineNutrition} from './line-nutrition';
import {RecipeSelection} from './RecipePicker';
import {recipeServingLines,recipeYield} from './recipe-nutrition';
import {StoredRecipeSources} from './StoredFoodPicker';
import {StorageConsumptionControl} from './StorageConsumptionControl';
import {initialConsumptionAmount,consumptionMemoryKey,newConsumptionGrams} from './storage-consumption-ui';
import {StickyNotes,useStickyNotes,useStickyNoteChanges} from './StickyNotes';
import {commitStickyNoteChanges,StickyNoteConflict} from './sticky-notes';
import {recipeNotes} from './goals';
import {householdUnitLabel} from './household-units';
import {useEffect, useRef, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {ChevronDown,Plus} from 'lucide-react';
import {db, stamp, localDate, round, scaleNutrition, sumNutrition, unknownNutrition, type FoodLog, type PantryItem, recipes as recipeTable, type Recipe, type RecipeLine} from './domain';
import {FoodStorage, stockMealNutrition, batchRemainingNutrition, batchInventoryProgress, canCancelBatch, canRepartition, recipeBatchInputs} from './food-storage';
import {originalBatchPercentage,percentageFraction,FoodStorageError, type FoodBatch} from './food-storage-model';
import {RecipeLineEditor} from './RecipeLineEditor';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import {NumberInput} from './NumberInput';
import {DateInput} from './DateInput';
import {formatLocalDate} from './dates';
import {Modal, changed, type Notice} from './ui';
import './food-storage-locale';
import './food-storage.css';

const storage=new FoodStorage();
export function storageErrorMessage(error:unknown,t:TFunction){
 if(error instanceof FoodStorageError)return t(error.code==='UNIT_REVIEW'?'liveUnitReview':error.code==='OVERDRAW'?'storageOverdraw':error.code==='ARCHIVED'?'storageArchivedError':error.code==='CONFLICT'||error.code==='LOCKED'?'storageConflict':error.code==='NOT_FOUND'?'storageSourceMissing':'storageInvalid');
 return t('failedMessage');
}
export function useStorageOperation(){
 const request=useRef<{signature:string;id:string}|null>(null);
 return (value:unknown)=>{const signature=JSON.stringify(value);if(request.current?.signature!==signature)request.current={signature,id:stamp().id};return request.current.id};
}
const modeLabels={weight:'batchWeightMode',servings:'batchServingsMode',ratio:'batchWholeMode'} as const;
function batchQuantity(b:FoodBatch,servingUnit:string){return b.mode==='weight'?round(b.remainingQuantity)+' g':b.mode==='servings'?round(b.remainingQuantity)+' '+servingUnit:round(b.remainingQuantity*100)+'%'}
export function StorageMealForm({initial,defaultBatchId='',date,hidden=false,onSaved,onCommitted,close,notice}:{initial?:FoodLog;defaultBatchId?:string;date:string;hidden?:boolean;onSaved?:()=>Promise<void>;onCommitted?:(date:string)=>void;close:()=>void;notice:Notice}){
 const {t}=useTranslation(),operation=useStorageOperation();const [identity]=useState(stamp);
 const sharedNotes=useStickyNotes('',initial?.id??identity.id),noteDraft=useStickyNoteChanges();
 const batches=useLiveQuery(()=>db.foodBatches.toArray());const [batchId,setBatchId]=useState(initial?.storageConsumption?.batchId??defaultBatchId),[amount,setAmount]=useState(''),[mealDate,setMealDate]=useState(initial?.date??date),[category,setCategory]=useState(initial?.category??'uncategorized'),[notes]=useState(initial?.cookingNote??'');
 const [photo,setPhoto]=useState(initial?.photo??''),[readingPhoto,setReadingPhoto]=useState(false);
 const [sourceReselected,setSourceReselected]=useState(false);
 const [quantityEdited,setQuantityEdited]=useState(false);
 const history=useLiveQuery(()=>storage.transactions.toArray()),memories=useLiveQuery(()=>db.settings.toArray());
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),lock=useRef(false),initialized=useRef(false);
 const batch=batches?.find(b=>b.id===batchId),own=initial?.storageConsumption?.batchId===batchId?initial.storageConsumption.originalFraction:0;
 const ofOriginal=!!batch&&originalBatchPercentage(batch,history??[]);
 const available=batch?batch.remainingQuantity+own/batch.fractionPerUnit:0;
 useEffect(()=>{if(!batch||!history||!memories||ready||initialized.current)return;initialized.current=true;setAmount(initialConsumptionAmount(batch,available,initial?.storageConsumption?.batchId===batch.id?own:undefined,history,memories.find(row=>row.key===consumptionMemoryKey(batch.id))?.value,initial?.storageConsumption?.batchId===batch.id&&initial.unit==='g'?initial.quantity:undefined,initial?.storageConsumption?{transactionId:initial.storageConsumption.transactionId,mealId:initial.id}:undefined,ofOriginal));setReady(true)},[batch,history,memories,initial,own,available,ready,ofOriginal]);
 const preserveQuantity=!!initial&&initial.storageConsumption?.batchId===batchId&&!quantityEdited&&!sourceReselected;
 const historical=initial?.storageConsumption?.batchId===batchId&&!sourceReselected?initial:undefined;
 const liveItemId=historical?undefined:batch?.stock?.ingredientId;
 const perGram=useLiveQuery(async()=>{if(!liveItemId)return;const item=await db.ingredients.get(liveItemId);return item&&!item.deletedAt?ingredientNutrition(item,1,'g'):unknownNutrition()},[liveItemId]);
 const rawQuantity=Number(amount),quantity=batch?.mode==='weight'&&!preserveQuantity&&rawQuantity>=0&&rawQuantity<=available?newConsumptionGrams(rawQuantity,available):rawQuantity,fraction=batch&&Number.isFinite(quantity)&&quantity>=0?(batch.mode==='ratio'?percentageFraction(quantity,available*batch.fractionPerUnit,ofOriginal):quantity*batch.fractionPerUnit):NaN;
 const preview=preserveQuantity?initial!.nutrition:batch&&Number.isFinite(fraction)?stockMealNutrition(batch,quantity,fraction,historical,liveItemId?(perGram??unknownNutrition()):undefined):unknownNutrition();
 const choices=(batches??[]).filter(b=>!b.deletedAt&&(!b.archived&&b.remainingQuantity>0||b.id===initial?.storageConsumption?.batchId));
 return <form hidden={hidden} className="storage-meal-form" onSubmit={async e=>{
  e.preventDefault();if(lock.current)return;if(!batch||!preserveQuantity&&(amount===''||!Number.isFinite(quantity)||quantity<=0)){setError(t(batch?.mode==='ratio'?'storageZero':'storageInvalid'));return}
  lock.current=true;setBusy(true);setError('');
  try{const input={mealId:initial?.id??identity.id,batchId,portion:{unit:batch.mode==='weight'?'g' as const:batch.mode==='servings'?'serving' as const:'percent' as const,quantity},date:mealDate,category,notes,expectedRevision:initial?.revision};await db.transaction('rw',[db.ingredients,db.foodBatches,db.inventoryTransactions,storage.meals,db.settings,db.table('plans'),recipeNotes,db.table('recipeCards')],async()=>{if(preserveQuantity){const current=await storage.meals.get(input.mealId);if(!current||current.deletedAt||current.revision!==initial!.revision)throw new FoodStorageError('CONFLICT','Meal changed');if(current.date!==mealDate||current.category!==category||current.cookingNote!==notes)await storage.meals.put({...changed(current),date:mealDate,category,cookingNote:notes});}else await storage.saveMeal({...input,operationId:operation([input,sourceReselected])},sourceReselected);const saved=await storage.meals.get(input.mealId);if(!saved)throw Error('Meal was not saved');if((saved.photo??'')!==photo)await storage.meals.put({...changed(saved),photo});if(!initial&&batch.mode==='weight')await db.settings.put({key:consumptionMemoryKey(batch.id),value:JSON.stringify({version:1,grams:quantity})});await commitStickyNoteChanges(noteDraft.changes,saved);await onSaved?.()});close();notice(t('savedMessage'));onCommitted?.(mealDate)}catch(error){setError(error instanceof StickyNoteConflict?t("noteConflict"):storageErrorMessage(error,t))}finally{lock.current=false;setBusy(false)}
 }}>
  <div className="add-food-scroll modal-scroll"><fieldset disabled={busy} className="storage-fields">
   <MealBasics category={category} onCategory={setCategory} date={<DateInput value={mealDate} onChange={e=>setMealDate(e.target.value)} required/>}/>
   <div className="meal-basic-row meal-batch-select"><MealChoice name="batch" accessibleLabel={t('storageSelectBatch')} value={batchId} label={batch?.name??t('storageSelectBatch')} fixed={!choices.length} options={[{value:'',label:t('storageSelectBatch')},...choices.map(b=>({value:b.id,label:b.name+' · '+batchQuantity(b,t('batchServingUnit'))}))]} change={id=>{setSourceReselected(true);setBatchId(id);setQuantityEdited(true);initialized.current=false;setReady(false);setAmount('');setError('')}}/></div>
   {!choices.length&&<p className="muted">{t('storageEmpty')}</p>}
   {batch&&ready&&<>{preserveQuantity&&batch.mode==='ratio'&&amount===''?<div><p>{t('batchRecordedFraction',{percent:own*100})}</p><button type="button" onClick={()=>setQuantityEdited(true)}>{t('batchAdjustConsumption')}</button></div>:<StorageConsumptionControl frozenQuantity={preserveQuantity&&batch.mode==='ratio'?own:undefined} ofOriginal={ofOriginal} batch={batch} available={available} amount={amount} edited={quantityEdited} onChange={value=>{setQuantityEdited(true);setAmount(value)}}/>}
   <div className="meal-nutrition-preview"><RecipeNutritionStrip value={preview}/></div></>}
   <section className="meal-extras"><MealPhoto photo={photo} onPhoto={setPhoto} onReading={setReadingPhoto} onError={setError}/></section>
   <StickyNotes notes={sharedNotes} meal={{id:initial?.id??identity.id,date:mealDate}} changes={noteDraft.changes} onChange={noteDraft.stage} staged/>
  </fieldset>{error&&<p role="alert" className="storage-error">{error}</p>}</div>
  <div className="form-actions add-food-footer"><button type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button className="primary" disabled={busy||readingPhoto||!batch}>{t('saveMealRecord')}</button></div>
 </form>;
}
export function FoodStorageList({recipes,pantry,notice}:{recipes:Recipe[];pantry:PantryItem[];notice:Notice}){
 const {t,i18n}=useTranslation(),[archived,setArchived]=useState(false),[selected,setSelected]=useState<string|null>(null),[making,setMaking]=useState(false);
 const batches=useLiveQuery(stockViews)??[],history=useLiveQuery(()=>storage.transactions.toArray())??[];
 const [registering,setRegistering]=useState(false),[selectedItem,setSelectedItem]=useState(''),[grams,setGrams]=useState(''),[stockError,setStockError]=useState(''),[stockId,setStockId]=useState('');
 const visible=batches.filter(b=>!b.deletedAt&&b.archived===archived).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
 return <section className="food-storage-directory">
  <div className="storage-directory-heading"><div className="segments storage-status-tabs"><button type="button" aria-pressed={!archived} className={!archived?'selected':''} onClick={()=>setArchived(false)}>{t('storageActive')}</button><button type="button" aria-pressed={archived} className={archived?'selected':''} onClick={()=>setArchived(true)}>{t('storageArchived')}</button></div><button type="button" className="primary storage-make-trigger" onClick={()=>setMaking(true)}><Plus size={16}/>{t('storageMake')}</button></div>
  <button type="button" className="text-link" onClick={()=>{setRegistering(true);setStockId(stamp().id);setSelectedItem('');setGrams('');setStockError('')}}>{t('liveStockAdd')}</button>
  {registering&&<Modal title={t('liveStockAdd')} close={()=>setRegistering(false)} className="food-storage-modal stock-register-modal"><form onSubmit={async e=>{e.preventDefault();try{await storage.registerStock({operationId:'register:'+stockId,id:stockId,ingredientId:selectedItem,grams:Number(grams),date:localDate()});setRegistering(false)}catch{setStockError(t('liveUnitReview'))}}}><div className="modal-scroll">
    <MealChoice fixed={false} name="stockIngredient" accessibleLabel={t('ingredientPickerTitle')} value={selectedItem} label={pantry.find(i=>i.id===selectedItem)?.name??t('ingredientPickerTitle')} options={pantry.filter(i=>ingredientNutritionFactor(i,1,'g')!==null).map(i=>({value:i.id,label:i.name}))} change={setSelectedItem}/>
    <label>{t('quantity')} (g)<NumberInput required type="number" min="0" step="any" value={grams} onChange={e=>setGrams(e.target.value)}/></label>{stockError&&<p role="alert">{stockError}</p>}</div>
    <div className="form-actions"><button type="button" onClick={()=>setRegistering(false)}>{t('cancel')}</button><button className="primary" disabled={!selectedItem||!(Number(grams)>0)}>{t('save')}</button></div></form></Modal>}
  <div className="storage-list">{visible.map(b=>{const ratio=batchInventoryProgress(b,history),nutrition=batchRemainingNutrition(b);return <button type="button" className="storage-list-row" key={b.id} onClick={()=>setSelected(b.id)}>
   <span className="storage-row-heading"><strong>{b.name}</strong><span>{batchQuantity(b,t('batchServingUnit'))}</span></span><span className="storage-footnote">{t('storageCreated',{date:formatLocalDate(b.createdAt.slice(0,10),i18n.language)})}</span>
   <progress aria-label={t('storageProgress')+' '+b.name} value={Math.min(1,Math.max(0,ratio))} max="1"/><span className="storage-footnote storage-row-nutrition">{round(ratio*100)}% · {round(nutrition.calories)} kcal · P {round(nutrition.protein)} · C {round(nutrition.carbs)} · F {round(nutrition.fat)} g</span>
  </button>})}</div>
  {!visible.length&&<p className="collection-empty">{t(archived?'storageNoArchive':'storageEmpty')}</p>}
  {making&&<MakeBatchModal recipes={recipes} pantry={pantry} close={()=>setMaking(false)} notice={notice}/>}
  {selected&&<BatchDetail batchId={selected} close={()=>setSelected(null)} notice={notice}/>}
 </section>;
}
export function BatchDetail({batchId,close,notice}:{batchId:string;close:()=>void;notice:Notice}){
 const {t,i18n}=useTranslation(),operation=useStorageOperation();const b=useLiveQuery(()=>storage.batches.get(batchId),[batchId]),history=useLiveQuery(()=>storage.transactions.where('batchIds').equals(batchId).toArray(),[batchId]);
 const items=useLiveQuery(()=>db.ingredients.filter(i=>!i.deletedAt).toArray())??[];const [link,setLink]=useState('');
 const [action,setAction]=useState<'repartition'|'adjust'|'convert'|'metadata'|'archive'|'restore'|'discard'|'cancel'|'meal'|'formula'|'link'|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const [amount,setAmount]=useState(''),[reason,setReason]=useState(''),[name,setName]=useState(''),[notes,setNotes]=useState('');
 if(!b)return <Modal title={t('storageTab')} close={close} className="recipe-detail-modal food-storage-modal"><div className="modal-scroll"><p>{t('storageSourceMissing')}</p></div></Modal>;
 const begin=(next:typeof action)=>{setError('');setAmount(next==='repartition'?String(b.totalServings):next==='adjust'?String(b.remainingQuantity*(b.mode==='ratio'?100:1)):'');setName(b.name);setNotes(b.notes);setReason('');setAction(next)};
 const perform=async()=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const base={batchId:b.id,expectedRevision:b.revision};
   if(action==='link')await storage.linkRemaining(b.id,link,b.revision);
   else if(action==='repartition'){const input={...base,totalServings:Number(amount)};await storage.repartition({...input,operationId:operation(input)})}
   else if(action==='adjust'){const input={...base,quantity:Number(amount)/(b.mode==='ratio'?100:1),reason};if(amount==='')throw new FoodStorageError('INVALID','Empty quantity');await storage.adjustRemaining({...input,operationId:operation({action,...input})})}
   else if(action==='convert'){const input={...base,remainingGrams:Number(amount)};await storage.convertToWeight({...input,operationId:operation({action,...input})})}
   else if(action==='metadata'){const input={...base,name,notes};await storage.updateMetadata({...input,operationId:operation({action,...input})})}
   else if(action==='cancel')await storage.cancelBatch({...base,operationId:operation({action,...base})});
   else if(action==='archive'||action==='restore'||action==='discard')await storage.setArchive({...base,action,operationId:operation({action,...base})});
   setAction(null);notice(t('storageSaved'));
  }catch(e){setError(storageErrorMessage(e,t))}finally{lock.current=false;setBusy(false)}
 };
 const canCorrect=!b.everUsed&&!b.originMealId&&!b.archived&&b.originalCookedYield!==null&&b.remainingQuantity===b.originalCookedYield;
 const status=b.archiveReason==='canceled'?'storageCanceled':b.archiveReason==='discarded'?'storageDiscarded':b.archiveReason==='manual'?'storageManual':b.archiveReason==='exhausted'?'storageExhausted':'storageActive';
 return <Modal title={b.name} close={close} className="recipe-detail-modal food-storage-modal storage-detail-modal">
  <div className="modal-scroll"><p className="storage-footnote">{t('storageCreated',{date:formatLocalDate(b.createdAt.slice(0,10),i18n.language)})} · {t('storagePrepared')}: {formatLocalDate(b.preparedOn,i18n.language)}</p>{b.stock&&<p className="storage-footnote">{t("liveStockLabel")} · {items.find(item=>item.id===b.stock!.ingredientId)?.name}</p>}{b.notes&&<p className="storage-notes">{b.notes}</p>}
   <dl className="storage-summary"><div><dt>{t(b.mode==='servings'?'batchPackedCount':b.originalCookedYield===null?'storageOriginalPortion':'storageOriginal')}</dt><dd>{b.mode==='servings'?b.totalServings+' '+t('batchServingUnit'):b.originalCookedYield===null?'100%':round(b.originalCookedYield)+' g'}</dd></div><div className="storage-remaining-emphasis"><dt>{t('storageRemaining')}</dt><dd>{batchQuantity(b,t('batchServingUnit'))}</dd></div><div><dt>{t('storageArchiveLabel')}</dt><dd>{t(status)}</dd></div></dl>
   <h3 className="storage-detail-nutrition-title">{t(b.mode==='weight'?'storagePer100':b.mode==='servings'?'batchPerServing':'storageRemainingNutrition')}</h3><RecipeNutritionStrip value={b.mode==='weight'?scaleNutrition(stockView(b,items).totalNutrition,b.fractionPerUnit*100):b.mode==='servings'?scaleNutrition(b.totalNutrition,b.fractionPerUnit):batchRemainingNutrition(b)}/>
   <div className="storage-detail-actions"><button type="button" className="primary storage-primary-action" disabled={b.archived||b.remainingQuantity<=0} onClick={()=>begin('meal')}>{t('storageRecord')}</button>{!b.stock&&b.mode==='weight'&&!b.archived&&<button onClick={()=>{setLink('');begin('link')}}>{t('liveLink')}</button>}{b.mode==='servings'&&history&&<><button type="button" disabled={!canRepartition(b,history)} onClick={()=>begin('repartition')}>{t('storageTransaction_repartition')}</button>{!canRepartition(b,history)&&<small>{t('batchRepartitionLocked')}</small>}</>}{canCorrect&&!b.stock&&<button type="button" className="secondary" onClick={()=>begin('formula')}>{t('storageCorrectFormula')}</button>}{b.archiveReason!=='canceled'&&<button type="button" className="secondary" onClick={()=>begin('adjust')}>{t('storageAdjust')}</button>}<button type="button" className="secondary storage-wide-action" onClick={()=>begin('metadata')}>{t('storageEditDetails')}</button>{b.archiveReason!=='canceled'&&b.mode==='ratio'&&b.originMealId&&b.remainingQuantity>0&&<button type="button" className="secondary storage-wide-action" onClick={()=>begin('convert')}>{t('storageConvert')}</button>}</div>
   <details className="storage-ingredient-details"><summary>{t('storageIngredientDetails')} <span>({b.ingredients.length})</span></summary><p className="storage-footnote">{t(b.everUsed?'storageLocked':'storageUnused')}</p><ul className="storage-ingredient-snapshots">{b.ingredients.map((line,index)=><li key={index}><span>{line.name}</span><span>{line.unit==='fraction'?round(line.quantity*100)+'% '+t('storageReference'):round(line.quantity)+' '+(line.unit==='g'?t('gramsUnit'):householdUnitLabel(line.ingredientId,line.unit,i18n.language))}</span><small>{round(line.nutrition.calories)} kcal · P {round(line.nutrition.protein)} · C {round(line.nutrition.carbs)} · F {round(line.nutrition.fat)} g</small></li>)}</ul></details>
   <details className="storage-history-details"><summary>{t('storageHistory')}</summary><ol className="storage-history">{[...(history??[])].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(item=><li key={item.id}><span>{t('storageTransaction_'+item.kind.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase()))}</span><time>{formatLocalDate(item.createdAt.slice(0,10),i18n.language)}</time>{item.movements.filter(m=>m.batchId===b.id).map((m,n)=><small key={n}>{round(m.before*(m.mode==='ratio'?100:1))} → {round(m.after*(m.mode==='ratio'?100:1))} {m.mode==='weight'?'g':m.mode==='servings'?t('batchServingUnit'):'%'}</small>)}{item.reason&&item.kind==='adjust'&&<small>{item.reason}</small>}</li>)}</ol></details>
   {b.archiveReason!=='canceled'&&<section className="storage-management"><h3>{t('storageManagement')}</h3><div className="storage-management-actions"><button type="button" className="secondary" disabled={b.archived&&b.remainingQuantity===0} onClick={()=>begin(b.archived?'restore':'archive')}>{t(b.archived?'storageRestore':'storageArchive')}</button><button type="button" className="secondary storage-destructive" disabled={b.remainingQuantity===0} onClick={()=>begin('discard')}>{t('storageDiscard')}</button>{history&&canCancelBatch(b,history)&&<button type="button" className="secondary storage-destructive" onClick={()=>begin('cancel')}>{t('storageCancelBatch')}</button>}</div></section>}
  </div>
  {action==='meal'&&<Modal title={t('storageRecord')} close={()=>setAction(null)} className="add-food-modal food-storage-modal meal-journal"><StorageMealForm defaultBatchId={b.id} date={localDate()} close={()=>setAction(null)} notice={notice}/></Modal>}
  {action==='formula'&&<BatchFormulaEditor batch={b} close={()=>setAction(null)} notice={notice}/>}
  {action&&action!=='meal'&&action!=='formula'&&<Modal title={t(action==='repartition'?'storageTransaction_repartition':action==='link'?'liveLink':action==='discard'?'storageConfirmDiscard':action==='cancel'?'storageConfirmCancel':action==='adjust'?'storageAdjust':action==='convert'?'storageConvert':action==='metadata'?'storageEditDetails':action==='restore'?'storageRestore':'storageArchive')} close={()=>{if(!busy)setAction(null)}} className={"recipe-editor-modal food-storage-modal storage-action-modal"+(action==="metadata"?" journal-recipe-editor batch-journal":"")}>
   <form onSubmit={e=>{e.preventDefault();void perform()}}><div className="modal-scroll"><fieldset disabled={busy} className="storage-fields">
    {action==='link'&&<><MealChoice fixed={false} name="stockIngredient" accessibleLabel={t('liveLink')} value={link} label={items.find(i=>i.id===link)?.name??t('ingredientPickerTitle')} options={items.filter(i=>ingredientNutritionFactor(i,1,'g')!==null).map(i=>({value:i.id,label:i.name}))} change={setLink}/><p>{t('liveLinkHelp')}</p></>}
    {action==='repartition'&&<label>{t('batchPackedCount')}<NumberInput required min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    {action==='adjust'&&<><label>{t('storageCurrentAmount')} ({b.mode==='weight'?'g':t(b.mode==='servings'?'batchServingUnit':'storagePercentUnit')})<NumberInput required min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{t('storageReason')}<input required value={reason} onChange={e=>setReason(e.target.value)}/></label></>}
    {action==='convert'&&<label>{t('storageMeasured')}<NumberInput required min="0.000001" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    {action==='metadata'&&<><JournalTextField name="batchName" required label={t("storageName")} value={name} onChange={setName} placeholder={t("batchAddName")}/><label>{t('storageNotes')}<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></>}
    {action==='archive'&&<p className="storage-footnote">{t('storageArchiveHelp')}</p>}
    {(action==='discard'||action==='cancel')&&<p>{t(action==='discard'?'storageDiscardHelp':'storageCancelHelp')}</p>}
   </fieldset>{error&&<p role="alert" className="storage-error">{error}</p>}</div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setAction(null)}>{t('cancel')}</button><button className="primary" disabled={busy||action==='link'&&!link}>{t(action==='discard'||action==='cancel'?'storageConfirm':'save')}</button></div></form>
  </Modal>}
 </Modal>;
}
function BatchFormulaEditor({batch,close,notice}:{batch:FoodBatch;close:()=>void;notice:Notice}){const [snapshot]=useState(()=>structuredClone(batch));const pantry=useLiveQuery(()=>db.ingredients.filter(i=>!i.deletedAt).toArray())??[];return <MakeBatchModal recipes={[]} pantry={pantry} close={close} notice={notice} correcting={snapshot}/>;}
export function MakeBatchModal({recipes,pantry,close,notice,correcting,initialRecipe,initialServings,onCommitted}:{recipes:Recipe[];pantry:PantryItem[];close:()=>void;notice:Notice;correcting?:FoodBatch;initialRecipe?:Recipe;initialServings?:number;onCommitted?:()=>void}){
 const {t,i18n}=useTranslation(),operation=useStorageOperation(),[identity]=useState(stamp);
 const [recipeId,setRecipeId]=useState(correcting?'':initialRecipe?.id??''),[name,setName]=useState(correcting?.name??initialRecipe?.name??''),[prepared,setPrepared]=useState(correcting?.preparedOn??localDate()),[notes,setNotes]=useState(correcting?.notes??''),[weight,setWeight]=useState(correcting?String(correcting.originalCookedYield):''),[storedLines,setLines]=useState<RecipeLine[]>(()=>correcting?.ingredients.filter(i=>i.source==='pantry')??(initialRecipe?recipeServingLines({...initialRecipe,lines:concreteLines(initialRecipe)},initialServings&&Number.isFinite(initialServings)&&initialServings>0?initialServings:recipeYield(initialRecipe)):[])),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const preferences=useIngredientPreferences();const rawStock=useLiveQuery(()=>!correcting&&storedLines.some(l=>l.source==="batch")?stockViews():Promise.resolve([]),[storedLines,correcting]);const lines=correcting?storedLines:liveStockLines(livePreparation(storedLines,pantry,preferences),rawStock??[]);
 const sourceInputs=recipeBatchInputs(lines);
 const correctedSource=useLiveQuery(()=>correcting?.sourceRecipeId?recipeTable.get(correcting.sourceRecipeId):undefined,[correcting?.sourceRecipeId]);
 const [editingNote,setEditingNote]=useState(false);
 const [mode,setMode]=useState<FoodBatch['mode']>('weight'),[packed,setPacked]=useState(String(initialServings??(initialRecipe?recipeYield(initialRecipe):1)));
 const [invalidWeight,setInvalidWeight]=useState(false);
 const total=sumNutrition([...lines.map(lineNutrition),...(correcting?.ingredients.filter(i=>i.source==='batch').map(lineNutrition)??[])]),grams=Number(weight);
 return <Modal title={t(correcting?'storageCorrectFormula':'storageMake')} close={close} className="recipe-editor-modal food-storage-modal storage-make-modal journal-recipe-editor batch-journal"><form className="recipe-editor-form storage-make-form" onSubmit={async e=>{
  e.preventDefault();if(lock.current)return;if(!name.trim()||mode==='weight'&&(!Number.isFinite(grams)||grams<=0)||mode==='servings'&&(!Number.isFinite(Number(packed))||Number(packed)<=0)||!lines.length&&!correcting?.ingredients.some(i=>i.source==='batch')){setError(t('storageInvalid'));return}
  if(!correcting&&needsUnitReview(lines,pantry,preferences)){setError(t('liveUnitReview'));return}lock.current=true;setBusy(true);setError('');try{const input={id:identity.id,name:name.trim(),preparedOn:prepared,notes,sourceRecipeId:recipeId||null,ingredients:sourceInputs,mode,...(mode==='weight'?{cookedYieldGrams:grams}:mode==='servings'?{totalServings:Number(packed)}:{})};if(correcting){const correction={batchId:correcting.id,expectedRevision:correcting.revision,ingredients:[...lines.map(line=>({...line,source:'pantry' as const})),...correcting.ingredients.filter(i=>i.source==='batch')],cookedYieldGrams:grams};await storage.correctFormula({...correction,operationId:operation(correction)})}else await storage.makeBatch({...input,operationId:operation(input)});close();notice(t('storageSaved'));onCommitted?.()}catch(error){setError(storageErrorMessage(error,t))}finally{lock.current=false;setBusy(false)}
 }}><div className="modal-scroll storage-make-scroll recipe-editor-scroll"><fieldset disabled={busy} className="storage-fields">
  <section className="batch-basic">{correcting?<div className="batch-readonly-name"><small>{t('source')}</small><span>{correcting.sourceRecipeId?correctedSource?.name??t('sourceMissing'):t('storageScratch')}</span></div>:<RecipeSelection recipes={recipes.filter(concreteRecipe)} label={t('source')} displayName={recipeId===initialRecipe?.id?initialRecipe.name:undefined} value={recipeId} emptyLabel={t('storageScratch')} onChange={id=>{setRecipeId(id);const r=recipes.find(r=>r.id===id);setLines(r?structuredClone(concreteLines(r)):[]);if(r)setName(r.name)}}/>}
  <div>{correcting?<div className="batch-readonly-name"><small>{t("storageName")}</small><span>{name}</span></div>:<JournalTextField name="batchName" required label={t("storageName")} value={name} onChange={setName} showPencil={false} placeholder={"＋ "+t("add")}/>}</div><label className="batch-date">{t('storagePrepared')}{correcting?<span>{formatLocalDate(prepared,i18n.language)}</span>:<DateInput required value={prepared} max={localDate()} onChange={e=>setPrepared(e.target.value)}/>}</label></section>
  <section className="batch-results"><h3><JournalHeading>{t("batchResults")}</JournalHeading></h3>
    {!correcting&&<div className="batch-mode-options" role="group" aria-label={t('batchResults')}>
      {(['weight','servings','ratio'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)}>
        <strong>{t(modeLabels[value])}</strong><small>{t(value==='weight'?'batchByGram':value==='servings'?'batchByPortion':'batchByPercent')}</small>
      </button>)}
    </div>}
    {mode==='servings'&&<div className="batch-setting"><label htmlFor="batch-packed-input">{t('batchPackedCount')}</label>
      <div className="batch-setting-value"><div className="journal-serving-stepper">
        <button type="button" aria-label="−" onClick={()=>setPacked(String(Math.max(0,Number(packed)-1)))}>−</button>
        <NumberInput id="batch-packed-input" required min="0" step="any" value={packed} onChange={e=>setPacked(e.target.value)}/>
        <button type="button" aria-label="+" onClick={()=>setPacked(String(Number(packed)+1))}>+</button>
      </div><span>{t('batchServingUnit')}</span></div>
    </div>}
    {mode==='ratio'&&<div><div className="batch-setting"><span>{t('batchFullOutput')}</span><strong>100%</strong></div><small className="batch-ratio-help">{t('batchOriginalPercentHelp')}</small></div>}
    {mode==='weight'&&<div onInput={e=>{if(e.target instanceof HTMLInputElement)setInvalidWeight(!e.target.validity.valid)}} onBlur={e=>{if(e.target instanceof HTMLInputElement)setInvalidWeight(!e.target.validity.valid)}}>
    <IngredientAmount name="cookedYieldGrams" required min={0.000001} label={t('batchTotalWeight')} value={weight===''?null:grams} onChange={value=>setWeight(value===null?'':String(value))} unit={<span>g</span>}/>
    </div>}
    <div className="storage-batch-previews"><section className="storage-batch-nutrition" aria-label={t('storageTotalNutrition')}><h4>{t('batchWhole')}</h4><RecipeNutritionStrip value={total}/></section>{mode!=='ratio'&&<section className="storage-batch-nutrition" aria-label={t(mode==='weight'?'storagePer100':'batchPerServing')}><h4>{t(mode==='weight'?'batchPer100':'batchPerServing')}</h4><RecipeNutritionStrip value={mode==='servings'?(Number(packed)>0?scaleNutrition(total,1/Number(packed)):unknownNutrition()):!invalidWeight&&Number.isFinite(grams)&&grams>0?scaleNutrition(total,100/grams):unknownNutrition()}/></section>}</div>
    {correcting
      ? notes&&<p className="batch-note-text" aria-label={t('storageNotes')}>{notes}</p>
      : editingNote
        ? <textarea autoFocus rows={2} aria-label={t('storageNotes')} value={notes} onChange={e=>setNotes(e.target.value)} onBlur={()=>setEditingNote(false)}/>
        : <button type="button" className="batch-note-action" aria-label={notes?t('storageNotes'):undefined} onClick={()=>setEditingNote(true)}>{notes||t('batchAddNote')}</button>}
  </section>
  <details className="batch-review"><summary>{t("batchIngredientsHeading")}<ChevronDown size={16} aria-hidden="true"/></summary><RecipeLineEditor batchDraft compact showSourceInfo={false} allowStored={!correcting} lines={lines} setLines={setLines} pantry={pantry}/>
  {lines.some(l=>l.source==='batch')&&<StoredRecipeSources lines={lines} setLines={setLines} percent={100}/>}
  {correcting?.ingredients.filter(line=>line.source==='batch').map((line,index)=><div className="batch-fixed-source" key={line.lineId??index}><span>{line.name}</span><span>{line.quantity} {line.unit}</span></div>)}</details>
 </fieldset>{error&&<p role="alert" className="storage-error">{error}</p>}</div><div className="form-actions recipe-editor-footer"><button type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button className="primary" disabled={busy}>{t('save')}</button></div></form></Modal>;
}
