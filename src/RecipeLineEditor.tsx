import {defaultIngredientQuantity} from './consumption-units';
import {NumberInput} from './NumberInput';
import {nutritionReference} from './db';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Plus,Trash2,ArrowLeftRight} from 'lucide-react';
import {IngredientPicker} from './IngredientPicker';
import {ingredientNutrition,scaleNutrition,unknownNutrition,type RecipeLine,type PantryItem} from './domain';

export function RecipeLineEditor({lines,setLines,pantry,compact=false}:{lines:RecipeLine[];setLines:(v:RecipeLine[])=>void;pantry:PantryItem[];compact?:boolean}){
 const {t}=useTranslation();
 const [picking,setPicking]=useState<number|'add'|null>(null);
 const choose=(item:PantryItem)=>{
  const unit=item.basis==='100g'?nutritionReference(item).unit:'serving';
  const previous=typeof picking==='number'?lines[picking]:undefined;
  const quantity=previous?.unit===unit?previous.quantity:defaultIngredientQuantity(item,unit);
  const line={ingredientId:item.id,name:item.name,quantity,unit,nutrition:ingredientNutrition(item,quantity,unit)};
  setLines(picking==='add'?[...lines,line]:lines.map((old,index)=>index===picking?line:old));setPicking(null);
 };
 return <div className={'line-editor'+(compact?' compact-lines':'')}>
  {lines.map((line,index)=>{
   const item=pantry.find(i=>i.id===line.ingredientId),custom=item?.consumptionUnit;
   return <div className="recipe-line ingredient-editor-row" key={index}>
    <div className="recipe-line-heading"><div className="grow"><strong>{line.name}</strong>{item?.brand&&item.brand.trim().toLowerCase()!==line.name.trim().toLowerCase()&&<small className="ingredient-line-brand"> {item.brand}</small>}{!item&&<small>{t('sourceMissing')}</small>}</div><div className="actions">
     <button type="button" className="ingredient-replace-toggle" aria-label={t('replaceIngredient')+' '+line.name} onClick={()=>setPicking(index)}><ArrowLeftRight size={16}/></button>
     <button type="button" aria-label={t('delete')+' '+line.name} onClick={()=>setLines(lines.filter((_,n)=>n!==index))}><Trash2 size={15}/></button>
    </div></div>
    <div className="recipe-line-amounts"><label>{t('quantity')}<NumberInput aria-label={line.name+' '+t('quantity')} type="number" required min="0" step="any" key={line.unit} value={line.quantity} onChange={event=>{
     event.currentTarget.setCustomValidity(event.target.value!==''&&Number(event.target.value)<=0?t('invalid'):'');
     const quantity=Number(event.target.value);if(!Number.isFinite(quantity)||quantity<=0)return;
     setLines(lines.map((old,n)=>n===index?{...old,quantity,nutrition:scaleNutrition(old.nutrition,quantity/old.quantity)}:old));
    }}/></label><label>{t('unit')}<select aria-label={line.name+' '+t('unit')} value={line.unit} onChange={event=>{
     const unit=event.target.value;if(unit===line.unit)return;const quantity=defaultIngredientQuantity(item,unit);
     setLines(lines.map((old,n)=>n===index?{...old,unit,quantity,nutrition:item?ingredientNutrition(item,quantity,unit):unknownNutrition()}:old));
    }}><option value="g">{t('gramsUnit')}</option><option value="mL">mL</option><option value="serving">{t('servingUnit')}</option>{custom&&<option value={custom.name}>{custom.name}</option>}{!['g','mL','serving',custom?.name].includes(line.unit)&&<option value={line.unit}>{line.unit}</option>}</select></label></div>
   </div>;
  })}
  <div className="line-add"><button type="button" className="secondary ingredient-add-trigger" onClick={()=>setPicking('add')}><Plus size={16}/>{t('ingredientPickerAdd')}</button></div>
  {picking!==null&&<IngredientPicker items={pantry} close={()=>setPicking(null)} onSelect={choose}/>}
 </div>;
}
