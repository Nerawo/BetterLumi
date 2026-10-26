import {referenceName,type FoodChoice} from './reference-library';
import type {PantrySort} from './PantrySortMenu';

/** Sort a derived list without changing either source or normalizing saved bases. */
export function sortPantryFoods(foods:readonly FoodChoice[],sort:PantrySort,language:string):FoodChoice[]{
 const name=(food:FoodChoice)=>food.kind==='built-in'?referenceName(food.item,language):food.item.name;
 const calories=(food:FoodChoice)=>food.kind==='built-in'?food.item.kcalPer100g:food.item.calories;
 const direction=sort.endsWith('desc')?-1:1;
 return [...foods].sort((a,b)=>{
  if(sort.startsWith('calories')){
   const av=calories(a),bv=calories(b);
   if(av==null)return bv==null?0:1;
   if(bv==null)return -1;
   const difference=(av-bv)*direction;if(difference)return difference;
  }
  return name(a).localeCompare(name(b),language,{numeric:true,sensitivity:'base'})*(sort.startsWith('name')?direction:1);
 });
}
