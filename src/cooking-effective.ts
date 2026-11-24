import {scaleNutrition,unknownNutrition,type Recipe,type RecipeLine} from './domain';
import {recipeServingLines,recipeYield} from './recipe-nutrition';
import {cookingFingerprint,validateCookingSession,visibleCookingEntries,type CookingSession} from './cooking-journal';
import {zeroNutrition} from './line-nutrition';
export function requantifyLine(line:RecipeLine,quantity:number):RecipeLine{
 if(!Number.isFinite(quantity)||quantity<0)throw Error('Invalid ingredient quantity');
 const basis=line.quantity>0?{quantity:line.quantity,nutrition:line.nutrition}:line.zeroQuantityReference;
 const {zeroQuantityReference:_,...rest}=line;
 const nutrition=quantity===0?zeroNutrition():basis?scaleNutrition(basis.nutrition,quantity/basis.quantity):unknownNutrition();
 if(Object.values(nutrition).some(n=>n!==null&&(!Number.isFinite(n)||n<0)))throw Error('Invalid ingredient nutrition');
 return {...rest,quantity,nutrition,...(quantity===0&&basis?{zeroQuantityReference:structuredClone(basis)}:{})};
}
export function cookingPreparationLines(recipe:Recipe,session:CookingSession):RecipeLine[]{
 validateCookingSession(session);if(session.recipeId!==recipe.id)throw Error('Wrong cooking recipe');
 if(session.entries.length!==recipe.lines.length)throw Error('Recipe changed; reopen preparation');
 const lines=recipeServingLines(recipe,session.servings).flatMap((line,index)=>{
  const entry=session.entries[index];if(!entry||entry.fingerprint!==cookingFingerprint(recipe.lines[index]))throw Error('Recipe changed; reopen preparation');
  if(session.ingredientChanges?.removedEntries.some(r=>r.entryId===entry.id))return [];
  return [{...line,...(session.version===3?{lineId:entry.id}:{})}];
 });
 return [...lines,...(session.ingredientChanges?.addedLines.flatMap(a=>recipeServingLines({servings:a.servings,lines:[a.line]},session.servings))??[])];
}
export function effectiveCookingRecipe(recipe:Recipe,session:CookingSession):Recipe{
 const entries=visibleCookingEntries(session);
 const lines=cookingPreparationLines(recipe,session).map((line,index)=>{
  const entry=entries[index];
  const override=session.quantityOverrides?.find(o=>o.entryId===entry.id&&o.fingerprint===entry.fingerprint&&o.unit===line.unit&&o.servings===session.servings);
  return requantifyLine(line,override?.quantity??line.quantity);
 });
 return {...recipe,servings:session.servings,lines};
}
export const normalizedCookingLines=(recipe:Recipe,session:CookingSession)=>effectiveCookingRecipe(recipe,session).lines.map(l=>requantifyLine(l,l.quantity===0?0:l.quantity*(recipeYield(recipe)/session.servings)));
