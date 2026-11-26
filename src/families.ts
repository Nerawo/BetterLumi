import {familyTagPrefix,saveFamilyTags} from './family-tags';
import {validateFamilies,checkPreparedMember,templateFromPreparation} from './family-contract';
import {db, type IngredientFamily} from './db';
import {recipes,type Recipe,type FamilyLine,type RecipeLine,type PantryItem} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {recipeUnitFactors} from './recipe-draft-units';
import {personalNutrition,ingredientPreferencePrefix,ingredientPreferenceRows,type IngredientPreference} from './ingredient-preferences';
import {type FoodChoice,referenceName} from './reference-library';
import {COOKING_PREFIX,type CookingSession} from './cooking-journal';

export function concreteRecipe(recipe:Recipe):recipe is Recipe<RecipeLine>{return recipe.lines.every(l=>l.source!=='family')}
export function concreteLines(recipe:Recipe){if(!concreteRecipe(recipe))throw Error('familyUnavailable');return recipe.lines}
export type FamilyCatalog=ReturnType<typeof familyCatalog>;
export function familyCatalog(families:IngredientFamily[],items:PantryItem[],preferences:Record<string,IngredientPreference>){
 const choices=new Map<string,FoodChoice>();
 for(const item of builtInFoods)choices.set(item.id,{kind:'built-in',item});
 for(const item of items)if(!item.deletedAt)choices.set(item.id,{kind:'user',item});
 return {families:families.filter(f=>!f.deletedAt),choices,preferences};
}
export function memberName(c:FoodChoice,language:string){return c.kind==='user'?c.item.name:referenceName(c.item,language)}
export function familyMembers(f:IngredientFamily,c:FamilyCatalog){
 return f.memberIds.flatMap(id=>{const choice=c.choices.get(id);return choice&&!c.preferences[id]?.archived?[choice]:[]});
}
export function commonUnits(f:IngredientFamily,c:FamilyCatalog){
 const factors=familyMembers(f,c).map(m=>recipeUnitFactors(m,c.preferences[m.item.id]));
 return (['g','mL'] as const).filter(unit=>factors.length>0&&factors.every(m=>m.has(unit)));
}
export function familyOptions(line:FamilyLine,c:FamilyCatalog){
 const f=c.families.find(f=>f.id===line.familyId);
 if(!f)return [];
 const members=familyMembers(f,c),active=members.filter(m=>f.inUseIds.includes(m.item.id));
 return (active.length?active:members).filter(member=>recipeUnitFactors(member,c.preferences[member.item.id]).has(line.unit));
}
export function familySnapshot(line:FamilyLine,choice:FoodChoice,c:FamilyCatalog,language:string):RecipeLine{
 if(!familyOptions(line,c).some(m=>m.item.id===choice.item.id))throw Error('familyUnavailable');
 const nutrition=personalNutrition(choice,line.quantity,line.unit,c.preferences[choice.item.id]);
 return {lineId:line.lineId,groupId:line.groupId,name:memberName(choice,language),ingredientId:choice.item.id,
   quantity:line.quantity,unit:line.unit,nutrition,...(line.quantity===0?{zeroQuantityReference:{quantity:1,nutrition:personalNutrition(choice,1,line.unit,c.preferences[choice.item.id])}}:{})};
}
export function familyResolution(line:FamilyLine,c:FamilyCatalog){
 const options=familyOptions(line,c),family=c.families.find(f=>f.id===line.familyId);
 if(!options.length)return {kind:'unavailable' as const,options};
 if(options.length===1&&family?.inUseIds.includes(options[0].item.id))
  return {kind:'automatic' as const,options,member:options[0]};
 return {kind:'requires-selection' as const,options};
}
export function automaticMember(line:FamilyLine,c:FamilyCatalog){
 return familyResolution(line,c).member;
}
export async function saveFamily(f:IngredientFamily, tagIds?:string[]){
 return db.transaction('rw',[db.ingredientFamilies,db.ingredients,db.settings,db.table('ingredientTags')],async()=>{
  const all=await db.ingredientFamilies.toArray(),old=all.find(r=>r.id===f.id);
  if(old&&(old.deletedAt||old.revision!==f.revision))throw Error('familyChanged');
  const next={...f,name:f.name.trim(),alternateName:f.alternateName.trim(),updatedAt:new Date().toISOString(),revision:old?old.revision+1:1};
  const prefs=ingredientPreferenceRows(await db.settings.bulkGet(next.inUseIds.map(id=>ingredientPreferencePrefix+id)).then(rows=>rows.flatMap(row=>row?[row]:[])));
  if(next.inUseIds.some(id=>prefs[id]?.archived))throw Error("familyChanged");
  validateFamilies([...all.filter(r=>r.id!==f.id),next],await db.ingredients.toArray(),[]);
  await db.ingredientFamilies.put(next);
  if(tagIds)await saveFamilyTags(next.id,tagIds);
 });
}
export async function deleteFamily(f:IngredientFamily){
 return db.transaction('rw',db.ingredientFamilies,recipes,db.settings,async()=>{
  const old=await db.ingredientFamilies.get(f.id);
  if(!old||old.revision!==f.revision)throw Error('familyChanged');
  const used=(await recipes.toArray()).filter(r=>r.lines.some(l=>l.source==='family'&&l.familyId===f.id));
  const sessions=await db.settings.where('key').startsWith(COOKING_PREFIX).toArray();
  if(used.some(r=>!r.deletedAt)||sessions.some(row=>{
   const s:CookingSession=JSON.parse(row.value);
   return s.status==='active'&&s.entries.some(e=>{const fp=JSON.parse(e.fingerprint);return fp[0]==='family'&&fp[1]===f.id});
  }))throw Error('familyReferenced');
  const now=new Date().toISOString();
  await db.settings.delete(familyTagPrefix+f.id);
  await db.ingredientFamilies.update(f.id,{deletedAt:now,updatedAt:now,revision:f.revision+1,memberIds:[],inUseIds:[]});
 });
}
export async function saveFamilyRecipe(recipe:Recipe){
 if(concreteRecipe(recipe)){await recipes.put(recipe);return}
 return db.transaction('rw',recipes,db.ingredientFamilies,db.ingredients,async()=>{
  const families=await db.ingredientFamilies.toArray(),items=await db.ingredients.toArray();
  validateFamilies(families,items,[recipe]);
  await recipes.put(recipe);
 });
}

export async function saveMealRecipeVersion(original:Recipe|undefined,prepared:Recipe<RecipeLine>,historical:boolean){
 if(!original||concreteRecipe(original)){await recipes.put(prepared);return}
 return db.transaction('rw',recipes,db.ingredientFamilies,db.ingredients,db.settings,async()=>{
  const current=await recipes.get(original.id);
  if(!current||current.deletedAt||current.revision!==original.revision)throw Error('familyChanged');
  const products=new Map(prepared.lines.map(l=>[l.lineId,l]));
  // Older meal snapshots may predate the template's family slots.
  if(historical&&original.lines.some(l=>l.source==='family'&&!products.has(l.lineId)))throw Error('familyUpdateUnit');
  const lines=templateFromPreparation(original,prepared.lines);
  for(const slot of lines)if(slot.source==='family'){
   checkPreparedMember(await db.ingredientFamilies.get(slot.familyId),slot,products.get(slot.lineId));
  }
  await saveFamilyRecipe({...prepared,lines});
 });
}
