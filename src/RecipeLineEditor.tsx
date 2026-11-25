import {JournalDraftQuantity} from './JournalDraftQuantity';
import {DraftIngredientRow} from './DraftIngredientRow';
import {DraftMenu} from './RecipeDraftJournal';
import {convertRecipeLine,recipeUnitFactors} from './recipe-draft-units';
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

export function RecipeLineEditor({lines,setLines:onSetLines,pantry,compact=false,mealDraft=false,batchDraft=false,additionalAction,showSourceInfo=true,allowStored=true,groups,onGroupsChange}:{lines:RecipeLine[];setLines:(v:RecipeLine[])=>void;pantry:PantryItem[];compact?:boolean;mealDraft?:boolean;batchDraft?:boolean;additionalAction?:ReactNode;showSourceInfo?:boolean;allowStored?:boolean;groups?:IngredientGroup[];onGroupsChange?:(groups:IngredientGroup[])=>void}){
 const {t,i18n}=useTranslation(),preferences=useIngredientPreferences();
 const setLines=(next:RecipeLine[])=>onSetLines(groups?identifyRecipeLines(next):next);
 const moveLine=(index:number,delta:number)=>{const peers=lines.map((l,i)=>({l,i})).filter(({l})=>l.groupId===lines[index].groupId),at=peers.findIndex(p=>p.i===index),target=peers[at+delta];if(!target)return;const next=[...lines];[next[index],next[target.i]]=[next[target.i],next[index]];setLines(next)};
 const [storedPicking,setStoredPicking]=useState<number|'add'|null>(null);
 const [picking,setPicking]=useState<number|'add'|null>(null);
 const [addGroup,setAddGroup]=useState<string>();
 const choose=(item:PantryItem)=>{
  const choice=userChoice(item),pref=preferences[item.id];
  let unit=preferredFoodUnit(choice,pref);
  if(groups && !recipeUnitFactors(choice,pref).has(unit))unit=preferredFoodUnit(choice);
  const previous=typeof picking==='number'?lines[picking]:undefined;
  const quantity=previous?.unit===unit?previous.quantity:defaultIngredientQuantity(item,unit);
  const line={lineId:previous?.lineId,groupId:previous?previous.groupId:addGroup,ingredientId:item.id,name:item.name,quantity,unit,nutrition:personalNutrition(userChoice(item),quantity,unit,preferences[item.id])};
  setLines(picking==='add'?[...lines,line]:lines.map((old,index)=>index===picking?line:old));setPicking(null);
 };
 const chooseBuiltIn=(item:BuiltInFood)=>{const choice={kind:'built-in' as const,item},unit=preferredFoodUnit(choice,preferences[item.id]),previous=typeof picking==='number'?lines[picking]:undefined,quantity=previous?.unit===unit?previous.quantity:personalQuantity(choice,unit),line={lineId:previous?.lineId,groupId:previous?previous.groupId:addGroup,ingredientId:item.id,name:referenceName(item,i18n.language),quantity,unit,nutrition:personalNutrition(choice,quantity,unit,preferences[item.id])};setLines(picking==='add'?[...lines,line]:lines.map((old,index)=>index===picking?line:old));setPicking(null)};
 const renderLine=(line:RecipeLine,index:number,grouping=false)=>{
   const item=pantry.find(i=>i.id===line.ingredientId),reference=builtInFoods.find(food=>food.id===line.ingredientId);
   const choice=item?userChoice(item):reference?{kind:'built-in' as const,item:reference}:null,units=choice?availableUnits(choice,preferences[line.ingredientId]):[];
   const preparation=reference?referencePreparation(reference,i18n.language):'';
   const stateLabel=(mealDraft||batchDraft)?preparation.split(' · ').filter((part,index)=>index===0||part.includes('%')).join(' · '):preparation;
   const amountControl=(groups||batchDraft)?<JournalDraftQuantity required={batchDraft} key={line.unit} line={line} onChange={updated=>setLines(lines.map((old,n)=>n===index?updated:old))}/>:<NumberInput aria-label={line.name+' '+t('quantity')} type="number" required min="0" step="any" key={line.unit} value={line.quantity} onChange={event=>{
     event.currentTarget.setCustomValidity(event.target.value!==''&&Number(event.target.value)<0?t('invalid'):'');
     if(event.target.value==='')return;const quantity=Number(event.target.value);if(!Number.isFinite(quantity)||quantity<0)return;
     setLines(lines.map((old,n)=>n===index?requantifyLine(old,quantity):old));
    }}/>;
   const unitLabel=(value:string)=>value==='g'?t('gramsUnit'):value==='serving'?t('servingUnit'):value==='fraction'?t('storageFractionUnit'):foodUnitLabel(choice,value,i18n.language,preferences[line.ingredientId]);
   const ingredientName=<><strong>{line.name}</strong>{item?.brand&&item.brand.trim().toLowerCase()!==line.name.trim().toLowerCase()&&<small className="ingredient-line-brand"> {item.brand}</small>}{reference&&<><small className="ingredient-line-brand"> · {referencePreparation(reference,i18n.language)}</small>{showSourceInfo&&<ReferenceSourceInfo source={reference}/>}</>}{line.source==='batch'?<small className="ingredient-line-brand"> · {t('storageTab')}</small>:!item&&!reference&&<small>{t('sourceMissing')}</small>}</>;
   if(groups||batchDraft){
     const factors=choice&&line.source!=='batch'?recipeUnitFactors(choice,preferences[line.ingredientId]):new Map<string,number>();
     const unsupported=line.source!=='batch'&&!factors.has(line.unit);
     const validOptions=Array.from(factors.keys()).filter(unit=>convertRecipeLine(line,unit,factors)!==null)
       .map(value=>({value,label:unitLabel(value)}));
     const id=line.lineId??(index+"-"+line.ingredientId);
     const replace=()=>line.source==="batch"&&batchDraft?setStoredPicking(index):setPicking(index);
     return <DraftIngredientRow mealDraft={mealDraft||batchDraft} key={id} id={id} name={line.name} onReplace={replace}
       onDelete={()=>setLines(lines.filter((_,n)=>n!==index))}
       onDrop={(groupId,before)=>{
         const rest=lines.filter(l=>l.lineId!==line.lineId);
         const at=before?rest.findIndex(l=>l.lineId===before):rest.length;
         rest.splice(at<0?rest.length:at,0,{...line,groupId});setLines(rest);
       }}>
       <div className="draft-ingredient-name"><strong>{line.name}</strong><div className="draft-source">
         {reference?<>{stateLabel}{showSourceInfo&&!mealDraft&&<> · <ReferenceSourceInfo source={reference}/></>}</>
           :line.source==='batch'?t('storageTab'):!item?t('sourceMissing'):item.brand?.trim().toLowerCase()!==line.name.trim().toLowerCase()?item.brand:null}
       </div>{unsupported&&<small className="draft-unit-warning">{t('draftUnsupportedUnit',{unit:unitLabel(line.unit)})} <button type="button" onClick={()=>setPicking(index)}>{t('replaceIngredient')}</button></small>}</div>
       <div className="recipe-line-amounts draft-amount">{amountControl}
       <span aria-hidden="true" className="journal-amount-ink"/>
       <DraftMenu directUnit={{value:line.unit,label:unitLabel(line.unit),name:line.name,fixed:validOptions.length<2,options:validOptions,change:unit=>{
         const converted=convertRecipeLine(line,unit,factors);
         if(converted)setLines(lines.map((old,n)=>n===index?converted:old));
       }}} className="journal-line-menu" label={t('journalLineActions')+' '+line.name}
         leading={<button type="button" className="ingredient-replace-toggle" onClick={replace}>{t('replaceIngredient')}</button>}
         choices={[
           ...(grouping?[{key:'group',label:t('journalMoveTo'),control:<select aria-label={line.name+' '+t('journalGroup')} value={line.groupId??''} onChange={e=>{setLines(lines.map((l,i)=>i===index?{...l,groupId:e.target.value||undefined}:l));}}><option value="">{t('journalUngrouped')}</option>{groups?.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>}]:[])
         ]}>
         <button type="button" aria-label={t('journalUp')+' '+line.name} disabled={!lines.slice(0,index).some(l=>l.groupId===line.groupId)} onClick={()=>moveLine(index,-1)}>↑ {t('journalUp')}</button><button type="button" aria-label={t('journalDown')+' '+line.name} disabled={!lines.slice(index+1).some(l=>l.groupId===line.groupId)} onClick={()=>moveLine(index,1)}>↓ {t('journalDown')}</button>
         <button type="button" className="draft-delete" aria-label={t('delete')+' '+line.name} onClick={()=>setLines(lines.filter((_,i)=>i!==index))}>{t('delete')}</button>
       </DraftMenu></div>
     </DraftIngredientRow>;
   }
   const unitValues=new Set(['g',...(!reference?['mL','serving']:[]),...units.map(u=>u.name),line.unit]);
   const options=Array.from(unitValues,value=>({value,label:unitLabel(value)}));
   const changeUnit=(unit:string)=>{
     if(unit===line.unit)return;
     const quantity=choice?personalQuantity(choice,unit):defaultIngredientQuantity(item,unit);
     setLines(lines.map((old,n)=>n===index?{...old,zeroQuantityReference:undefined,unit,quantity,nutrition:choice?personalNutrition(choice,quantity,unit,preferences[line.ingredientId]):unknownNutrition()}:old));
   };
   return <div className="recipe-line ingredient-editor-row" key={line.lineId??index}>
    <div className="recipe-line-heading"><div className="grow">{ingredientName}</div><div className="actions">
     <button type="button" className="ingredient-replace-toggle" aria-label={t('replaceIngredient')+' '+line.name} onClick={()=>line.source==='batch'?setStoredPicking(index):setPicking(index)}><ArrowLeftRight size={16}/></button>
     <button type="button" aria-label={t('delete')+' '+line.name} onClick={()=>setLines(lines.filter((_,n)=>n!==index))}><Trash2 size={15}/></button>
    </div></div>
    <div className="recipe-line-amounts"><label>{t('quantity')}{amountControl}</label><label>{t('unit')}<select disabled={line.source==='batch'} aria-label={line.name+' '+t('unit')} value={line.unit} onChange={e=>changeUnit(e.target.value)}>
     {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div>
   </div>;
 };
 const addActions=(groupId?:string)=><div className="line-add"><button type="button" className="secondary ingredient-add-trigger" onClick={()=>{setAddGroup(groupId);setPicking('add')}}><Plus size={16}/>{t('ingredientPickerAdd')}</button>{!groups&&allowStored&&<button type="button" className="secondary storage-add-source" onClick={()=>{setAddGroup(groupId);setStoredPicking('add')}}><Plus size={16}/>{t('storageAddBatch')}</button>}{additionalAction}</div>;
 const renderGroup=(groupId:string|undefined,grouping:boolean)=><>{lines.map((line,index)=>line.groupId===groupId?renderLine(line,index,grouping):null)}{addActions(groupId)}</>;
 return <div className={'line-editor'+(compact?' compact-lines':'')+(groups||batchDraft?' journal-grouped-lines':'')}>
  {groups&&onGroupsChange?<RecipeGroupsEditor groups={groups} lines={lines} onChange={(g,l)=>{onGroupsChange(g);setLines(l)}} renderGroup={renderGroup}/>:<>{batchDraft&&addActions()}{lines.map((line,index)=>renderLine(line,index))}{!batchDraft&&addActions()}</>}
  {storedPicking!==null&&<StoredFoodPicker close={()=>setStoredPicking(null)} onSelect={b=>{const previous=typeof storedPicking==='number'?lines[storedPicking]:undefined,line={...storedRecipeLine(b,previous),groupId:previous?previous.groupId:addGroup};setLines(storedPicking==='add'?[...lines,line]:lines.map((l,i)=>i===storedPicking?line:l));setStoredPicking(null)}}/>}
  {picking!==null&&<IngredientPicker onChooseStoredFood={groups&&allowStored?()=>{setStoredPicking(picking);setPicking(null)}:undefined} items={pantry} close={()=>setPicking(null)} onSelect={choose} onSelectBuiltIn={chooseBuiltIn}/>}
 </div>;
}
