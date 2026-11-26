import {nutrientKeys,type Nutrition,type Recipe,type TemplateLine} from './domain';
import {familyOptions,familySnapshot,type FamilyCatalog} from './families';
import {livePantryLine} from './live-nutrition';
import {lineNutrition} from './line-nutrition';
import {recipeNutritionDisplay} from './recipe-nutrition-display';

import {liveStockLines} from './stock-view';
import type {FoodBatch} from './food-storage-model';

type Bounds=readonly [number,number];
export type NutritionRange=Record<keyof Nutrition,Bounds|null>;

export function recipeNutritionRange(lines:TemplateLine[],catalog:FamilyCatalog,language:string,factor=1,stock:FoodBatch[]=[]):NutritionRange{
 const candidates=lines.map(line=>{
  if(line.source==='family')return familyOptions(line,catalog).map(member=>lineNutrition(familySnapshot(line,member,catalog,language)));
  if(line.source==='batch')return [lineNutrition(liveStockLines([line],stock)[0])];
  const choice=catalog.choices.get(line.ingredientId);
  return [lineNutrition(livePantryLine(line,choice?.kind==='user'?choice.item:undefined,catalog.preferences[line.ingredientId]))];
 });
 return Object.fromEntries(nutrientKeys.map(key=>{
  let low=0,high=0;
  for(const options of candidates){
   const values=options.map(option=>option[key]);
   if(!values.length||values.some(value=>value===null||!Number.isFinite(value)||value<0))return [key,null];
   low+=Math.min(...values as number[]);high+=Math.max(...values as number[]);
  }
  return [key,candidates.length&&Number.isFinite(high*factor)?[low*factor,high*factor]:null];
 })) as NutritionRange;
}

export function recipeCardRange(recipe:Recipe,catalog:FamilyCatalog,language:string,stock:FoodBatch[]=[]){
 const perServing=typeof recipe.servings==='number'&&Number.isFinite(recipe.servings)&&recipe.servings>0;
 return {nutrition:recipeNutritionRange(recipe.lines,catalog,language,perServing?1/recipe.servings!:1,stock),perServing};
}

export function formatNutritionRange([low,high]:Bounds){
 const start=recipeNutritionDisplay(low),end=recipeNutritionDisplay(high);
 return start===end?start:`${start}–${end}`;
}
