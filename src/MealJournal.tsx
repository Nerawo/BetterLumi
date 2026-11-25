import {useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {DraftUnitPicker,type DraftUnits} from './DraftUnitPicker';
import {readLocalImage} from './images';
import './meal-journal.css';

export function MealChoice(props:DraftUnits){
  const [open,setOpen]=useState(false);
  return <DraftUnitPicker units={props} open={open} setOpen={setOpen}/>;
}
export const mealCategories=['uncategorized','breakfast','lunch','dinner','snack'];
export function MealBasics({date,category,onCategory}:{date:ReactNode;category:string;onCategory:(value:string)=>void}){
  const {t}=useTranslation();
  const label=(c:string)=>t(c==='uncategorized'?'aiUnresolved':c);
  return <section className="meal-basics">
    <label>{t('date')}{date}</label><div className="meal-basic-row"><span>{t('mealCategory')}</span>
    <input type="hidden" name="category" value={category}/><MealChoice accessibleLabel={t('mealCategory')} name="category" value={category} label={label(category)} fixed={false} options={mealCategories.map(value=>({value,label:label(value)}))} change={onCategory}/></div></section>;
}

export function MealPhoto({photo,onPhoto,onReading,onError}:{photo:string;onPhoto:(photo:string)=>void;onReading:(busy:boolean)=>void;onError:(message:string)=>void}){
  const {t}=useTranslation();
  return <><label className="meal-photo-input">＋ {t(photo?'replacePhoto':'mealAddPhoto')}
    <input type="file" accept="image/*" onChange={async event=>{
      const file=event.currentTarget.files?.[0];if(!file)return;
      event.currentTarget.value='';
      onReading(true);
      try{onPhoto(await readLocalImage(file))}catch{onError(t('photoError'))}finally{onReading(false)}
    }}/>
  </label>{photo&&<div className="photo-field"><img src={photo} alt={t('mealPhoto')}/><button type="button" onClick={()=>onPhoto('')}>{t('removePhoto')}</button></div>}</>;
}
