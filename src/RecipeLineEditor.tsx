import {requantifyLine} from './cooking-effective';
import {RecipeGroupsEditor} from './RecipeGroupsEditor';
import {identifyRecipeLines,type IngredientGroup} from './cooking-journal';
import './cooking-journal-locale';
import {StoredFoodPicker} from './StoredFoodPicker';
import {storedRecipeLine} from './recipe-storage';
import './food-storage-locale';
import {useIngredientPreferences} from './useIngredientPreferences';
import {availableUnits,foodUnitLabel,preferredFoodUnit,personalQuantity,personalNutrition,userChoice} from './ingredient-preferences';
import {builtInFoods,type BuiltInFood} from './data/builtInFoods';
import {referenceName,referencePreparation} from './reference-library';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import {defaultIngredientQuantity} from './consumption-units';
import {NumberInput} from './NumberInput';
import {useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Plus,Trash2,ArrowLeftRight} from 'lucide-react';
import {IngredientPicker} from './IngredientPicker';
import {unknownNutrition,type RecipeLine,type PantryItem} from './domain';

export function RecipeLineEditor({lines,setLines:onSetLines,pantry,compact=false,additionalAction,showSourceInfo=true,allowStored=true,groups,onGroupsChange}:{lines:RecipeLine[];setLines:(v:RecipeLine[])=>void;pantry:PantryItem[];compact?:boolean;additionalAction?:ReactNode;showSourceInfo?:boolean;allowStored?:boolean;groups?:IngredientGroup[];onGroupsChange?:(groups:IngredientGroup[])=>void}){
 const {t,i18n}=useTranslation(),preferences=useIngredientPreferences();
 const setLines=(next:RecipeLine[])=>onSetLines(groups?identifyRecipeLines(next):next);
 const moveLine=(index:number,delta:number)=>{const peers=lines.map((l,i)=>({l,i})).filter(({l})=>l.groupId===lines[index].groupId),at=peers.findIndex(p=>p.i===index),target=peers[at+delta];if(!target)return;const next=[...lines];[next[index],next[target.i]]=[next[target.i],next[index]];setLines(next)};
 const [storedPicking,setStoredPicking]=useState<number|'add'|null>(null);
 const [picking,setPicking]=useState<number|'add'|null>(null);
 const [addGroup,setAddGroup]=useState<string>();
 const choose=(item:PantryItem)=>{
  const unit=preferredFoodUnit(userChoice(item),preferences[item.id]);
  const previous=typeof picking==='number'?lines[picking]:undefined;
  const quantity=previous?.unit===unit?previous.quantity:defaultIngredientQuantity(item,unit);
  const line={lineId:previous?.lineId,groupId:previous?previous.groupId:addGroup,ingredientId:item.id,name:item.name,quantity,unit,nutrition:personalNutrition(userChoice(item),quantity,unit,preferences[item.id])};
  setLines(picking==='add'?[...lines,line]:lines.map((old,index)=>index===picking?line:old));setPicking(null);
 };
 const chooseBuiltIn=(item:BuiltInFood)=>{const choice={kind:'built-in' as const,item},unit=preferredFoodUnit(choice,preferences[item.id]),previous=typeof picking==='number'?lines[picking]:undefined,quantity=previous?.unit===unit?previous.quantity:personalQuantity(choice,unit),line={lineId:previous?.lineId,groupId:previous?previous.groupId:addGroup,ingredientId:item.id,name:referenceName(item,i18n.language),quantity,unit,nutrition:personalNutrition(choice,quantity,unit,preferences[item.id])};setLines(picking==='add'?[...lines,line]:lines.map((old,index)=>index===picking?line:old));setPicking(null)};
 const renderLine=(line:RecipeLine,index:number)=>{
   const item=pantry.find(i=>i.id===line.ingredientId),reference=builtInFoods.find(food=>food.id===line.ingredientId);
   const choice=item?userChoice(item):reference?{kind:'built-in' as const,item:reference}:null,units=choice?availableUnits(choice,preferences[line.ingredientId]):[];
   return <div className="recipe-line ingredient-editor-row" key={line.lineId??index}>
    <div className="recipe-line-heading"><div className="grow"><strong>{line.name}</strong>{item?.brand&&item.brand.trim().toLowerCase()!==line.name.trim().toLowerCase()&&<small className="ingredient-line-brand"> {item.brand}</small>}{reference&&<><small className="ingredient-line-brand"> · {referencePreparation(reference,i18n.language)}</small>{showSourceInfo&&<ReferenceSourceInfo source={reference}/>}</>}{line.source==='batch'?<small className="ingredient-line-brand"> · {t('storageTab')}</small>:!item&&!reference&&<small>{t('sourceMissing')}</small>}</div><div className="actions">
     <button type="button" className="ingredient-replace-toggle" aria-label={t('replaceIngredient')+' '+line.name} onClick={()=>line.source==='batch'?setStoredPicking(index):setPicking(index)}><ArrowLeftRight size={16}/></button>
     <button type="button" aria-label={t('delete')+' '+line.name} onClick={()=>setLines(lines.filter((_,n)=>n!==index))}><Trash2 size={15}/></button>
    </div></div>
    {groups&&<details className="journal-context-menu journal-line-menu"><summary aria-label={t('journalLineActions')+' '+line.name}>···</summary><div><label>{t('journalMoveTo')}<select aria-label={line.name+' '+t('journalGroup')} value={line.groupId??''} onChange={e=>{setLines(lines.map((l,i)=>i===index?{...l,groupId:e.target.value||undefined}:l));e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="">{t('journalUngrouped')}</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><button type="button" aria-label={t('journalUp')+' '+line.name} disabled={!lines.slice(0,index).some(l=>l.groupId===line.groupId)} onClick={()=>moveLine(index,-1)}>↑ {t('journalUp')}</button><button type="button" aria-label={t('journalDown')+' '+line.name} disabled={!lines.slice(index+1).some(l=>l.groupId===line.groupId)} onClick={()=>moveLine(index,1)}>↓ {t('journalDown')}</button></div></details>}
    <div className="recipe-line-amounts"><label>{t('quantity')}<NumberInput aria-label={line.name+' '+t('quantity')} type="number" required min="0" step="any" key={line.unit} value={line.quantity} onChange={event=>{
     event.currentTarget.setCustomValidity(event.target.value!==''&&Number(event.target.value)<0?t('invalid'):'');
     if(event.target.value==='')return;const quantity=Number(event.target.value);if(!Number.isFinite(quantity)||quantity<0)return;
     setLines(lines.map((old,n)=>n===index?requantifyLine(old,quantity):old));
    }}/></label><label>{t('unit')}<select disabled={line.source==='batch'} aria-label={line.name+' '+t('unit')} value={line.unit} onChange={event=>{
     const unit=event.target.value;if(unit===line.unit)return;const quantity=choice?personalQuantity(choice,unit):defaultIngredientQuantity(item,unit);
     setLines(lines.map((old,n)=>n===index?{...old,zeroQuantityReference:undefined,unit,quantity,nutrition:choice?personalNutrition(choice,quantity,unit,preferences[line.ingredientId]):unknownNutrition()}:old));
    }}><option value="g">{t('gramsUnit')}</option>{!reference&&<><option value="mL">mL</option><option value="serving">{t('servingUnit')}</option></>}{units.map(u=><option key={u.name} value={u.name}>{foodUnitLabel(choice,u.name,i18n.language,preferences[line.ingredientId])}</option>)}{!['g','mL','serving',...units.map(u=>u.name)].includes(line.unit)&&<option value={line.unit}>{line.unit==='fraction'?t('storageFractionUnit'):foodUnitLabel(choice,line.unit,i18n.language,preferences[line.ingredientId])}</option>}</select></label></div>
   </div>;
 };
 const addActions=(groupId?:string)=><div className="line-add"><button type="button" className="secondary ingredient-add-trigger" onClick={()=>{setAddGroup(groupId);setPicking('add')}}><Plus size={16}/>{t('ingredientPickerAdd')}</button>{allowStored&&<button type="button" className="secondary storage-add-source" onClick={()=>{setAddGroup(groupId);setStoredPicking('add')}}><Plus size={16}/>{t('storageAddBatch')}</button>}{additionalAction}</div>;
 const renderGroup=(groupId?:string)=><>{lines.map((line,index)=>line.groupId===groupId?renderLine(line,index):null)}{addActions(groupId)}</>;
 return <div className={'line-editor'+(compact?' compact-lines':'')+(groups?' journal-grouped-lines':'')}>
  {groups&&onGroupsChange?<RecipeGroupsEditor groups={groups} lines={lines} onChange={(g,l)=>{onGroupsChange(g);setLines(l)}} renderGroup={renderGroup}/>:<>{lines.map(renderLine)}{addActions()}</>}
  {storedPicking!==null&&<StoredFoodPicker close={()=>setStoredPicking(null)} onSelect={b=>{const previous=typeof storedPicking==='number'?lines[storedPicking]:undefined,line={...storedRecipeLine(b,previous),groupId:previous?previous.groupId:addGroup};setLines(storedPicking==='add'?[...lines,line]:lines.map((l,i)=>i===storedPicking?line:l));setStoredPicking(null)}}/>}
  {picking!==null&&<IngredientPicker items={pantry} close={()=>setPicking(null)} onSelect={choose} onSelectBuiltIn={chooseBuiltIn}/>}
 </div>;
}
