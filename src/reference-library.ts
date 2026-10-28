import {builtInFoods,type BuiltInFood} from './data/builtInFoods';
import {scaleNutrition,type Nutrition,type PantryItem,type RecipeLine} from './domain';
import {filterIngredients} from './ingredient-tags';
import {builtInTags,type IngredientTagOption} from './data/builtInTags';
export const referenceName=(item:{nameZh:string;nameEn:string},language:string)=>language.startsWith('zh')?item.nameZh:item.nameEn;
export const referencePreparation=(item:BuiltInFood,language:string)=>language.startsWith('zh')?item.preparationStateZh:item.preparationStateEn;
export const referenceCategory=(item:BuiltInFood,language:string)=>{const tag=builtInTags.find(tag=>item.tagIds.includes(tag.id));return tag?referenceName(tag,language):item.category};
/** Display formatting only. Never round the nutrition snapshot or reference data. */
export const referenceNutritionSummary=(item:BuiltInFood)=>`${item.kcalPer100g===null?'—':Math.round(item.kcalPer100g)} kcal / 100 g · P ${item.proteinPer100g?.toFixed(1)??'—'} · C ${item.carbsPer100g?.toFixed(1)??'—'} · F ${item.fatPer100g?.toFixed(1)??'—'} g`;
export type FoodChoice={kind:'user';item:PantryItem}|{kind:'built-in';item:BuiltInFood};
/** Read-only composition; reference entries never become personal ingredients. */
export function searchFoodChoices(items:PantryItem[],query:string,tagId:string,tags:IngredientTagOption[],references:readonly BuiltInFood[]=builtInFoods):FoodChoice[]{
 const q=query.trim().toLowerCase();
 return [...filterIngredients(items,query,tagId,tags).map(item=>({kind:'user' as const,item})),...references.filter(item=>(!tagId||item.tagIds.includes(tagId))&&(!q||[item.nameZh,item.nameEn,item.usdaDescription,item.category,...(item.aliases??[]),...builtInTags.filter(tag=>item.tagIds.includes(tag.id)).flatMap(tag=>[tag.nameZh,tag.nameEn]),...tags.filter(tag=>item.tagIds.includes(tag.id)).map(tag=>tag.name)].some(name=>name.toLowerCase().includes(q)))).map(item=>({kind:'built-in' as const,item}))];
}
/** Reuse existing scaling; null means unknown, never zero. History stores the copy. */
export function builtInFoodNutrition(item:BuiltInFood,quantity:number,unit:string):Nutrition{
 const base={calories:item.kcalPer100g,protein:item.proteinPer100g,carbs:item.carbsPer100g,fat:item.fatPer100g};
 return unit==='g'?scaleNutrition(base,quantity/100):{calories:null,protein:null,carbs:null,fat:null};
}
export function builtInFoodLine(item:BuiltInFood,quantity:number,language:string):RecipeLine{
 return {ingredientId:item.id,name:referenceName(item,language),quantity,unit:'g',nutrition:builtInFoodNutrition(item,quantity,'g')};
}
export function safeReferenceUrl(value:string){try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}}
