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
import {builtInFoods} from './data/builtInFoods';
import {referenceName,referencePreparation,type FoodChoice} from './reference-library';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import {defaultIngredientQuantity} from './consumption-units';
import {NumberInput} from './NumberInput';
import {useId,useRef,useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Plus,Trash2,ArrowLeftRight,ChevronDown} from 'lucide-react';
import {IngredientPicker} from './IngredientPicker';
import {automaticMember,commonUnits,familyOptions,memberName,type FamilyCatalog} from './families';
import {pantryListNutrition} from './pantry-foods';
import {unknownNutrition,type FamilyLine,type PantryItem} from './domain';
import {livePantryLine} from './live-nutrition';
import {familyUnitNeedsReview,templateLine,type EditorLine} from './family-preparation';

function FamilyOptionEnergy({option,id}:{option:FoodChoice;id:string}){
 const normalized=option.kind==='user'?pantryListNutrition(option.item):undefined;
 const basis=normalized?.basis??{amount:100,unit:'g'};
 const calories=option.kind==='built-in'?option.item.kcalPer100g:normalized?.nutrition.calories;
 const energy=basis.amount===100&&(basis.unit==='g'||basis.unit==='mL')?`${calories==null?'—':Math.round(calories)} kcal / 100 ${basis.unit}`:'—';
 return <small id={id}>{energy}</small>;
}

export function InlineFamilyChoice({line,catalog,selectedId,resolvedName,invalid,choose,repair,cooking=false}:{line:FamilyLine;catalog:FamilyCatalog&{ready:boolean};selectedId?:string;resolvedName?:string;invalid?:boolean;choose:(id:string)=>void;repair?:(unit:'g'|'mL')=>void;cooking?:boolean}){
 const {t,i18n}=useTranslation();
 const [expanded,setExpanded]=useState(false),panelId=useId();
 const trigger=useRef<HTMLButtonElement>(null);
 const options=familyOptions(line,catalog);
 const member=selectedId?options.find(option=>option.item.id===selectedId):automaticMember(line,catalog);
 const missing=invalid&&!member&&!resolvedName;
 const family=catalog.families.find(f=>f.id===line.familyId),name=family?.name??line.name;
 const familyName=cooking?<span className="journal-line-name">{name}</span>:<strong title={name}>{name}</strong>;
 if(!catalog.ready)return <>{familyName}{!cooking&&<div className="draft-source">{t('familyTitle')}</div>}</>;
 if(!options.length&&!resolvedName)return <>{familyName}<div className="draft-family-unit-review draft-unit-warning" tabIndex={-1}>
  <small>{t('draftUnsupportedUnit',{unit:line.unit==='g'?t('gramsUnit'):line.unit})}</small>
  {family&&repair&&commonUnits(family,catalog).filter(unit=>unit!==line.unit).map(unit=><button type="button" key={unit} onClick={()=>repair(unit)}>{t('familyDraftReviewUnit',{unit:unit==='g'?t('gramsUnit'):unit})}</button>)}
 </div></>;
 const disclosure=cooking?options.length>0:options.length>1||!resolvedName&&(!member||!!selectedId)&&options.length>0;
 const memberLabel=resolvedName??(member?memberName(member,i18n.language):undefined);
 const title=cooking?(memberLabel??name):name;
 const identity=cooking?<><span className="journal-line-name">{title}</span>{disclosure&&<ChevronDown size={12} aria-hidden="true"/>}</>:<><strong>{name}</strong><span className="draft-family-member-label" title={memberLabel}>
  <span>{memberLabel??t('familyDraftChoose')}</span>{disclosure&&<ChevronDown size={13} aria-hidden="true"/>}
 </span></>;
 return <>
  {disclosure?<button ref={trigger} type="button" className="draft-family-identity draft-family-trigger" onClick={()=>setExpanded(value=>!value)}
   aria-expanded={expanded} aria-controls={expanded?panelId:undefined} aria-invalid={missing||undefined} aria-describedby={missing?panelId+'-error':undefined}
   data-unresolved={!memberLabel||undefined} title={title}>{identity}</button>
   :<span className="draft-family-identity" title={title}>{identity}</span>}
  {missing&&<small className="draft-family-error" id={panelId+'-error'} role="alert">{t('familyDraftRequired')}</small>}
  {disclosure&&expanded&&<span id={panelId} role="group" aria-label={t('familyChoose',{name})} className="draft-family-options">
   {options.map((option,index)=>{
    const label=memberName(option,i18n.language),energyId=panelId+'-energy-'+index;
    return <button key={option.item.id} type="button" aria-label={label} aria-describedby={cooking?undefined:energyId} aria-pressed={member?.item.id===option.item.id} onClick={()=>{
     choose(option.item.id);
     if(!cooking){setExpanded(false);trigger.current?.focus({preventScroll:true})}
    }}><span className="draft-family-dot" aria-hidden="true"/><span className="draft-family-option-name" title={label}>{label}</span>{!cooking&&<FamilyOptionEnergy option={option} id={energyId}/>}</button>;
   })}
  </span>}
 </>;
}

