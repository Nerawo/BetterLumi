import {convertRecipeLine} from './recipe-draft-units';
import {scaleNutrition,unknownNutrition,type Recipe,type RecipeLine} from './domain';
import {recipeServingLines,recipeYield} from './recipe-nutrition';
import {addCookingIngredient,replaceCookingIngredient,changeCookingServings,removeCookingIngredient,setCookingQuantity,cookingFingerprint,validateCookingSession,visibleCookingEntries,type CookingSession} from './cooking-journal';
import {storageNutritionEqual} from './food-storage-model';
import {lineNutrition,zeroNutrition} from './line-nutrition';
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
  const entry=session.entries[index];if(!entry||entry.lineId!==recipe.lines[index].lineId||entry.fingerprint!==cookingFingerprint(recipe.lines[index]))throw Error('Recipe changed; reopen preparation');
  if(session.ingredientChanges?.removedEntries.some(r=>r.entryId===entry.id))return [];
  const replacement=session.ingredientChanges?.replacements?.find(r=>r.entryId===entry.id);
  if(replacement)return recipeServingLines({servings:replacement.servings,lines:[{...replacement.line,groupId:line.groupId}]},session.servings);
  return [{...line,...(session.version>=3?{lineId:entry.id}:{})}];
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
/** Convert the derived snapshot and absolute override independently so restoring the override
 * still restores the recipe-derived amount in the chosen unit. */
export function changeCookingUnit(recipe:Recipe,session:CookingSession,id:string,unit:string,factors:ReadonlyMap<string,number>){
 const index=visibleCookingEntries(session).findIndex(entry=>entry.id===id);
 const line=cookingPreparationLines(recipe,session)[index];
 if(!line)throw Error('Unknown preparation ingredient');
 if(line.unit===unit)return session;
 const converted=convertRecipeLine(line,unit,factors);
 if(!converted)throw Error('Unsupported unit conversion');
 let next=replaceCookingIngredient(session,id,converted);
 const override=session.quantityOverrides?.find(o=>o.entryId===id);
 if(override){
  const actual=convertRecipeLine(requantifyLine(line,override.quantity),unit,factors);
  if(!actual)throw Error('Unsupported quantity conversion');
  next=setCookingQuantity(next,id,actual.quantity,unit);
 }
 return {...next,checked:session.checked};
}
export const normalizedCookingLines=(recipe:Recipe,session:CookingSession)=>effectiveCookingRecipe(recipe,session).lines.map(l=>requantifyLine(l,l.quantity===0?0:l.quantity*(recipeYield(recipe)/session.servings)));

/** Amounts are for the entire preparation, before the meal's consumption percentage. */
export interface MealPreparation {
 servings:number;
 lines:RecipeLine[];
 baseline:Recipe;
}
export function initializeMealPreparation(recipe:Recipe,fresh:CookingSession,draft:MealPreparation){
 if(draft.baseline.id!==recipe.id||draft.baseline.revision!==recipe.revision)throw Error('Recipe changed before preparation');
 const baseline=recipeServingLines(draft.baseline,draft.servings);
 const entries=fresh.entries.map((entry,index)=>({...entry,id:baseline[index].lineId!}));
 let session=changeCookingServings({...fresh,entries,legacyMappings:fresh.legacyMappings.map(m=>({...m,id:entries[m.index].id}))},draft.servings);
 const retained=new Set<RecipeLine>();
 for(const [index,base] of baseline.entries()){
  const line=draft.lines.find(l=>l.lineId===base.lineId);
  if(!line){session=removeCookingIngredient(session,entries[index].id);continue}
  if(line.ingredientId!==base.ingredientId||(line.source??'pantry')!==(base.source??'pantry')||line.sourceBatchId!==base.sourceBatchId||line.unit!==base.unit||line.quantityBasis!==base.quantityBasis||
     line.name!==base.name||!storageNutritionEqual(requantifyLine(base,line.quantity).nutrition,lineNutrition(line))){
   session=replaceCookingIngredient(session,entries[index].id,line);
   retained.add(line);
   continue;
  }
  retained.add(line);
  if(line.quantity!==base.quantity)session=setCookingQuantity(session,entries[index].id,line.quantity,line.unit);
 }
 for(const line of draft.lines){
  if(!retained.has(line))session=addCookingIngredient(session,line,line.lineId);
 }
 return session;
}
