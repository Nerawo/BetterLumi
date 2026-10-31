import {MealConsumptionControl} from './MealConsumptionControl';
import {StickyNotes,useStickyNotes,useStickyNoteChanges} from './StickyNotes';
import {commitStickyNoteChanges,StickyNoteConflict} from './sticky-notes';
import {recipeNotes} from './goals';
import {householdUnitLabel} from './household-units';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {ChevronDown, Plus, Trash2} from 'lucide-react';
import {db, stamp, localDate, round, scaleNutrition, sumNutrition, unknownNutrition, type FoodLog, type PantryItem, type Recipe, type RecipeLine} from './domain';
import {FoodStorage, batchRemainingNutrition, batchInventoryProgress, canCancelBatch, copyRecipeForBatch, type BatchIngredientInput} from './food-storage';
import {FoodStorageError, type FoodBatch} from './food-storage-model';
import {RecipeLineEditor} from './RecipeLineEditor';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import {NumberInput} from './NumberInput';
import {DateInput} from './DateInput';
import {formatLocalDate} from './dates';
import {Modal, type Notice} from './ui';
import './food-storage-locale';
import './food-storage.css';

const storage=new FoodStorage();
export function storageErrorMessage(error:unknown,t:TFunction){
 if(error instanceof FoodStorageError)return t(error.code==='OVERDRAW'?'storageOverdraw':error.code==='ARCHIVED'?'storageArchivedError':error.code==='CONFLICT'||error.code==='LOCKED'?'storageConflict':error.code==='NOT_FOUND'?'storageSourceMissing':'storageInvalid');
 return t('failedMessage');
}
export function useStorageOperation(){
 const request=useRef<{signature:string;id:string}|null>(null);
 return (value:unknown)=>{const signature=JSON.stringify(value);if(request.current?.signature!==signature)request.current={signature,id:stamp().id};return request.current.id};
}
function batchQuantity(b:FoodBatch){return b.mode==='weight'?round(b.remainingQuantity)+' g':round(b.remainingQuantity*100)+'%'}
export function StorageSelect({label,value,onChange,children,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;children:ReactNode;disabled?:boolean}){
 return <label>{label}<span className="meal-selection-control"><select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}>{children}</select><ChevronDown className="meal-selection-chevron" size={16} aria-hidden="true"/></span></label>;
}
export function StorageRatioSlider({value,onChange}:{value:string;onChange:(v:string)=>void}){
 const {t}=useTranslation();return <MealConsumptionControl value={Number(value)} onChange={v=>onChange(String(v))} description={t('storagePercentBasis')}/>;
}
export function StorageMealForm({initial,defaultBatchId='',date,hidden=false,onSaved,close,notice}:{initial?:FoodLog;defaultBatchId?:string;date:string;hidden?:boolean;onSaved?:()=>Promise<void>;close:()=>void;notice:Notice}){
 const {t}=useTranslation(),operation=useStorageOperation();const [identity]=useState(stamp);
 const sharedNotes=useStickyNotes('',initial?.id??identity.id),noteDraft=useStickyNoteChanges();
 const batches=useLiveQuery(()=>storage.batches.toArray());const [batchId,setBatchId]=useState(initial?.storageConsumption?.batchId??defaultBatchId),[amount,setAmount]=useState(''),[mealDate,setMealDate]=useState(initial?.date??date),[category,setCategory]=useState(initial?.category??'uncategorized'),[notes]=useState(initial?.cookingNote??'');
 const [percent,setPercent]=useState(initial?.unit==='g'?initial.consumptionPercent??100:100);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),lock=useRef(false),initialized=useRef(false);
 const batch=batches?.find(b=>b.id===batchId),own=initial?.storageConsumption?.batchId===batchId?initial.storageConsumption.originalFraction:0;
 const available=batch?batch.remainingQuantity+own/batch.fractionPerUnit:0;
 useEffect(()=>{if(!batch||initialized.current)return;initialized.current=true;setAmount(initial?.storageConsumption?String(batch.mode==='weight'?own/batch.fractionPerUnit/(percent>0?percent/100:1):available>0?own/(available*batch.fractionPerUnit)*100:0):String(batch.mode==='weight'?Math.min(100,batch.remainingQuantity):100));setReady(true)},[batch,initial,own,available]);
 const quantity=Number(amount)*(batch?.mode==='weight'?percent/100:1),fraction=batch&&Number.isFinite(quantity)&&quantity>=0?(batch.mode==='weight'?quantity*batch.fractionPerUnit:available*batch.fractionPerUnit*quantity/100):NaN;
 const preview=batch&&Number.isFinite(fraction)?scaleNutrition(batch.totalNutrition,fraction):unknownNutrition();
 const choices=(batches??[]).filter(b=>!b.deletedAt&&(!b.archived&&b.remainingQuantity>0||b.id===initial?.storageConsumption?.batchId));
 return <form hidden={hidden} className="storage-meal-form" onSubmit={async e=>{
  e.preventDefault();if(lock.current)return;if(!batch||amount===''||!Number.isFinite(quantity)||quantity<=0){setError(t(batch?.mode==='ratio'?'storageZero':'storageInvalid'));return}
  lock.current=true;setBusy(true);setError('');
  try{const input={mealId:initial?.id??identity.id,batchId,portion:{unit:batch.mode==='weight'?'g' as const:'percent' as const,quantity},date:mealDate,category,notes,expectedRevision:initial?.revision};await db.transaction('rw',[db.foodBatches,db.inventoryTransactions,storage.meals,db.table('plans'),recipeNotes,db.table('recipeCards')],async()=>{await storage.saveMeal({...input,operationId:operation({...input,selectedAmount:amount,percent})});const saved=await storage.meals.get(input.mealId);if(!saved)throw Error('Meal was not saved');if(batch.mode==='weight'){saved.consumptionPercent=percent;saved.baseNutrition=scaleNutrition(saved.nutrition,100/percent);await storage.meals.put(saved)}await commitStickyNoteChanges(noteDraft.changes,saved);await onSaved?.()});close();notice(t('savedMessage'))}catch(error){setError(error instanceof StickyNoteConflict?t("noteConflict"):storageErrorMessage(error,t))}finally{lock.current=false;setBusy(false)}
 }}>
  <div className="add-food-scroll modal-scroll"><fieldset disabled={busy} className="storage-fields">
   <div className="form-grid meal-date-row"><label>{t('date')}<DateInput value={mealDate} onChange={e=>setMealDate(e.target.value)} required/></label><label>{t('mealCategory')}<select value={category} onChange={e=>setCategory(e.target.value)}>{['uncategorized','breakfast','lunch','dinner','snack'].map(c=><option value={c} key={c}>{t(c)}</option>)}</select></label></div>
   <StorageSelect label={t('storageSelectBatch')} value={batchId} onChange={id=>{setBatchId(id);setPercent(100);const selected=batches?.find(b=>b.id===id);setAmount(selected?String(selected.mode==='weight'?Math.min(100,selected.remainingQuantity):100):'');initialized.current=true;setReady(true);setError('')}}><option value="">{t('storageSelectBatch')}</option>{choices.map(b=><option key={b.id} value={b.id}>{b.name} · {batchQuantity(b)}</option>)}</StorageSelect>
   {!choices.length&&<p className="muted">{t('storageEmpty')}</p>}
   {batch&&ready&&<><p className="storage-footnote">{t('storageAvailable',{value:batch.mode==='weight'?round(available)+' g':round(available*100)+'%'})}</p>{batch.mode==='weight'?<label>{t('storageSelectedGrams')}<NumberInput key={batchId+'weight'} name="storageGrams" value={amount} min="0.000001" max={percent>0?available/(percent/100):undefined} step="any" required onChange={e=>setAmount(e.target.value)}/></label>:<StorageRatioSlider value={amount||'0'} onChange={setAmount}/>}
   {batch.mode==='weight'&&<MealConsumptionControl value={percent} onChange={setPercent} description={t('storageSelectedAmountBasis')}/>}
   <div className="meal-nutrition-preview"><RecipeNutritionStrip value={preview}/></div></>}
   <StickyNotes notes={sharedNotes} meal={{id:initial?.id??identity.id,date:mealDate}} changes={noteDraft.changes} onChange={noteDraft.stage} staged/>
  </fieldset>{error&&<p role="alert" className="storage-error">{error}</p>}</div>
  <div className="form-actions add-food-footer"><button type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button className="primary" disabled={busy||!batch}>{t('save')}</button></div>
 </form>;
}
export function FoodStorageList({recipes,pantry,notice}:{recipes:Recipe[];pantry:PantryItem[];notice:Notice}){
 const {t,i18n}=useTranslation(),[archived,setArchived]=useState(false),[selected,setSelected]=useState<string|null>(null),[making,setMaking]=useState(false);
 const batches=useLiveQuery(()=>storage.batches.toArray())??[],history=useLiveQuery(()=>storage.transactions.toArray())??[];
 const visible=batches.filter(b=>!b.deletedAt&&b.archived===archived).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
 return <section className="food-storage-directory">
  <div className="storage-directory-heading"><div className="segments storage-status-tabs"><button type="button" aria-pressed={!archived} className={!archived?'selected':''} onClick={()=>setArchived(false)}>{t('storageActive')}</button><button type="button" aria-pressed={archived} className={archived?'selected':''} onClick={()=>setArchived(true)}>{t('storageArchived')}</button></div><button type="button" className="primary storage-make-trigger" onClick={()=>setMaking(true)}><Plus size={16}/>{t('storageMake')}</button></div>
  <div className="storage-list">{visible.map(b=>{const ratio=batchInventoryProgress(b,history),nutrition=batchRemainingNutrition(b);return <button type="button" className="storage-list-row" key={b.id} onClick={()=>setSelected(b.id)}>
   <span className="storage-row-heading"><strong>{b.name}</strong><span>{batchQuantity(b)}</span></span><span className="storage-footnote">{t('storageCreated',{date:formatLocalDate(b.createdAt.slice(0,10),i18n.language)})}</span>
   <progress aria-label={t('storageProgress')+' '+b.name} value={Math.min(1,Math.max(0,ratio))} max="1"/><span className="storage-footnote storage-row-nutrition">{round(ratio*100)}% · {round(nutrition.calories)} kcal · P {round(nutrition.protein)} · C {round(nutrition.carbs)} · F {round(nutrition.fat)} g</span>
  </button>})}</div>
  {!visible.length&&<p className="collection-empty">{t(archived?'storageNoArchive':'storageEmpty')}</p>}
  {making&&<MakeBatchModal recipes={recipes} pantry={pantry} close={()=>setMaking(false)} notice={notice}/>}
  {selected&&<BatchDetail batchId={selected} close={()=>setSelected(null)} notice={notice}/>}
 </section>;
}
export function BatchDetail({batchId,close,notice}:{batchId:string;close:()=>void;notice:Notice}){
 const {t,i18n}=useTranslation(),operation=useStorageOperation();const b=useLiveQuery(()=>storage.batches.get(batchId),[batchId]),history=useLiveQuery(()=>storage.transactions.where('batchIds').equals(batchId).toArray(),[batchId]);
 const [action,setAction]=useState<'adjust'|'convert'|'metadata'|'archive'|'restore'|'discard'|'cancel'|'meal'|'formula'|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const [amount,setAmount]=useState(''),[reason,setReason]=useState(''),[name,setName]=useState(''),[notes,setNotes]=useState('');
 if(!b)return <Modal title={t('storageTab')} close={close} className="recipe-detail-modal food-storage-modal"><div className="modal-scroll"><p>{t('storageSourceMissing')}</p></div></Modal>;
 const begin=(next:typeof action)=>{setError('');setAmount(next==='adjust'?String(b.mode==='weight'?b.remainingQuantity:b.remainingQuantity*100):'');setName(b.name);setNotes(b.notes);setReason('');setAction(next)};
 const perform=async()=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const base={batchId:b.id,expectedRevision:b.revision};
   if(action==='adjust'){const input={...base,quantity:b.mode==='weight'?Number(amount):Number(amount)/100,reason};if(amount==='')throw new FoodStorageError('INVALID','Empty quantity');await storage.adjustRemaining({...input,operationId:operation({action,...input})})}
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
  <div className="modal-scroll"><p className="storage-footnote">{t('storageCreated',{date:formatLocalDate(b.createdAt.slice(0,10),i18n.language)})} · {t('storagePrepared')}: {formatLocalDate(b.preparedOn,i18n.language)}</p>{b.notes&&<p className="storage-notes">{b.notes}</p>}
   <dl className="storage-summary"><div><dt>{t(b.originalCookedYield===null?'storageOriginalPortion':'storageOriginal')}</dt><dd>{b.originalCookedYield===null?'100%':round(b.originalCookedYield)+' g'}</dd></div><div><dt>{t('storageRemaining')}</dt><dd>{batchQuantity(b)}</dd></div><div><dt>{t('storageArchiveLabel')}</dt><dd>{t(status)}</dd></div></dl>
   <h3>{t(b.mode==='weight'?'storagePer100':'storageRemainingNutrition')}</h3><RecipeNutritionStrip value={b.mode==='weight'?scaleNutrition(b.totalNutrition,b.fractionPerUnit*100):batchRemainingNutrition(b)}/>
   <h3>{t('storageIngredients')}</h3><p className="storage-footnote">{t(b.everUsed?'storageLocked':'storageUnused')}</p><ul className="storage-ingredient-snapshots">{b.ingredients.map((line,index)=><li key={index}><span>{line.name}</span><span>{line.unit==='fraction'?round(line.quantity*100)+'% '+t('storageReference'):round(line.quantity)+' '+(line.unit==='g'?t('gramsUnit'):householdUnitLabel(line.ingredientId,line.unit,i18n.language))}</span><small>{round(line.nutrition.calories)} kcal · P {round(line.nutrition.protein)} · C {round(line.nutrition.carbs)} · F {round(line.nutrition.fat)} g</small></li>)}</ul>
   <div className="storage-detail-actions">{canCorrect&&<button type="button" onClick={()=>begin('formula')}>{t('storageCorrectFormula')}</button>}<button type="button" className="primary" disabled={b.archived||b.remainingQuantity<=0} onClick={()=>begin('meal')}>{t('storageRecord')}</button>{b.archiveReason!=='canceled'&&<><button type="button" onClick={()=>begin('adjust')}>{t('storageAdjust')}</button>{b.mode==='ratio'&&b.remainingQuantity>0&&<button type="button" onClick={()=>begin('convert')}>{t('storageConvert')}</button>}<button type="button" disabled={b.archived&&b.remainingQuantity===0} onClick={()=>begin(b.archived?'restore':'archive')}>{t(b.archived?'storageRestore':'storageArchive')}</button><button type="button" className="text-link" disabled={b.remainingQuantity===0} onClick={()=>begin('discard')}>{t('storageDiscard')}</button>{history&&canCancelBatch(b,history)&&<button type="button" className="text-link" onClick={()=>begin('cancel')}>{t('storageCancelBatch')}</button>}</>}<button type="button" className="text-link" onClick={()=>begin('metadata')}>{t('storageEditDetails')}</button></div>
   <h3>{t('storageHistory')}</h3><ol className="storage-history">{[...(history??[])].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(item=><li key={item.id}><span>{t('storageTransaction_'+item.kind.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase()))}</span><time>{formatLocalDate(item.createdAt.slice(0,10),i18n.language)}</time>{item.movements.filter(m=>m.batchId===b.id).map((m,n)=><small key={n}>{round(m.before*(m.mode==='ratio'?100:1))} → {round(m.after*(m.mode==='ratio'?100:1))} {m.mode==='weight'?'g':'%'}</small>)}{item.reason&&item.kind==='adjust'&&<small>{item.reason}</small>}</li>)}</ol>
  </div>
  {action==='meal'&&<Modal title={t('storageRecord')} close={()=>setAction(null)} className="add-food-modal food-storage-modal"><StorageMealForm defaultBatchId={b.id} date={localDate()} close={()=>setAction(null)} notice={notice}/></Modal>}
  {action==='formula'&&<BatchFormulaEditor batch={b} close={()=>setAction(null)} notice={notice}/>}
  {action&&action!=='meal'&&action!=='formula'&&<Modal title={t(action==='discard'?'storageConfirmDiscard':action==='cancel'?'storageConfirmCancel':action==='adjust'?'storageAdjust':action==='convert'?'storageConvert':action==='metadata'?'storageEditDetails':action==='restore'?'storageRestore':'storageArchive')} close={()=>{if(!busy)setAction(null)}} className="recipe-editor-modal food-storage-modal storage-action-modal">
   <form onSubmit={e=>{e.preventDefault();void perform()}}><div className="modal-scroll"><fieldset disabled={busy} className="storage-fields">
    {action==='adjust'&&<><label>{t('storageCurrentAmount')} ({b.mode==='weight'?'g':t('storagePercentUnit')})<NumberInput required min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{t('storageReason')}<input required value={reason} onChange={e=>setReason(e.target.value)}/></label></>}
    {action==='convert'&&<label>{t('storageMeasured')}<NumberInput required min="0.000001" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    {action==='metadata'&&<><label>{t('storageName')}<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>{t('storageNotes')}<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></>}
    {(action==='discard'||action==='cancel')&&<p>{t(action==='discard'?'storageDiscardHelp':'storageCancelHelp')}</p>}
   </fieldset>{error&&<p role="alert" className="storage-error">{error}</p>}</div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setAction(null)}>{t('cancel')}</button><button className="primary" disabled={busy}>{t(action==='discard'||action==='cancel'?'storageConfirm':'save')}</button></div></form>
  </Modal>}
 </Modal>;
}
function BatchFormulaEditor({batch,close,notice}:{batch:FoodBatch;close:()=>void;notice:Notice}){const [snapshot]=useState(()=>structuredClone(batch));const pantry=useLiveQuery(()=>db.ingredients.filter(i=>!i.deletedAt).toArray())??[];return <MakeBatchModal recipes={[]} pantry={pantry} close={close} notice={notice} correcting={snapshot}/>;}
export function MakeBatchModal({recipes,pantry,close,notice,correcting}:{recipes:Recipe[];pantry:PantryItem[];close:()=>void;notice:Notice;correcting?:FoodBatch}){
 const {t}=useTranslation(),operation=useStorageOperation(),[identity]=useState(stamp);const batches=useLiveQuery(()=>storage.batches.filter(b=>!b.archived&&!b.deletedAt&&b.remainingQuantity>0).toArray())??[];
 const [recipeId,setRecipeId]=useState(''),[name,setName]=useState(correcting?.name??''),[prepared,setPrepared]=useState(correcting?.preparedOn??localDate()),[notes,setNotes]=useState(correcting?.notes??''),[weight,setWeight]=useState(correcting?String(correcting.originalCookedYield):''),[lines,setLines]=useState<RecipeLine[]>(correcting?.ingredients.filter(i=>i.source==='pantry')??[]),[sources,setSources]=useState<{key:string;batchId:string;amount:string}[]>([]),[addingSource,setAddingSource]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const sourceInputs:BatchIngredientInput[]=sources.map(s=>({source:'batch',batchId:s.batchId,portion:{unit:batches.find(b=>b.id===s.batchId)?.mode==='weight'?'g':'percent',quantity:Number(s.amount)}}));
 const sourceNutrition=sources.map(s=>{const b=batches.find(b=>b.id===s.batchId),n=Number(s.amount);return b&&Number.isFinite(n)&&n>0?scaleNutrition(b.totalNutrition,b.mode==='weight'?n*b.fractionPerUnit:b.remainingQuantity*b.fractionPerUnit*n/100):unknownNutrition()});
 const total=sumNutrition([...lines.map(l=>l.nutrition),...sourceNutrition,...(correcting?.ingredients.filter(i=>i.source==='batch').map(i=>i.nutrition)??[])]),grams=Number(weight);
 return <Modal title={t(correcting?'storageCorrectFormula':'storageMake')} close={close} className="recipe-editor-modal food-storage-modal storage-make-modal"><form className="recipe-editor-form storage-make-form" onSubmit={async e=>{
  e.preventDefault();if(lock.current)return;if(!name.trim()||!Number.isFinite(grams)||grams<=0||!lines.length&&!sources.length&&!correcting?.ingredients.some(i=>i.source==='batch')||new Set(sources.map(s=>s.batchId)).size!==sources.length||sources.some(s=>!s.batchId||s.amount===''||!Number.isFinite(Number(s.amount))||Number(s.amount)<=0)){setError(t('storageInvalid'));return}
  lock.current=true;setBusy(true);setError('');try{const input={id:identity.id,name:name.trim(),preparedOn:prepared,notes,sourceRecipeId:recipeId||null,ingredients:[...lines.map(line=>({source:'pantry' as const,line})),...sourceInputs],cookedYieldGrams:grams};if(correcting){const correction={batchId:correcting.id,expectedRevision:correcting.revision,ingredients:[...lines.map(line=>({...line,source:'pantry' as const})),...correcting.ingredients.filter(i=>i.source==='batch')],cookedYieldGrams:grams};await storage.correctFormula({...correction,operationId:operation(correction)})}else await storage.makeBatch({...input,operationId:operation(input)});close();notice(t('storageSaved'))}catch(error){setError(storageErrorMessage(error,t))}finally{lock.current=false;setBusy(false)}
 }}><div className="modal-scroll storage-make-scroll"><fieldset disabled={busy} className="storage-fields">
  {!correcting&&<StorageSelect label={t('storageRecipeCopy')} value={recipeId} onChange={id=>{setRecipeId(id);const r=recipes.find(r=>r.id===id);setLines(r?copyRecipeForBatch(r).flatMap(i=>i.source==='pantry'?[i.line]:[]):[]);if(r)setName(r.name)}}><option value="">{t('storageScratch')}</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</StorageSelect>}
  <label>{t('storageName')}<input name="batchName" disabled={!!correcting} value={name} required onChange={e=>setName(e.target.value)}/></label><label>{t('storagePrepared')}<DateInput disabled={!!correcting} required value={prepared} max={localDate()} onChange={e=>setPrepared(e.target.value)}/></label>
  <RecipeLineEditor compact lines={lines} setLines={setLines} pantry={pantry} additionalAction={correcting?undefined:<button type="button" className="secondary storage-add-source" onClick={()=>{setAddingSource(true);setSources([...sources,{key:stamp().id,batchId:'',amount:''}])}}><Plus size={16}/>{t('storageAddBatch')}</button>}/>
  {sources.map((source,index)=>{const b=batches.find(b=>b.id===source.batchId);return <div className="storage-source-row" key={source.key}><StorageSelect label={t('storageSelectBatch')} value={source.batchId} onChange={id=>{const chosen=batches.find(b=>b.id===id);setSources(sources.map((s,i)=>i===index?{...s,batchId:id,amount:chosen?String(chosen.mode==='weight'?Math.min(100,chosen.remainingQuantity):100):''}:s))}}><option value="">{t('storageSelectBatch')}</option>{batches.map(b=><option value={b.id} key={b.id} disabled={sources.some((s,i)=>i!==index&&s.batchId===b.id)}>{b.name} · {batchQuantity(b)}</option>)}</StorageSelect>{b&&<label>{t(b.mode==='weight'?'storageGrams':'storagePercent')}<NumberInput required min="0.000001" max={b.mode==='weight'?b.remainingQuantity:100} step="any" value={source.amount} onChange={e=>setSources(sources.map((s,i)=>i===index?{...s,amount:e.target.value}:s))}/></label>}<button type="button" className="icon-button" aria-label={t('delete')+' '+(b?.name??t('storageAddBatch'))} onClick={()=>setSources(sources.filter((_,i)=>i!==index))}><Trash2 size={16}/></button></div>})}
  {addingSource&&batches.length===0&&<p className="storage-footnote">{t('storageEmpty')}</p>}
  <label>{t('storageCookedWeight')}<NumberInput name="cookedYieldGrams" required min="0.000001" step="any" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
  <div className="storage-batch-previews"><section className="storage-batch-nutrition" aria-label={t('storageTotalNutrition')}><h3>{t('storageTotalNutrition')}</h3><RecipeNutritionStrip value={total}/></section><section className="storage-batch-nutrition" aria-label={t('storagePer100')}><h3>{t('storagePer100')}</h3><RecipeNutritionStrip value={Number.isFinite(grams)&&grams>0?scaleNutrition(total,100/grams):unknownNutrition()}/></section></div>
  <label>{t('storageNotes')}<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>
 </fieldset>{error&&<p role="alert" className="storage-error">{error}</p>}</div><div className="form-actions recipe-editor-footer"><button type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button className="primary" disabled={busy}>{t('save')}</button></div></form></Modal>;
}
