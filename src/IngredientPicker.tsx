import {useFamilies} from './FamilyUI';
import {commonUnits,familyMembers} from './families';
import type {IngredientFamily} from './db';
import {PantryEditor} from './Pantry';
import {useIngredientPreferences} from './useIngredientPreferences';
import {createPortal} from 'react-dom';
import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Check,Search} from 'lucide-react';
import {Modal} from './ui';
import {IngredientTagNavigation,useIngredientTags} from './IngredientTags';
import {searchFoodChoices,referenceName,referenceNutritionSummary} from './reference-library';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import type {BuiltInFood} from './data/builtInFoods';
import {ingredientSecondaryNames} from './pantry-names';
import {nutritionReference} from './db';
import type {PantryItem} from './domain';
import {pantryListNutrition} from './pantry-foods';
import {round} from './domain';
type PickerSelection =
 | {memberSelection:{excluded:ReadonlySet<string>;add:(ids:string[])=>void};onSelect?:never;onSelectBuiltIn?:never}
 | {memberSelection?:never;onSelect:(item:PantryItem)=>void;onSelectBuiltIn?:(item:BuiltInFood)=>void};
export function IngredientPicker({items,memberSelection,onSelect,onSelectBuiltIn,close,onChooseStoredFood,onFamily}:PickerSelection & {onFamily?:(family:IngredientFamily,unit:"g"|"mL")=>void;items:PantryItem[];close:()=>void;onChooseStoredFood?:()=>void}){
 const [selected,setSelected]=useState<string[]>([]);
 const [creating,setCreating]=useState(false),[message,setMessage]=useState('');
 const resultScroll=useRef(0);
 const preferences=useIngredientPreferences();
 const {t,i18n}=useTranslation(),[search,setSearch]=useState(''),[tag,setTag]=useState(''),tags=useIngredientTags();
 const trigger=useRef(document.activeElement instanceof HTMLElement?document.activeElement:null);
 useEffect(()=>()=>{requestAnimationFrame(()=>{if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true})})},[]);
 const catalog=useFamilies(items,!!onFamily);
 const activeTag=tags.some(item=>item.id===tag)?tag:'';
 const query=search.toLowerCase().trim();
 const matches=searchFoodChoices(items,search,'',tags);
 const matchIds=new Set(matches.map(choice=>choice.item.id));
 const familyNameMatches=(family:IngredientFamily)=>[family.name,family.alternateName].some(name=>name.toLowerCase().includes(query));
 const families=onFamily?catalog.families.filter(f=>{
  if(activeTag&&!catalog.familyTags[f.id]?.includes(activeTag))return false;
  return familyNameMatches(f)||!!activeTag&&familyMembers(f,catalog).some(member=>matchIds.has(member.item.id));
 }):[];
 const candidates=new Map(matches.filter(choice=>!activeTag||choice.item.tagIds?.includes(activeTag)).map(choice=>[choice.item.id,choice]));
 if(activeTag)for(const family of families){
  for(const member of familyMembers(family,catalog)){
   if(familyNameMatches(family)||matchIds.has(member.item.id))candidates.set(member.item.id,member);
  }
 }
 const results=[...candidates.values()].filter(choice=>!memberSelection?.excluded.has(choice.item.id)&&!preferences[choice.item.id]?.archived&&(choice.kind==='user'||!!memberSelection||!!onSelectBuiltIn));
 if(creating)return createPortal(<PantryEditor item={null} statusMessage={message} initialName={search.trim()} notice={setMessage} onCreated={onSelect} close={()=>setCreating(false)}/>,document.body);
 return createPortal(<Modal title={t(memberSelection?'familyAddMember':'ingredientPickerTitle')} close={close} className={'ingredient-picker-modal'+(memberSelection?' family-member-picker':'')}>
  <div className="ingredient-picker-search" onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}}><label className="search"><Search size={17}/><span className="sr-only">{t('ingredientPickerSearch')}</span><input type="search" value={search} placeholder={t('ingredientPickerSearch')} onChange={event=>setSearch(event.target.value)}/></label></div>
  {message&&<p role="alert">{message}</p>}
  {!memberSelection&&<button type="button" className="text-link ingredient-create-trigger" style={{minHeight:44,marginInline:16,textAlign:"start"}} onClick={()=>{setMessage('');setCreating(true)}}>+ {t("inlineNewIngredient")}</button>}
  {onChooseStoredFood&&<button type="button" className="text-link ingredient-stored-trigger" style={{minHeight:44,marginInline:16,textAlign:'start'}} onClick={onChooseStoredFood}>{t('storageAddBatch')}</button>}
  <IngredientTagNavigation items={tags} active={activeTag} onChange={setTag}/>
  <div className="ingredient-picker-results" ref={node=>{if(node)node.scrollTop=resultScroll.current}} onScroll={event=>{resultScroll.current=event.currentTarget.scrollTop}} role="list" aria-label={t('ingredientPickerResults')}>
   {onFamily&&families.map(f=><button type="button" className="ingredient-picker-result family-picker-option" data-family-option={f.id} key={f.id} onClick={()=>onFamily(f,commonUnits(f,catalog)[0]??'g')}><span className="grow"><strong>{f.name}</strong><small>{t('familyTitle')}</small></span></button>)}
   {results.map(choice=>{
    if(memberSelection){
     const user=choice.kind==='user'?pantryListNutrition(choice.item):undefined;
     const name=choice.kind==='user'?choice.item.name:referenceName(choice.item,i18n.language);
     const meta=choice.kind==='user'?[...ingredientSecondaryNames(choice.item),t('referenceMyFood')].join(' · '):t('referenceBuiltIn');
     const calories=user?.nutrition.calories??(choice.kind==='built-in'?choice.item.kcalPer100g:null);
     const basis=user?(user.basis.unit==='serving'?t('servingUnit'):user.basis.amount+' '+user.basis.unit):'100 g';
     const macros=(['protein','carbs','fat'] as const).flatMap(key=>{
      const n=choice.kind==='built-in'?choice.item[(key+'Per100g') as 'proteinPer100g'|'carbsPer100g'|'fatPer100g']:user?.nutrition[key];
      return n==null?[]:[t(key)+' '+round(n)+' g'];
     });
     return <button type="button" key={choice.item.id} data-member-option={choice.item.id} className="ingredient-picker-result member-option"
      aria-pressed={selected.includes(choice.item.id)} onClick={()=>setSelected(ids=>ids.includes(choice.item.id)?ids.filter(id=>id!==choice.item.id):[...ids,choice.item.id])}>
      <strong>{name}</strong><small className="member-option-energy">{calories==null?'—':Math.round(calories)} kcal / {basis}</small><span aria-hidden="true" className="member-select-mark">{selected.includes(choice.item.id)&&<Check size={12}/>}</span>
      <small>{meta}</small>{macros.length>0&&<small>{macros.join(' · ')}</small>}
     </button>;
    }
    if(choice.kind==='built-in'){const item=choice.item;return <div className="reference-picker-row" role="listitem" key={item.id} data-reference-id={item.id}><button type="button" className="ingredient-picker-result" onClick={()=>onSelectBuiltIn?.(item)}><strong>{referenceName(item,i18n.language)}</strong><small className="reference-nutrition">{referenceNutritionSummary(item)}</small></button><ReferenceSourceInfo source={item}/></div>}const item=choice.item;return <button type="button" className="ingredient-picker-result" key={item.id} data-ingredient-id={item.id} onClick={()=>onSelect(item)}><span className="grow"><strong>{item.name}</strong>{ingredientSecondaryNames(item).length>0&&<small>{ingredientSecondaryNames(item).join(' · ')}</small>}</span><small>{item.basis==='serving'?t('servingUnit'):`${nutritionReference(item).amount} ${nutritionReference(item).unit}`}</small></button>})}
   {!results.length&&!families.length&&<p className="collection-empty">{t('ingredientPickerEmpty')}</p>}
  </div>
  {memberSelection&&<div className="form-actions member-picker-footer">
   <button type="button" onClick={close}>{t('cancel')}</button>
   <button type="button" className="primary" disabled={!selected.length} onClick={()=>memberSelection.add(selected)}>{t('familyAddSelected',{total:selected.length})}</button>
  </div>}
 </Modal>,document.body);
}
