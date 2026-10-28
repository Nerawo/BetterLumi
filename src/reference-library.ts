import {builtInFoods,type BuiltInFood} from './data/builtInFoods';
import {scaleNutrition,type Nutrition,type PantryItem,type RecipeLine} from './domain';
import {filterIngredients} from './ingredient-tags';
import {builtInTags,type IngredientTagOption} from './data/builtInTags';
import {everydayFoodName,everydaySearchAliases,normalizedFoodQuery,visibleEverydayFood} from './everyday-foods';
export const referenceName=everydayFoodName;
export const referencePreparation=(item:BuiltInFood,language:string)=>language.startsWith('zh')?item.preparationStateZh:item.preparationStateEn;
export const referenceCategory=(item:BuiltInFood,language:string)=>{const tag=builtInTags.find(tag=>item.tagIds.includes(tag.id));return tag?referenceName(tag,language):item.category};
/** Display formatting only. Never round the nutrition snapshot or reference data. */
export const referenceNutritionSummary=(item:BuiltInFood)=>`${item.kcalPer100g===null?'—':Math.round(item.kcalPer100g)} kcal / 100 g · P ${item.proteinPer100g?.toFixed(1)??'—'} · C ${item.carbsPer100g?.toFixed(1)??'—'} · F ${item.fatPer100g?.toFixed(1)??'—'} g`;
export type FoodChoice={kind:'user';item:PantryItem}|{kind:'built-in';item:BuiltInFood};
/** Names rank ahead of incidental matches in source/category metadata. */
export function foodChoiceSearchRank(choice:FoodChoice,query:string){
 const q=normalizedFoodQuery(query);if(!q)return 0;
 const names=(choice.kind==='built-in'?[referenceName(choice.item,'zh'),referenceName(choice.item,'en'),...(everydaySearchAliases[choice.item.fdcIdSnapshot??'']??[])]:[choice.item.name]).map(normalizedFoodQuery);
 return names.includes(q)?0:names.some(name=>name.startsWith(q))?1:names.some(name=>name.includes(q))?2:3;
}
/** Read-only composition; reference entries never become personal ingredients. */
export function searchFoodChoices(items:PantryItem[],query:string,tagId:string,tags:IngredientTagOption[],references:readonly BuiltInFood[]=builtInFoods):FoodChoice[]{
 const q=normalizedFoodQuery(query);
 return [...filterIngredients(items,query,tagId,tags).map(item=>({kind:'user' as const,item})),...references.filter(item=>visibleEverydayFood(item,q)&&(!tagId||item.tagIds.includes(tagId))&&(!q||[referenceName(item,'zh'),referenceName(item,'en'),...(everydaySearchAliases[item.fdcIdSnapshot??'']??[]),item.nameZh,item.nameEn,item.usdaDescription,item.category,...(item.aliases??[]),...builtInTags.filter(tag=>item.tagIds.includes(tag.id)).flatMap(tag=>[tag.nameZh,tag.nameEn]),...tags.filter(tag=>item.tagIds.includes(tag.id)).map(tag=>tag.name)].some(name=>normalizedFoodQuery(name).includes(q)))).map(item=>({kind:'built-in' as const,item}))].sort((a,b)=>foodChoiceSearchRank(a,q)-foodChoiceSearchRank(b,q));
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
