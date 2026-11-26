import {useTranslation} from 'react-i18next';
import {nutrientKeys,type Nutrition} from './domain';
import {recipeNutritionDisplay} from './recipe-nutrition-display';
import {formatNutritionRange,type NutritionRange} from './recipe-nutrition-range';

/** Recipe-specific formatting reuses the existing nutrition grid and typography. */
export function RecipeNutritionStrip({value,unavailable=false}:{value:Nutrition|NutritionRange;unavailable?:boolean}){
 const {t}=useTranslation();
 const range=unavailable||nutrientKeys.some(key=>{const n=value[key];return n!==null&&typeof n!=='number'&&n[0]!==n[1]});
 return <div className={'nutrition-strip recipe-nutrition-strip'+(range?' nutrition-range':'')}>{nutrientKeys.map(key=>{const n=value[key];return <div key={key}>
  <span>{t(key==='calories'?'energy':key)}</span>
  <strong className="recipe-nutrition-value">{n===null?<span className="nutrition-missing">{t(unavailable?'familyNutritionUnavailable':'notRecorded')}</span>:<>{typeof n==='number'?recipeNutritionDisplay(n):formatNutritionRange(n)}<small> {key==='calories'?'kcal':'g'}</small></>}</strong>
 </div>})}</div>;
}
