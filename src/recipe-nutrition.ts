import {sumNutrition,scaleNutrition,unknownNutrition,type RecipeLine,type Nutrition} from "./domain";
/** Whole ingredient amounts stay unchanged, including legacy recipes carrying a servings field. */
export const wholeRecipeNutrition=(lines:RecipeLine[])=>sumNutrition(lines.map(line=>line.nutrition));
/** Missing legacy yield means one serving; never write this fallback back to a record. */
export function recipeYield(recipe:{servings?:number}) {
 return typeof recipe.servings==='number'&&Number.isFinite(recipe.servings)&&recipe.servings>0?recipe.servings:1;
}
export function recipeServingLines(recipe:{servings?:number;lines:RecipeLine[]},servings=1):RecipeLine[] {
 return scaleRecipeLines(recipe.lines,servings/recipeYield(recipe));
}
export const scaleRecipeLines=(lines:RecipeLine[],factor:number):RecipeLine[]=>lines.map(line=>({...line,quantity:line.quantity*factor,nutrition:scaleNutrition(line.nutrition,factor)}));
export function recipeServingNutrition(recipe:{servings?:number;lines:RecipeLine[]},servings=1) {
 return scaleNutrition(wholeRecipeNutrition(recipe.lines),servings/recipeYield(recipe));
}
/** Historical logs retain their own snapshot; never infer it from today's recipe or old serving count. */
export function retainedRecipeNutrition(nutrition:Nutrition,oldPercent:number|undefined,percent:number,base?:Nutrition) {
 if(percent===(oldPercent??100))return {...nutrition};
 if(base)return scaleNutrition(base,percent/100);
 return (oldPercent??100)>0?scaleNutrition(nutrition,percent/(oldPercent??100)):unknownNutrition();
}
