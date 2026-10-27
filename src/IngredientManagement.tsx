import './ingredient-management-locale';
import './ingredient-management.css';
import {useState} from 'react';
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
 const save=async(archived:boolean)=>{const value:IngredientPreference={version:1,units,preferred,archived};if(!validIngredientPreference(choice,value)){setError(t('unitInvalid'));return}setBusy(true);try{await saveIngredientPreference(choice,value);close()}catch{setError(t('failedMessage'));notice(t('failedMessage'))}finally{setBusy(false)}};
 return <Modal title={name} close={close} className="pantry-editor-modal ingredient-management-modal"><form onSubmit={e=>{e.preventDefault();void save(false)}}><div className="pantry-editor-body">
 {choice.kind==='built-in'?<><p className="muted text-small">{t('referenceReadOnly')}</p><p className="text-small">{referenceNutritionSummary(choice.item)}</p></>:<p className="muted text-small">{t('personalIngredient')}</p>}
 <h3>{t('servingUnits')}</h3><p className="text-small muted">{base}</p>
 {units.map((unit,index)=><div className="personal-unit-row" key={index}><label>{t('quantity')}<NumberInput aria-label={t('quantity')+' '+(index+1)} value={Number.isFinite(unit.quantity)?unit.quantity:''} min="0" step="any" onChange={e=>setUnits(old=>old.map((u,n)=>n===index?{...u,quantity:e.target.value===''?NaN:Number(e.target.value)}:u))}/></label><label>{t('customUnitName')}<input aria-label={t('customUnitName')+' '+(index+1)} value={unit.name} maxLength={40} onChange={e=>{const value=e.target.value;setUnits(old=>old.map((u,n)=>n===index?{...u,name:value}:u));if(preferred===unit.name)setPreferred(value)}}/></label><label>{t('edibleAmount')}<NumberInput aria-label={t('edibleAmount')+' '+(index+1)} value={Number.isNaN(unit.amount)?'':unit.amount} min="0" step="any" onChange={e=>setUnits(old=>old.map((u,n)=>n===index?{...u,amount:e.target.value===''?NaN:Number(e.target.value)}:u))}/></label><span>{base}</span><button type="button" onClick={()=>{setUnits(old=>old.filter((_,n)=>n!==index));if(preferred===unit.name)setPreferred(base)}}>{t('removeServingUnit')}</button></div>)}
 <button type="button" className="text-link" onClick={()=>setUnits(old=>[...old,{quantity:1,name:'',amount:NaN,unit:base}])}>{t('addServingUnit')}</button>
 <label>{t('preferredUnit')}<select name="preferredUnit" value={preferred} onChange={e=>setPreferred(e.target.value)}><option value={base}>{base}</option>{choice.kind==='user'&&choice.item.basis==='serving'&&<option value="serving">{t('servingUnit')}</option>}{units.filter(u=>u.name.trim()).map((u,index)=><option value={u.name} key={index}>{u.name}</option>)}</select></label>
 <h3>{t('ingredientManagement')}</h3><button type="button" disabled={busy} className="text-link" onClick={()=>{if(window.confirm(t('archiveConfirm')))void save(true)}}>{t('archiveIngredient')}</button>{error&&<p role="alert">{error}</p>}
 </div><div className="form-actions"><button type="button" onClick={close}>{t('cancel')}</button><button className="primary" disabled={busy}>{t('save')}</button></div></form></Modal>;
}
export function IngredientArchive({notice}:{notice:Notice}){
 const {t,i18n}=useTranslation(),[search,setSearch]=useState(''),preferences=useIngredientPreferences(),items=useLiveQuery(()=>db.ingredients.toArray())??[];
 const choices:FoodChoice[]=[...builtInFoods.map(item=>({kind:'built-in' as const,item})),...items.filter(i=>!i.deletedAt).map(item=>({kind:'user' as const,item:item as PantryItem}))];
 const rows=choices.filter(c=>preferences[c.item.id]?.archived).filter(c=>(c.kind==='built-in'?[c.item.nameZh,c.item.nameEn].join(' '):c.item.name).toLowerCase().includes(search.toLowerCase()));
 return <div className="modal-scroll ingredient-archive"><label>{t('archiveSearch')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>{rows.map(c=><div className="archive-row" key={c.item.id}><div><strong>{c.kind==='built-in'?referenceName(c.item,i18n.language):c.item.name}</strong><small>{t(c.kind==='built-in'?'referenceReadOnly':'personalIngredient')}</small><p>{c.kind==='built-in'?referenceNutritionSummary(c.item):[c.item.calories,'kcal'].join(' ')}</p></div><button type="button" onClick={()=>void saveIngredientPreference(c,{...preferences[c.item.id],archived:false}).catch(()=>notice(t('failedMessage')))}>{t('restoreIngredient')}</button></div>)}{!rows.length&&<p>{t('archiveEmpty')}</p>}</div>;
}
