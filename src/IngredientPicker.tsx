import {createPortal} from 'react-dom';
import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Search} from 'lucide-react';
import {Modal} from './ui';
import {IngredientTagNavigation,useIngredientTags} from './IngredientTags';
import {filterIngredients} from './ingredient-tags';
import {ingredientSecondaryNames} from './pantry-names';
import {nutritionReference} from './db';
import type {PantryItem} from './domain';
export function IngredientPicker({items,onSelect,close}:{items:PantryItem[];onSelect:(item:PantryItem)=>void;close:()=>void}){
 const {t}=useTranslation(),[search,setSearch]=useState(''),[tag,setTag]=useState(''),tags=useIngredientTags();
 const trigger=useRef(document.activeElement instanceof HTMLElement?document.activeElement:null);
 useEffect(()=>()=>{requestAnimationFrame(()=>{if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true})})},[]);
 const activeTag=tags.some(item=>item.id===tag)?tag:'';
 const results=filterIngredients(items,search,activeTag,tags);
 return createPortal(<Modal title={t('ingredientPickerTitle')} close={close} className="ingredient-picker-modal">
  <div className="ingredient-picker-search" onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}}><label className="search"><Search size={17}/><span className="sr-only">{t('ingredientPickerSearch')}</span><input autoFocus type="search" value={search} placeholder={t('ingredientPickerSearch')} onChange={event=>setSearch(event.target.value)}/></label></div>
  <IngredientTagNavigation items={tags} active={activeTag} onChange={setTag}/>
  <div className="ingredient-picker-results" role="list" aria-label={t('ingredientPickerResults')}>
   {results.map(item=><button type="button" className="ingredient-picker-result" key={item.id} data-ingredient-id={item.id} onClick={()=>onSelect(item)}><span className="grow"><strong>{item.name}</strong>{ingredientSecondaryNames(item).length>0&&<small>{ingredientSecondaryNames(item).join(' · ')}</small>}</span><small>{item.basis==='serving'?t('servingUnit'):`${nutritionReference(item).amount} ${nutritionReference(item).unit}`}</small></button>)}
   {!results.length&&<p className="collection-empty">{t('ingredientPickerEmpty')}</p>}
  </div>
  <div className="form-actions"><button type="button" onClick={close}>{t('cancel')}</button></div>
 </Modal>,document.body);
}
