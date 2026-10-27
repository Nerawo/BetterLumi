import {useIngredientPreferences} from './useIngredientPreferences';
import {createPortal} from 'react-dom';
import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Search} from 'lucide-react';
import {Modal} from './ui';
import {IngredientTagNavigation,useIngredientTags} from './IngredientTags';
import {searchFoodChoices,referenceName,referencePreparation,referenceCategory,referenceNutritionSummary} from './reference-library';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import type {BuiltInFood} from './data/builtInFoods';
import {ingredientSecondaryNames} from './pantry-names';
import {nutritionReference} from './db';
import type {PantryItem} from './domain';
export function IngredientPicker({items,onSelect,onSelectBuiltIn,close}:{items:PantryItem[];onSelect:(item:PantryItem)=>void;onSelectBuiltIn?:(item:BuiltInFood)=>void;close:()=>void}){
 const preferences=useIngredientPreferences();
 const {t,i18n}=useTranslation(),[search,setSearch]=useState(''),[tag,setTag]=useState(''),tags=useIngredientTags();
 const trigger=useRef(document.activeElement instanceof HTMLElement?document.activeElement:null);
 useEffect(()=>()=>{requestAnimationFrame(()=>{if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true})})},[]);
 const activeTag=tags.some(item=>item.id===tag)?tag:'';
 const results=searchFoodChoices(items,search,activeTag,tags).filter(choice=>!preferences[choice.item.id]?.archived&&(choice.kind==='user'||!!onSelectBuiltIn));
 return createPortal(<Modal title={t('ingredientPickerTitle')} close={close} className="ingredient-picker-modal">
  <div className="ingredient-picker-search" onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}}><label className="search"><Search size={17}/><span className="sr-only">{t('ingredientPickerSearch')}</span><input type="search" value={search} placeholder={t('ingredientPickerSearch')} onChange={event=>setSearch(event.target.value)}/></label></div>
  <IngredientTagNavigation items={tags} active={activeTag} onChange={setTag}/>
  <div className="ingredient-picker-results" role="list" aria-label={t('ingredientPickerResults')}>
   {results.map(choice=>{if(choice.kind==='built-in'){const item=choice.item;return <div className="reference-picker-row" role="listitem" key={item.id} data-reference-id={item.id}><button type="button" className="ingredient-picker-result" onClick={()=>onSelectBuiltIn?.(item)}><strong>{referenceName(item,i18n.language)}</strong><small>{referencePreparation(item,i18n.language)} · {referenceCategory(item,i18n.language)}</small><small className="reference-nutrition">{referenceNutritionSummary(item)}</small></button><ReferenceSourceInfo source={item}/></div>}const item=choice.item;return <button type="button" className="ingredient-picker-result" key={item.id} data-ingredient-id={item.id} onClick={()=>onSelect(item)}><span className="grow"><strong>{item.name}</strong>{ingredientSecondaryNames(item).length>0&&<small>{ingredientSecondaryNames(item).join(' · ')}</small>}</span><small>{item.basis==='serving'?t('servingUnit'):`${nutritionReference(item).amount} ${nutritionReference(item).unit}`}</small></button>})}
   {!results.length&&<p className="collection-empty">{t('ingredientPickerEmpty')}</p>}
  </div>
 </Modal>,document.body);
}
