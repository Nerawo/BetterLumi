import {nutrientKeys,type Recipe,type Nutrition} from './domain';
import {wholeRecipeNutrition} from './recipe-nutrition';
/** List presentation only; stored whole-recipe values and log snapshots remain unchanged. */
export function recipeListNutrition(recipe:Pick<Recipe,'lines'>&{servings?:number}){
 const perServing=typeof recipe.servings==='number'&&Number.isFinite(recipe.servings)&&recipe.servings>0;
 const total=wholeRecipeNutrition(recipe.lines),divisor=perServing?recipe.servings!:1;
 const nutrition=Object.fromEntries(nutrientKeys.map(key=>{
  const value=total[key];
  const valid=recipe.lines.length>0&&recipe.lines.every(line=>{const recorded=line.nutrition?.[key];return typeof recorded==='number'&&Number.isFinite(recorded)&&recorded>=0});
  return [key,valid&&value!==null&&Number.isFinite(value)?value/divisor:null];
 })) as Nutrition;
 return {nutrition,perServing};
}
