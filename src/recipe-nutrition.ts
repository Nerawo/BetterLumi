import {sumNutrition,scaleNutrition,unknownNutrition,type RecipeLine,type Nutrition} from "./domain";
/** Whole ingredient amounts stay unchanged, including legacy recipes carrying a servings field. */
export const wholeRecipeNutrition=(lines:RecipeLine[])=>sumNutrition(lines.map(line=>line.nutrition));
/** Historical logs retain their own snapshot; never infer it from today's recipe or old serving count. */
export function retainedRecipeNutrition(nutrition:Nutrition,oldPercent:number|undefined,percent:number,base?:Nutrition) {
 if(percent===(oldPercent??100))return {...nutrition};
 if(base)return scaleNutrition(base,percent/100);
 return (oldPercent??100)>0?scaleNutrition(nutrition,percent/(oldPercent??100)):unknownNutrition();
}
