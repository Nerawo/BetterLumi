import './ingredient-management-locale';
import './ingredient-management.css';
import {useState} from 'react';
import {Plus,MoreHorizontal} from 'lucide-react';
import type {ConsumptionUnit} from './consumption-units';
import {useTranslation} from 'react-i18next';
import {useLiveQuery} from 'dexie-react-hooks';
import {Modal,type Notice} from './ui';
import {NumberInput} from './NumberInput';
import {db,type PantryItem} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {referenceName,referenceNutritionSummary,type FoodChoice} from './reference-library';
import {baseUnit,personalUnits,saveIngredientPreference,validIngredientPreference,type IngredientPreference} from './ingredient-preferences';
import {useIngredientPreferences} from './useIngredientPreferences';
export function IngredientManagement({choice,preference,close,notice}:{choice:FoodChoice;preference?:IngredientPreference;close:()=>void;notice:Notice}){
 const {t,i18n}=useTranslation(),base=baseUnit(choice),name=choice.kind==='built-in'?referenceName(choice.item,i18n.language):choice.item.name;
 const [units,setUnits]=useState(()=>personalUnits(choice,preference).map(u=>({...u}))),[preferred,setPreferred]=useState(preference?.preferred??(choice.kind==='user'&&choice.item.basis==='serving'?'serving':base)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [editing,setEditing]=useState<number|'add'|null>(null),[draft,setDraft]=useState<ConsumptionUnit>({quantity:1,name:'',amount:NaN,unit:base});
 const proposal=()=>({version:1 as const,units:editing==='add'?[...units,draft]:typeof editing==='number'?units.map((u,n)=>n===editing?draft:u):units,preferred:typeof editing==='number'&&preferred===units[editing]?.name?draft.name:preferred,archived:false});
 const editUnit=(index:number|'add')=>{setDraft(index==='add'?{quantity:1,name:'',amount:NaN,unit:base}:{...units[index]});setEditing(index);setError('')};
 const finish=()=>{const value=proposal();if(!validIngredientPreference(choice,value)){setError(t('unitInvalid'));return}setUnits(value.units);setPreferred(value.preferred);setEditing(null);setError('')};
 const save=async(archived:boolean)=>{const value:IngredientPreference={...proposal(),archived};if(!validIngredientPreference(choice,value)){setError(t('unitInvalid'));return}setBusy(true);try{await saveIngredientPreference(choice,value);close()}catch{setError(t('failedMessage'));notice(t('failedMessage'))}finally{setBusy(false)}};
 const number=(value:number)=>value.toLocaleString(i18n.language,{maximumSignificantDigits:15,notation:Math.abs(value)>0&&(Math.abs(value)<.0001||Math.abs(value)>=1e7)?'scientific':'standard'});
 const unitChoice=(unit:string,label:string)=><button type="button" className="ingredient-unit-choice" aria-pressed={preferred===unit} onClick={()=>setPreferred(unit)}><span>{label}</span>{preferred===unit&&<small className="ingredient-unit-default">{t('unitDefaultBadge')}</small>}</button>;
 return <Modal title={name} close={close} className="pantry-editor-modal ingredient-management-modal"><form onSubmit={e=>{e.preventDefault();void save(false)}}><div className="pantry-editor-body">
 {choice.kind==='built-in'?<div className="ingredient-reference-summary"><p>{t('referenceReadOnly')}</p><p>{referenceNutritionSummary(choice.item)}</p></div>:<p className="muted text-small">{t('personalIngredient')}</p>}
 <section className="ingredient-units-section" aria-label={t('servingUnits')}><h3>{t('servingUnits')}</h3><div className="ingredient-unit-list">
 <div className="ingredient-unit-item" data-unit={base}>{unitChoice(base,base)}</div>
 {choice.kind==='user'&&choice.item.basis==='serving'&&<div className="ingredient-unit-item" data-unit="serving">{unitChoice('serving',t('servingUnit'))}</div>}
 {units.map((unit,index)=><div className="ingredient-unit-item" data-custom="true" data-unit={unit.name} key={index}>
 {unitChoice(unit.name,number(unit.quantity)+' '+unit.name+' ≈ '+number(unit.amount)+' '+unit.unit)}
 <details className="ingredient-unit-options"><summary aria-label={t('unitOptions',{unit:unit.name})}><MoreHorizontal size={17}/></summary><div><button type="button" onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');editUnit(index)}}>{t('edit')}</button><button type="button" onClick={()=>{setUnits(old=>old.filter((_,n)=>n!==index));if(preferred===unit.name)setPreferred(base);setEditing(null);setError('')}}>{t('removeServingUnit')}</button></div></details>
 </div>)}
 </div>
 {editing===null?<button type="button" className="ingredient-unit-add" onClick={()=>editUnit('add')}><Plus size={16}/>{t('addServingUnit')}</button>:<div className="ingredient-unit-editor" role="group" aria-label={t(typeof editing==='number'?'edit':'addServingUnit')}>
 <div className="ingredient-unit-equation"><label><span>{t('quantity')}</span><NumberInput name="unitQuantity" value={Number.isFinite(draft.quantity)?draft.quantity:''} min="0" step="any" onChange={e=>setDraft(old=>({...old,quantity:e.target.value===''?NaN:Number(e.target.value)}))}/></label><label><span>{t('customUnitName')}</span><input name="unitName" maxLength={40} value={draft.name} onChange={e=>setDraft(old=>({...old,name:e.target.value}))}/></label><span className="ingredient-unit-equals" aria-hidden="true">≈</span><label><span>{t('edibleAmount')}</span><NumberInput name="unitAmount" value={Number.isFinite(draft.amount)?draft.amount:''} min="0" step="any" onChange={e=>setDraft(old=>({...old,amount:e.target.value===''?NaN:Number(e.target.value)}))}/></label><span className="ingredient-unit-base">{base}</span></div>
 <div className="ingredient-unit-editor-actions"><button type="button" onClick={()=>{setEditing(null);setError('')}}>{t('cancel')}</button><button type="button" className="ingredient-unit-done" onClick={finish}>{t('unitEditorDone')}</button></div>
 </div>}
 {error&&<p role="alert" className="text-small">{error}</p>}
 </section><div className="ingredient-archive-action"><button type="button" disabled={busy} onClick={()=>{if(window.confirm(t('archiveConfirm')))void save(true)}}>{t('archiveIngredient')}</button></div>
 </div><div className="form-actions"><button type="button" onClick={close}>{t('cancel')}</button><button className="primary" disabled={busy}>{t('save')}</button></div></form></Modal>;
}

export function IngredientArchive({notice}:{notice:Notice}){
 const {t,i18n}=useTranslation(),[search,setSearch]=useState(''),preferences=useIngredientPreferences(),items=useLiveQuery(()=>db.ingredients.toArray())??[];
 const choices:FoodChoice[]=[...builtInFoods.map(item=>({kind:'built-in' as const,item})),...items.filter(i=>!i.deletedAt).map(item=>({kind:'user' as const,item:item as PantryItem}))];
 const rows=choices.filter(c=>preferences[c.item.id]?.archived).filter(c=>(c.kind==='built-in'?[c.item.nameZh,c.item.nameEn].join(' '):c.item.name).toLowerCase().includes(search.toLowerCase()));
 return <div className="modal-scroll ingredient-archive"><label>{t('archiveSearch')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>{rows.map(c=><div className="archive-row" key={c.item.id}><div><strong>{c.kind==='built-in'?referenceName(c.item,i18n.language):c.item.name}</strong><small>{t(c.kind==='built-in'?'referenceReadOnly':'personalIngredient')}</small><p>{c.kind==='built-in'?referenceNutritionSummary(c.item):[c.item.calories,'kcal'].join(' ')}</p></div><button type="button" onClick={()=>void saveIngredientPreference(c,{...preferences[c.item.id],archived:false}).catch(()=>notice(t('failedMessage')))}>{t('restoreIngredient')}</button></div>)}{!rows.length&&<p>{t('archiveEmpty')}</p>}</div>;
}