export function RecipeLineEditor({lines,setLines:onSetLines,pantry,compact=false,mealDraft=false,batchDraft=false,additionalAction,showSourceInfo=true,allowStored=true,groups,onGroupsChange,familyDraft}:{lines:EditorLine[];setLines:(v:EditorLine[])=>void;pantry:PantryItem[];compact?:boolean;mealDraft?:boolean;batchDraft?:boolean;additionalAction?:ReactNode;showSourceInfo?:boolean;allowStored?:boolean;groups?:IngredientGroup[];onGroupsChange?:(groups:IngredientGroup[])=>void;familyDraft?:{catalog:FamilyCatalog&{ready:boolean};actual?:boolean;invalidLine?:string}}){
 const {t,i18n}=useTranslation(),preferences=useIngredientPreferences();
 const setLines=(next:EditorLine[])=>onSetLines(groups?identifyRecipeLines(next):next);
 const moveLine=(index:number,delta:number)=>{const peers=lines.map((l,i)=>({l,i})).filter(({l})=>l.groupId===lines[index].groupId),at=peers.findIndex(p=>p.i===index),target=peers[at+delta];if(!target)return;const next=[...lines];[next[index],next[target.i]]=[next[target.i],next[index]];setLines(next)};
 const [storedPicking,setStoredPicking]=useState<number|'add'|null>(null);
 const [picking,setPicking]=useState<number|'add'|null>(null);
 const [addGroup,setAddGroup]=useState<string>();
 const chooseFood=(choice:FoodChoice)=>{
  const pref=preferences[choice.item.id];
  const previous=typeof picking==='number'?lines[picking]:undefined;
  let unit=preferredFoodUnit(choice,pref);
  if(previous&&onGroupsChange)unit=previous.unit;
  else if(groups&&choice.kind==='user'&&!recipeUnitFactors(choice,pref).has(unit))unit=preferredFoodUnit(choice);
  const quantity=previous?.unit===unit?previous.quantity:personalQuantity(choice,unit);
  const name=choice.kind==='user'?choice.item.name:referenceName(choice.item,i18n.language);
  const line={lineId:previous?.lineId,groupId:previous?previous.groupId:addGroup,ingredientId:choice.item.id,name,quantity,unit,nutrition:personalNutrition(choice,quantity,unit,pref)};
  const replacement=previous&&onGroupsChange?livePantryLine(line,choice.kind==='user'?choice.item:undefined,pref):line;
  setLines(picking==='add'?[...lines,line]:lines.map((old,index)=>index===picking?replacement:old));
  setPicking(null);
 };
 const renderLine=(line:EditorLine,index:number,grouping=false)=>{
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
     const slot=line.draftFamilyId&&familyDraft&&!familyUnitNeedsReview(line)?templateLine(line) as FamilyLine:undefined;
     const unsupported=!slot&&line.source!=='batch'&&!factors.has(line.unit);
     const templateFamily=!!line.draftFamilyId&&!familyDraft?.actual;
     const validOptions=(templateFamily?['g','mL']:Array.from(factors.keys()).filter(unit=>(!!onGroupsChange&&unsupported)||convertRecipeLine(line,unit,factors)!==null))
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
       <div className="draft-ingredient-name">{slot&&familyDraft?.actual?<InlineFamilyChoice key={slot.familyId} line={slot} catalog={familyDraft.catalog}
        invalid={familyDraft.invalidLine===slot.lineId} selectedId={line.draftFamilyMemberId}
        choose={memberId=>setLines(lines.map((old,n)=>n===index?{...old,draftFamilyMemberId:memberId}:old))}
        repair={unit=>setLines(lines.map((old,n)=>n===index?{...old,unit,draftFamilyMemberId:undefined}:old))}/>:slot?<div className="draft-family-identity"><strong title={line.name}>{familyDraft?.catalog.families.find(f=>f.id===slot.familyId)?.name??line.name}</strong><span className="draft-family-member-label">{t('familyTitle')}</span></div>:<><strong title={line.name}>{line.name}</strong><div className="draft-source">
         {reference?<>{stateLabel}{showSourceInfo&&!mealDraft&&<> · <ReferenceSourceInfo source={reference}/></>}</>
           :line.draftFamilyId?t('familyTitle'):line.source==='batch'?t('storageTab'):!item?t('sourceMissing'):item.brand?.trim().toLowerCase()!==line.name.trim().toLowerCase()?item.brand:null}
       </div>{unsupported&&<small className="draft-unit-warning">{t('draftUnsupportedUnit',{unit:unitLabel(line.unit)})} <button type="button" onClick={()=>setPicking(index)}>{t('replaceIngredient')}</button></small>}</>}</div>
       <div className="recipe-line-amounts draft-amount">{amountControl}
       <span aria-hidden="true" className="journal-amount-ink"/>
       <DraftMenu directUnit={{value:line.unit,label:unitLabel(line.unit),name:line.name,fixed:validOptions.length===0||(validOptions.length===1&&validOptions[0].value===line.unit),options:validOptions,change:unit=>{
         if(templateFamily){setLines(lines.map((old,n)=>n===index?{...old,unit}:old));return}
         if(onGroupsChange&&unsupported){setLines(lines.map((old,n)=>n===index?livePantryLine({...old,unit},item,preferences[line.ingredientId]):old));return}
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
  {picking!==null&&<IngredientPicker onFamily={onGroupsChange?(family,unit)=>{
   const prev=typeof picking==='number'?lines[picking]:undefined;
   const line:EditorLine={draftFamilyId:family.id,ingredientId:'',lineId:prev?.lineId,groupId:prev?prev.groupId:addGroup,name:family.name,quantity:prev?.quantity??100,unit:prev?.unit??unit,nutrition:unknownNutrition()};
   setLines(picking==='add'?[...lines,line]:lines.map((l,i)=>i===picking?line:l));setPicking(null);
  }:undefined} onChooseStoredFood={groups&&allowStored?()=>{setStoredPicking(picking);setPicking(null)}:undefined} items={pantry} close={()=>setPicking(null)} onSelect={item=>chooseFood(userChoice(item))} onSelectBuiltIn={item=>chooseFood({kind:'built-in',item})}/>}
 </div>;
}
