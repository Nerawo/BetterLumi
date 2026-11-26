import {referenceName,foodChoiceSearchRank,type FoodChoice} from './reference-library';
import type {PantrySort} from './PantrySortMenu';
import {ingredientNutritionFactor,scaleNutrition,type PantryItem} from './domain';
import {nutritionReference} from './db';
import {ingredientBaseUnit} from './consumption-units';

export function pantryListNutrition(item:PantryItem){
 const unit=ingredientBaseUnit(item);
 const factor=ingredientNutritionFactor(item,100,unit);
 if(factor!==null&&Number.isFinite(factor)&&factor>0){
  return {basis:{amount:100,unit},nutrition:scaleNutrition(item,factor)};
 }
 return {basis:item.basis==='serving'?{amount:1,unit:'serving'}:nutritionReference(item),nutrition:item};
}

/** Sort a derived list without changing either source or normalizing saved bases. */
export function sortPantryFoods(foods:readonly FoodChoice[],sort:PantrySort,language:string,query=''):FoodChoice[]{
 const name=(food:FoodChoice)=>food.kind==='built-in'?referenceName(food.item,language):food.item.name;
 const calories=(food:FoodChoice)=>food.kind==='built-in'?food.item.kcalPer100g:pantryListNutrition(food.item).nutrition.calories;
 const direction=sort.endsWith('desc')?-1:1;
 return [...foods].sort((a,b)=>{
  if(query.trim()&&sort==='name-asc'){
   const relevance=foodChoiceSearchRank(a,query)-foodChoiceSearchRank(b,query);if(relevance)return relevance;
  }
  if(sort.startsWith('calories')){
   const av=calories(a),bv=calories(b);
   if(av==null)return bv==null?0:1;
   if(bv==null)return -1;
   const difference=(av-bv)*direction;if(difference)return difference;
  }
  return name(a).localeCompare(name(b),language,{numeric:true,sensitivity:'base'})*(sort.startsWith('name')?direction:1);
 });
}
