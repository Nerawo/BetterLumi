import {unknownNutrition,type PantryItem,type RecipeLine,type TemplateLine} from './domain';
import {personalNutrition,userChoice,type IngredientPreference} from './ingredient-preferences';
import {recipeUnitFactors} from './recipe-draft-units';

import {builtInFoods} from './data/builtInFoods';
import type {FamilyCatalog} from './families';
import {referenceName,type FoodChoice} from './reference-library';

const referenceChoices = new Map<string, FoodChoice>(builtInFoods.map(item => [item.id, {kind:'built-in', item}]));
function exactChoice(line:RecipeLine,item?:PantryItem){
 return line.source==='batch'?undefined:item?userChoice(item):referenceChoices.get(line.ingredientId);
}
function currentChoiceName(choice:FoodChoice|undefined,language:string,fallback:string,preference?:IngredientPreference){
 if(!choice||preference?.archived)return fallback;
 return choice.kind==='built-in'?referenceName(choice.item,language):choice.item.deletedAt?fallback:choice.item.name;
}
export function recipeDisplayName(line:TemplateLine,catalog:FamilyCatalog,language:string,draftFamilyId?:string){
 const familyId=line.source==='family'?line.familyId:draftFamilyId;
 if(familyId)return catalog.families.find(f=>f.id===familyId)?.name??line.name;
 if(line.source==='family'||line.source==='batch')return line.name;
 return currentChoiceName(catalog.choices.get(line.ingredientId),language,line.name,catalog.preferences[line.ingredientId]);
}
export function livePantryLine(line:RecipeLine,item?:PantryItem,preference?:IngredientPreference,language?:string){
 const choice=exactChoice(line,item);
 if(!choice)return line;
 const name=language?currentChoiceName(choice,language,line.name,preference):line.name;
 if(!recipeUnitFactors(choice,preference).has(line.unit))return {...line,name,nutrition:unknownNutrition(),zeroQuantityReference:undefined};
 const nutrition=personalNutrition(choice,line.quantity,line.unit,preference);
 return {...line,name,nutrition,...(line.quantity===0?{zeroQuantityReference:{quantity:1,nutrition:personalNutrition(choice,1,line.unit,preference)}}:{})};
}
export function livePreparation(lines:RecipeLine[],pantry:PantryItem[],preferences:Record<string,IngredientPreference>,language?:string){
 const items=new Map(pantry.map(i=>[i.id,i]));
 return lines.map(line=>livePantryLine(line,items.get(line.ingredientId),preferences[line.ingredientId],language));
}
export function needsUnitReview(lines:RecipeLine[],pantry:PantryItem[],preferences:Record<string,IngredientPreference>){
 const items=new Map(pantry.map(item=>[item.id,item]));
 return lines.some(line=>{const choice=exactChoice(line,items.get(line.ingredientId));return !!choice&&!recipeUnitFactors(choice,preferences[line.ingredientId]).has(line.unit)});
}
