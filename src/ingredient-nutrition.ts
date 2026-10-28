import type {Nutrition} from './domain';

type NutritionInput={calories?:unknown;protein?:unknown;carbs?:unknown;fat?:unknown};
const blank=(value:unknown)=>value==null||(typeof value==='string'&&value.trim()==='');
function nutrient(value:unknown):number|null{
 if(blank(value))return null;
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Invalid ingredient nutrition');
 return value;
}
/** Custom ingredient boundary only. Known calories make omitted optional macros
 * zero; wholly unknown nutrition stays unknown. Never mutate the source record.
 */
export function normalizeIngredientNutrition(value:NutritionInput):Nutrition{
 const calories=nutrient(value.calories);
 const macro=(value:unknown)=>blank(value)&&calories!==null?0:nutrient(value);
 return {calories,protein:macro(value.protein),carbs:macro(value.carbs),fat:macro(value.fat)};
}
