import {visibleHouseholdUnits,householdUnitLabel} from './household-units';
import {db,ingredientNutrition,type PantryItem,type Nutrition} from './domain';
import {builtInFoodNutrition,type FoodChoice} from './reference-library';
import {validConsumptionUnit,ingredientBaseUnit,defaultIngredientQuantity,type ConsumptionUnit} from './consumption-units';
export interface IngredientPreference {version:1;units:ConsumptionUnit[];preferred:string;archived:boolean}
export const ingredientPreferencePrefix='ingredientPreference:';
export function parseIngredientPreference(value:string|undefined):IngredientPreference|null{
 try{const p=JSON.parse(value??'');if(p.version!==1||!Array.isArray(p.units)||!p.units.every(validConsumptionUnit)||new Set(p.units.map((u:ConsumptionUnit)=>u.name.toLowerCase())).size!==p.units.length||typeof p.preferred!=='string'||typeof p.archived!=='boolean')return null;return p}catch{return null}
}
export function personalUnits(item:FoodChoice,p?:IngredientPreference|null){return p?.units??(item.kind==='user'&&item.item.consumptionUnit?[item.item.consumptionUnit]:[])}
/** Read-time composition only; official units are never copied into saved custom units. */
export function householdUnits(item:FoodChoice,p?:IngredientPreference|null){return item.kind==='built-in'?visibleHouseholdUnits(item.item.id,personalUnits(item,p),p?.preferred):[]}
export function availableUnits(item:FoodChoice,p?:IngredientPreference|null){return [...personalUnits(item,p),...householdUnits(item,p)]}
export function foodUnitLabel(item:FoodChoice|null,unit:string,language:string,p?:IngredientPreference|null){return item?householdUnitLabel(item.item.id,unit,language,personalUnits(item,p)):unit}
export function baseUnit(item:FoodChoice){return item.kind==='built-in'?'g':ingredientBaseUnit(item.item)}
export function validIngredientPreference(item:FoodChoice,p:IngredientPreference){return !!parseIngredientPreference(JSON.stringify(p))&&p.units.every(u=>u.unit===baseUnit(item))&&[baseUnit(item),...(item.kind==='user'&&item.item.basis==='serving'?['serving']:[]),...availableUnits(item,p).map(u=>u.name)].includes(p.preferred)}
export async function saveIngredientPreference(item:FoodChoice,p:IngredientPreference){if(!validIngredientPreference(item,p))throw Error('Invalid ingredient preference');await db.settings.put({key:ingredientPreferencePrefix+item.item.id,value:JSON.stringify(p)})}
export function ingredientPreferenceRows(rows:{key:string;value:string}[]){return Object.fromEntries(rows.filter(r=>r.key.startsWith(ingredientPreferencePrefix)).flatMap(r=>{const p=parseIngredientPreference(r.value);return p?[[r.key.slice(ingredientPreferencePrefix.length),p]]:[]})) as Record<string,IngredientPreference>}
export function preferredFoodUnit(item:FoodChoice,p?:IngredientPreference){const fallback=item.kind==='user'&&item.item.basis==='serving'?'serving':baseUnit(item);return p&&validIngredientPreference(item,p)?p.preferred:fallback}
export function personalQuantity(item:FoodChoice,unit:string){return item.kind==='user'?defaultIngredientQuantity(item.item,unit):unit==='g'?100:1}
export function personalNutrition(item:FoodChoice,quantity:number,unit:string,p?:IngredientPreference):Nutrition{
 const conversion=availableUnits(item,p).find(u=>u.name===unit);if(conversion){quantity=quantity*conversion.amount/conversion.quantity;unit=conversion.unit}
 return item.kind==='built-in'?builtInFoodNutrition(item.item,quantity,unit):ingredientNutrition({...item.item,consumptionUnit:null},quantity,unit);
}
export function userChoice(item:PantryItem):FoodChoice{return {kind:'user',item}}
