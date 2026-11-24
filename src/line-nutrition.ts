import type {Nutrition,RecipeLine} from './domain';
export const zeroNutrition=():Nutrition=>({calories:0,protein:0,carbs:0,fat:0});
export const lineNutrition=(line:Pick<RecipeLine,'quantity'|'nutrition'>):Nutrition=>line.quantity===0?zeroNutrition():line.nutrition;
export function validZeroReference(value:unknown){
 const r=value as RecipeLine['zeroQuantityReference'];
 return r!==null&&typeof r==='object'&&Object.keys(r).every(k=>['quantity','nutrition'].includes(k))&&Number.isFinite(r.quantity)&&r.quantity>0&&!!r.nutrition&&Object.keys(r.nutrition).length===4&&['calories','protein','carbs','fat'].every(k=>{const n=r.nutrition[k as keyof Nutrition];return n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0});
}
