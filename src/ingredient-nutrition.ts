import type {Nutrition} from './domain';

type NutritionInput={calories?:unknown;protein?:unknown;carbs?:unknown;fat?:unknown};
const blank=(value:unknown)=>value==null||(typeof value==='string'&&value.trim()==='');
function nutrient(value:unknown):number{
 if(blank(value))return 0;
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Invalid ingredient nutrition');
 return value;
}
/** Custom ingredient boundary only. Blank user-entered fields (including legacy
 * nulls) contribute zero independently. Never mutate the source record or snapshots.
 */
export function normalizeIngredientNutrition(value:NutritionInput):Nutrition{
 return {calories:nutrient(value.calories),protein:nutrient(value.protein),carbs:nutrient(value.carbs),fat:nutrient(value.fat)};
}
