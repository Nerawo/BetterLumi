import {historicalConsumptionPercent} from './consumption';
import {lineNutrition} from './line-nutrition';
import {sumNutrition,scaleNutrition,unknownNutrition,type TemplateLine,type Nutrition} from "./domain";
/** Whole ingredient amounts stay unchanged, including legacy recipes carrying a servings field. */
export const wholeRecipeNutrition=(lines:TemplateLine[])=>sumNutrition(lines.map(l=>l.source==="family"?unknownNutrition():lineNutrition(l)));
/** Missing legacy yield means one serving; never write this fallback back to a record. */
export function recipeYield(recipe:{servings?:number}) {
 return typeof recipe.servings==='number'&&Number.isFinite(recipe.servings)&&recipe.servings>0?recipe.servings:1;
}
export function recipeServingLines<L extends TemplateLine>(recipe:{servings?:number;lines:L[]},servings=1):L[] {
 return scaleRecipeLines(recipe.lines,servings/recipeYield(recipe));
}
export const scaleRecipeLines=<L extends TemplateLine>(lines:L[],factor:number):L[]=>lines.map(line=>({...line,quantity:line.quantity*factor,...(line.source==="family"?{}:{nutrition:scaleNutrition(lineNutrition(line),factor)})}));
export function recipeServingNutrition(recipe:{servings?:number;lines:TemplateLine[]},servings=1) {
 return scaleNutrition(wholeRecipeNutrition(recipe.lines),servings/recipeYield(recipe));
}
/** Historical logs retain their own snapshot; never infer it from today's recipe or old serving count. */
export function retainedRecipeNutrition(nutrition:Nutrition,oldPercent:number|undefined,percent:number,base?:Nutrition) {
 const originalPercent=historicalConsumptionPercent(oldPercent);
 if(percent===originalPercent)return {...nutrition};
 if(base)return scaleNutrition(base,percent/100);
 return originalPercent>0?scaleNutrition(nutrition,percent/originalPercent):unknownNutrition();
}
