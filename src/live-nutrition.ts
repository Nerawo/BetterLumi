import {unknownNutrition,type PantryItem,type RecipeLine} from './domain';
import {personalNutrition,userChoice,type IngredientPreference} from './ingredient-preferences';
import {recipeUnitFactors} from './recipe-draft-units';

import {builtInFoods} from './data/builtInFoods';
import type {FoodChoice} from './reference-library';

const referenceChoices = new Map<string, FoodChoice>(builtInFoods.map(item => [item.id, {kind:'built-in', item}]));
function exactChoice(line:RecipeLine,item?:PantryItem){
 return line.source==='batch'?undefined:item?userChoice(item):referenceChoices.get(line.ingredientId);
}
export function livePantryLine(line:RecipeLine,item?:PantryItem,preference?:IngredientPreference){
 const choice=exactChoice(line,item);
 if(!choice)return line;
 if(!recipeUnitFactors(choice,preference).has(line.unit))return {...line,nutrition:unknownNutrition(),zeroQuantityReference:undefined};
 const nutrition=personalNutrition(choice,line.quantity,line.unit,preference);
 return {...line,nutrition,...(line.quantity===0?{zeroQuantityReference:{quantity:1,nutrition:personalNutrition(choice,1,line.unit,preference)}}:{})};
}
export function livePreparation(lines:RecipeLine[],pantry:PantryItem[],preferences:Record<string,IngredientPreference>){
 const items=new Map(pantry.map(i=>[i.id,i]));
 return lines.map(line=>livePantryLine(line,items.get(line.ingredientId),preferences[line.ingredientId]));
}
export function needsUnitReview(lines:RecipeLine[],pantry:PantryItem[],preferences:Record<string,IngredientPreference>){
 const items=new Map(pantry.map(item=>[item.id,item]));
 return lines.some(line=>{const choice=exactChoice(line,items.get(line.ingredientId));return !!choice&&!recipeUnitFactors(choice,preferences[line.ingredientId]).has(line.unit)});
}
