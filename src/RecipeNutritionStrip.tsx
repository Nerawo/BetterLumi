import {useTranslation} from 'react-i18next';
import {nutrientKeys,type Nutrition} from './domain';
import {recipeNutritionDisplay} from './recipe-nutrition-display';

/** Recipe-specific formatting reuses the existing nutrition grid and typography. */
export function RecipeNutritionStrip({value}:{value:Nutrition}){
 const {t}=useTranslation();
 return <div className="nutrition-strip recipe-nutrition-strip">{nutrientKeys.map(key=><div key={key}>
  <span>{t(key==='calories'?'energy':key)}</span>
  <strong className="recipe-nutrition-value">{value[key]===null?<span className="nutrition-missing">{t('notRecorded')}</span>:<>{recipeNutritionDisplay(value[key])}<small> {key==='calories'?'kcal':'g'}</small></>}</strong>
 </div>)}</div>;
}
