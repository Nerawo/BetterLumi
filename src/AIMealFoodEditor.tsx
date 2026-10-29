import {householdUnitLabel} from './household-units';
import {useState,type FormEvent} from 'react';
import {Pencil,Plus,Trash2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Modal} from './ui';
import {NumberInput} from './NumberInput';
import {nutrientKeys,unknownNutrition,type Nutrition} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {builtInRecipeItems} from './data/builtInRecipes';
import {availableUnits,baseUnit,foodUnitLabel,type IngredientPreference} from './ingredient-preferences';
import {aiMealTypes} from './ai-meal-model';
import {aiMealTotals} from './ai-meal-parser';
import {canonicalAIMealUnit,editAIMealDraftNutrition,editAIMealDraftRow,recalculateAIMealDraftRow,restoreAIMealEstimate,selectAIMealDraftSource,type AIMealDraftRow} from './ai-meal-state';
import {matchAIMealFood,pantryAIMealSource,recipeAIMealSource,type AIMealCatalog,type AIMealMatch} from './ai-meal-matching';
import {newSplitComponent,splitSuggestionRows} from './ai-meal-preview';
import type {FoodChoice} from './reference-library';
export const formatAINumber=(n:number|null,language:string)=>n===null?'—':new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(n);
export function displayAIMealUnit(row:AIMealDraftRow,language:string,preferences:Record<string,IngredientPreference>):string {
 const unit=canonicalAIMealUnit(row.item.unit);if(unit==='serving')return language.startsWith('zh')?'份':'serving';
 return householdUnitLabel(row.baseline.id??'',row.item.unit,language,preferences[row.baseline.id??'']?.units??[]);
}
export const aiMealTypeKey={breakfast:'aiBreakfast',lunch:'aiLunch',dinner:'aiDinner',snack:'aiSnack'} as const;
export function AINumberField({label,value,change}:{label:string;value:number|null;change:(value:number|null)=>void}) {
 return <label>{label}<NumberInput value={value??''} min="0" step="any" onChange={e=>{if(!e.currentTarget.validity.badInput)change(e.currentTarget.value===''?null:e.currentTarget.valueAsNumber)}}/></label>;
}
function SourcePicker({row,catalog,apply,close}:{row:AIMealDraftRow;catalog:AIMealCatalog;apply:(row:AIMealDraftRow)=>void;close:()=>void}) {
 const {t,i18n}=useTranslation(),language=i18n.language.startsWith('zh')?'zh':'en';
 const [query,setQuery]=useState(row.item.name),[selected,setSelected]=useState<AIMealMatch|null>(null),[amount,setAmount]=useState<number|null>(null),[unit,setUnit]=useState(''),[error,setError]=useState('');
 const matches=matchAIMealFood(query,catalog,language).candidates;
 const choiceFor=(id:string):FoodChoice|null=>{const user=catalog.ingredients.find(i=>i.id===id);if(user)return {kind:'user',item:user};const builtin=builtInFoods.find(i=>i.id===id);return builtin?{kind:'built-in',item:builtin}:null};
 const choice=selected?.kind==='pantry'?choiceFor(selected.id):null,p=choice?catalog.preferences[choice.item.id]:undefined;
 const units=selected?.kind==='recipe'?['serving']:choice?[baseUnit(choice),...(choice.kind==='user'&&choice.item.basis==='serving'?['serving']:[]),...availableUnits(choice,p).map(u=>u.name)]:[];
 const label=(u:string)=>u==='g'?t('aiGrams'):u==='mL'?t('aiMilliliters'):u==='serving'?t('aiServing'):foodUnitLabel(choice,u,language,p);
 const pick=(candidate:AIMealMatch)=>{
  const c=candidate.kind==='pantry'?choiceFor(candidate.id):null,pref=c?catalog.preferences[c.item.id]:undefined;
  const options=candidate.kind==='recipe'?['serving']:c?[baseUnit(c),...(c.kind==='user'&&c.item.basis==='serving'?['serving']:[]),...availableUnits(c,pref).map(u=>u.name)]:[];
  const compatible=options.find(u=>canonicalAIMealUnit(u)===canonicalAIMealUnit(row.item.unit)||c&&[foodUnitLabel(c,u,'zh',pref),foodUnitLabel(c,u,'en',pref)].some(label=>canonicalAIMealUnit(label)===canonicalAIMealUnit(row.item.unit)));
  setSelected(candidate);setUnit(compatible??options[0]??'');setAmount(compatible?row.item.amount:null);setError('');
 };
 const use=()=>{try{
  if(!selected||amount===null)throw Error('Resolve amount');
  const portion={amount,unit,weightG:null};
  const r=selected.kind==='recipe'?[...catalog.recipes,...builtInRecipeItems(language)].find(r=>r.id===selected.id):null;
  const source=r?recipeAIMealSource(r,portion):choice?pantryAIMealSource(choice,portion,p):null;if(!source)throw Error('Unavailable');
  apply(selectAIMealDraftSource(row,source.baseline,source.portion,true));close();
 }catch{setError(t('aiResolvePortion'))}};
 return <section className="ai-source-picker" aria-label={t('aiChangeSource')}>
  <button type="button" disabled={!row.item.name.trim()} onClick={()=>{if(Object.keys(row.overrides).length&&!window.confirm(t('aiManualReplace')))return;const restored=restoreAIMealEstimate(row);apply(editAIMealDraftRow(restored,{name:row.item.name,date:row.item.date,mealType:row.item.mealType,notes:row.item.notes}));close()}}>{t('aiEstimate')}</button>
  <label>{t('aiSearchSources')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="ai-source-results">{matches.length?matches.slice(0,30).map(m=><button type="button" key={m.kind+m.id} aria-pressed={selected?.id===m.id&&selected.kind===m.kind} onClick={()=>pick(m)}><span>{m.name}</span><small>{t(m.kind==='pantry'?'aiPantry':'aiRecipeSource')}</small></button>):<p className="muted">{t('aiEmptyMatch')}</p>}</div>
  {selected&&<><div className="ai-fields-two"><AINumberField label={t('aiAmount')} value={amount} change={setAmount}/><label>{t('aiUnit')}<select aria-label={t('aiUnit')} value={unit} onChange={e=>{setUnit(e.target.value);setAmount(null)}}>{units.map(u=><option key={u} value={u}>{label(u)}</option>)}</select></label></div>{Object.keys(row.overrides).length>0&&<p className="ai-helper">{t('aiManualReplace')}</p>}</>}
  {error&&<p role="alert">{error}</p>}<div className="ai-source-actions"><button type="button" onClick={close}>{t('aiCancel')}</button>{selected&&<button type="button" className="primary" onClick={use}>{t(Object.keys(row.overrides).length?'aiUseReplace':'aiUseSource')}</button>}</div>
 </section>;
}
export function AIMealFoodEditor({initial,catalog,close,save,remove,component=false}:{initial:AIMealDraftRow;catalog:AIMealCatalog;close:()=>void;save:(row:AIMealDraftRow,parts?:AIMealDraftRow[])=>void;remove:()=>void;component?:boolean}) {
 const {t,i18n}=useTranslation();const [row,setRow]=useState(()=>structuredClone(initial)),[error,setError]=useState(''),[unitBuffer,setUnitBuffer]=useState<string|null>(null),[sourceOpen,setSourceOpen]=useState(false);
 const [parts,setParts]=useState(()=>component?[]:splitSuggestionRows(initial)),[splitOpen,setSplitOpen]=useState(false),[splitAccepted,setSplitAccepted]=useState(false),[child,setChild]=useState<number|null>(null),[newName,setNewName]=useState('');
 const change=(fn:(r:AIMealDraftRow)=>AIMealDraftRow)=>{try{setRow(fn(row));setError('')}catch{setError(t('aiInvalidFood'))}};
 const patch=(p:Parameters<typeof editAIMealDraftRow>[1])=>change(r=>{
  const next=editAIMealDraftRow(r,p);
  // Keep whitespace in the editing buffer; canonical draft validation trims on save.
  if(typeof p.unit==='string')next.item.unit=p.unit;
  if('notes' in p)next.item.notes=p.notes??null;
  return next;
 });
 const setUnitText=(text:string)=>{
  setUnitBuffer(text);const id=row.baseline.id,preference=id?catalog.preferences[id]:undefined;
  const user=catalog.ingredients.find(i=>i.id===id),builtin=builtInFoods.find(i=>i.id===id),choice:FoodChoice|null=user?{kind:'user',item:user}:builtin?{kind:'built-in',item:builtin}:null;
  const units=choice?[baseUnit(choice),...(choice.kind==='user'&&choice.item.basis==='serving'?['serving']:[]),...availableUnits(choice,preference).map(u=>u.name)]:[];
  const same=(a:string,b:string)=>a.normalize('NFKC').trim().toLowerCase()===b.normalize('NFKC').trim().toLowerCase();
  const labels=units.filter(u=>same(u,text)||choice&&['zh','en'].some(lang=>same(foodUnitLabel(choice,u,lang,preference),text)));
  const unit=same(text,displayAIMealUnit(row,i18n.language,catalog.preferences))?row.item.unit:labels.length===1?labels[0]:['g','mL','serving'].includes(canonicalAIMealUnit(text))?canonicalAIMealUnit(text):text;
  patch({unit});
 };
 const nutrition=(p:Partial<Nutrition>)=>change(r=>editAIMealDraftNutrition(r,p));
 const submit=(e:FormEvent)=>{e.preventDefault();if(error||!row.item.name.trim())return;try{save(row,splitAccepted?parts:undefined)}catch{setError(t('aiInvalidFood'))}};
 if(child!==null&&parts[child])return <AIMealFoodEditor key={parts[child].item.path} initial={parts[child]} catalog={catalog} component close={()=>setChild(null)} remove={()=>{setParts(parts.filter((_,i)=>i!==child));setChild(null)}} save={value=>{setParts(parts.map((p,i)=>i===child?value:p));setChild(null)}}/>;
 if(sourceOpen)return <Modal title={t('aiChangeSource')} close={()=>setSourceOpen(false)} className="goal-editor-modal ai-food-editor ai-source-dialog"><div className="ai-editor-body ai-source-body"><SourcePicker row={row} catalog={catalog} apply={value=>{setRow(value);setUnitBuffer(null);setError('')}} close={()=>setSourceOpen(false)}/></div></Modal>;
 const known=aiMealTotals(parts.map(p=>p.item));
 return <Modal title={t(component?'aiSplitEdit':'aiEdit')} close={close} className="goal-editor-modal ai-food-editor">
  <form onSubmit={submit}>
   <div className="ai-editor-body modal-scroll">
    <label>{t('aiName')}<input required value={row.item.name} maxLength={200} onChange={e=>{const name=e.target.value;setRow({...row,item:{...row.item,name}});setError('')}}/></label>
    <div className="ai-source-line"><span><small>{t('aiSource')}</small><br/>{row.baseline.kind==='ai'?t('aiEstimate'):row.baseline.name}</span><button type="button" aria-haspopup="dialog" onClick={()=>setSourceOpen(true)}>{t('aiChangeSource')}</button></div>
    <div className="ai-fields-two"><AINumberField label={t('aiAmount')} value={row.item.amount} change={amount=>patch({amount})}/><label>{t('aiUnit')}<input value={unitBuffer??displayAIMealUnit(row,i18n.language,catalog.preferences)} maxLength={80} onChange={e=>setUnitText(e.target.value)} onBlur={()=>setUnitBuffer(null)}/></label></div>
    <AINumberField label={t('aiWeight')} value={row.item.weightG} change={weightG=>patch({weightG})}/>
    {row.status==='unresolved-portion'&&<p className="ai-helper">{t('aiUnresolvedPortion')}</p>}
    <fieldset className="ai-nutrition-fields"><legend>{t('aiNutrition')}</legend>{nutrientKeys.map(key=><AINumberField key={key} label={t(({calories:'aiCalories',protein:'aiProtein',carbs:'aiCarbs',fat:'aiFat'} as const)[key])} value={row.item.nutrition[key]} change={value=>nutrition({[key]:value})}/>)}</fieldset>
    <div className="ai-fields-two"><label>{t('aiDate')}<input type="date" value={row.item.date??''} onChange={e=>patch({date:e.target.value||null})}/></label><label>{t('aiMealType')}<select aria-label={t('aiMealType')} value={row.item.mealType??''} onChange={e=>patch({mealType:e.target.value?e.target.value as typeof aiMealTypes[number]:null})}><option value="">{t('aiUnresolved')}</option>{aiMealTypes.map(type=><option key={type} value={type}>{t(aiMealTypeKey[type])}</option>)}</select></label></div>
    <label>{t('aiNotes')}<textarea aria-label={t('aiNotes')} value={row.item.notes??''} maxLength={4000} onChange={e=>patch({notes:e.target.value||null})}/></label>
    <div className="ai-inline-actions"><button type="button" onClick={()=>change(recalculateAIMealDraftRow)}>{t('aiRecalculate')}</button><button type="button" onClick={()=>{if(Object.keys(row.overrides).length&&!window.confirm(t('aiManualReplace')))return;const restored=restoreAIMealEstimate(row);setRow({...restored,...(row.splitParent?{splitParent:row.splitParent}:{})});setUnitBuffer(null);setError('')}}>{t('aiRestore')}</button></div>
    {!component&&!row.splitParent&&<details className="ai-split-editor" open={splitOpen} onToggle={e=>setSplitOpen(e.currentTarget.open)}><summary>{t('aiSplit')}</summary>
     <div className="ai-split-comparison"><span>{t('aiSplitOriginal')} · {formatAINumber(row.item.nutrition.calories,i18n.language)} kcal<small>P {formatAINumber(row.item.nutrition.protein,i18n.language)} · C {formatAINumber(row.item.nutrition.carbs,i18n.language)} · F {formatAINumber(row.item.nutrition.fat,i18n.language)} g</small></span><span>{t('aiSplitTotal')} · {formatAINumber(known.nutrition.calories,i18n.language)} kcal<small>P {formatAINumber(known.nutrition.protein,i18n.language)} · C {formatAINumber(known.nutrition.carbs,i18n.language)} · F {formatAINumber(known.nutrition.fat,i18n.language)} g</small></span></div>
     {parts.map((part,index)=><div className="ai-component" key={part.item.path}><button type="button" onClick={()=>setChild(index)} aria-label={t('aiSplitEdit')+' '+part.item.name}><span>{part.item.name}</span><span>{formatAINumber(part.item.nutrition.calories,i18n.language)} kcal</span><Pencil size={14} aria-hidden="true"/></button><button type="button" aria-label={t('aiSplitRemove')+' '+part.item.name} className="ai-component-remove" onClick={()=>setParts(parts.filter((_,i)=>i!==index))}><Trash2 size={16} aria-hidden="true"/></button></div>)}
     <label>{t('aiSplitName')}<input value={newName} onChange={e=>setNewName(e.target.value)} maxLength={200}/></label><button type="button" className="ai-component-add" disabled={!newName.trim()} onClick={()=>{const index=Math.max(-1,...parts.map(p=>Number(p.item.path.split('.').at(-1))))+1;setParts([...parts,newSplitComponent(row,{name:newName.trim(),amount:null,unit:'',weightG:null,nutrition:unknownNutrition(),estimated:true},index)]);setNewName('')}}><Plus size={15} aria-hidden="true"/>{t('aiSplitAdd')}</button>
     <label className="ai-check"><input type="checkbox" disabled={!parts.length} checked={splitAccepted&&parts.length>0} onChange={e=>setSplitAccepted(e.target.checked)}/><span>{t('aiSplitAccept')}</span></label>{splitAccepted&&<p className="ai-helper">{t('aiSplitPending')}</p>}
    </details>}
    <button className="ai-remove" type="button" onClick={remove}>{t('aiRemove')}</button>{error&&<p role="alert">{error}</p>}
   </div>
   <div className="form-actions"><button type="button" onClick={close}>{t('aiCancel')}</button><button className="primary" type="submit" disabled={!!error||!row.item.name.trim()||splitAccepted&&!parts.length}>{t('aiSave')}</button></div>
  </form>
 </Modal>;
}
