import {db} from './db';
import {checkPreparedMember,templateFromPreparation} from './family-contract';
import {recipes,putRecipeWithStockReferences,type Recipe} from './domain';
import {effectiveCookingRecipe,normalizedCookingLines,initializeMealPreparation,type MealPreparation} from './cooking-effective';
import {replaceCookingIngredient,COOKING_PREFIX,reconcileCookingSession,validateJournalRecipe,validateCookingSession,type CookingSession} from './cooking-journal';

export async function openCookingSession(recipe:Recipe,restart=false,preparation?:MealPreparation,resolveSlots?:(s:CookingSession)=>CookingSession,initialServings?:number){
 validateJournalRecipe(recipe);
 return db.transaction('rw',db.settings,db.ingredientFamilies,async()=>{
  const familyIds=new Set(recipe.lines.flatMap(line=>line.source==='family'?[line.familyId]:[]));
  if(familyIds.size){
   const families=await db.ingredientFamilies.bulkGet([...familyIds]);
   if(families.some(f=>!f||f.deletedAt))throw Error('familyReferenced');
  }
  const key=COOKING_PREFIX+recipe.id,row=await db.settings.get(key);
  let old:CookingSession|undefined;
  if(row&&!restart){old=JSON.parse(row.value);validateCookingSession(old!);if(old!.recipeId!==recipe.id)throw Error('Invalid cooking recipe association')}
  let fresh=reconcileCookingSession(recipe,old);
  if(old?.status!=='active'&&initialServings!==undefined)fresh={...fresh,servings:initialServings};
  if(familyIds.size)fresh={...fresh,version:4,ingredientChanges:fresh.ingredientChanges??{addedLines:[],removedEntries:[]}};
  let next=preparation?initializeMealPreparation(recipe,fresh,preparation):fresh;
  if(resolveSlots)next=resolveSlots(next);
  validateCookingSession(next);
  await db.settings.put({key,value:JSON.stringify(next)});return next;
 });
}
/** Template and preparation baseline change together, without any inventory tables. */
export async function updateRecipeFromCooking(recipe:Recipe,session:CookingSession){
 const normalized=normalizedCookingLines(recipe,session).map((l,index)=>({...l,lineId:l.lineId??session.entries[index].id}));
 const nextRecipe={...recipe,lines:templateFromPreparation(recipe,normalized),revision:recipe.revision+1,updatedAt:new Date().toISOString()};
 if(!nextRecipe.lines.length)throw Error('A recipe requires ingredients');
 let nextSession=reconcileCookingSession(nextRecipe,{...session,...(session.version>=3?{ingredientChanges:{addedLines:[],removedEntries:[]}}:{})});nextSession.quantityOverrides=[];
 for(const line of nextRecipe.lines)if(line.source==="family"){
  const resolved=effectiveCookingRecipe(recipe,session).lines.find(l=>l.lineId===line.lineId)!;
  nextSession=replaceCookingIngredient(nextSession,line.lineId,resolved);
 }
 nextSession.checked=session.checked.filter(id=>nextSession.entries.some(e=>e.id===id));
 return commitCookingRecipeUpdate(recipe,session,nextRecipe,nextSession);
}
/** Method has no ingredient identity effects, including for repeated legacy lines. */
export async function updateCookingMethod(recipe:Recipe,session:CookingSession,instructions:string){
 if(typeof instructions!=='string'||session.recipeId!==recipe.id)throw Error('Invalid cooking method update');
 const nextRecipe={...recipe,instructions,revision:recipe.revision+1,updatedAt:new Date().toISOString()};
 return commitCookingRecipeUpdate(recipe,session,nextRecipe,{...session,recipeRevision:nextRecipe.revision});
}
function commitCookingRecipeUpdate(recipe:Recipe,session:CookingSession,nextRecipe:Recipe,nextSession:CookingSession){
 return db.transaction('rw',recipes,db.settings,db.ingredientFamilies,db.foodBatches,async()=>{
  const current=await recipes.get(recipe.id);if(!current||JSON.stringify(current)!==JSON.stringify(recipe))throw Error('Recipe changed; reopen to reload');
  const key=COOKING_PREFIX+recipe.id,row=await db.settings.get(key);if(row?.value!==JSON.stringify(session))throw Error('Preparation changed; reopen to reload');
  for(const line of nextRecipe.lines)if(line.source==='family'){
   const family=await db.ingredientFamilies.get(line.familyId);
   if(!family||family.deletedAt)throw Error('familyReferenced');
   if(nextRecipe.lines!==recipe.lines){
    const product=nextSession.ingredientChanges?.replacements?.find(r=>r.entryId===line.lineId)?.line;
    checkPreparedMember(family,line,product);
   }
  }
  validateJournalRecipe(nextRecipe);validateCookingSession(nextSession);await putRecipeWithStockReferences(nextRecipe);await db.settings.put({key,value:JSON.stringify(nextSession)});return {recipe:nextRecipe,session:nextSession};
 });
}
/** Compare-and-swap prevents another window's progress from being silently overwritten. */
export async function saveCookingSession(previous:CookingSession,next:CookingSession){
 validateCookingSession(next);
 if(previous.recipeId!==next.recipeId||previous.id!==next.id)throw Error('Invalid cooking session association');
 return db.transaction('rw',db.settings,async()=>{
  const key=COOKING_PREFIX+next.recipeId,row=await db.settings.get(key);
  if(row?.value!==JSON.stringify(previous))throw Error('Cooking session changed; reopen to reload');
  await db.settings.put({key,value:JSON.stringify(next)});return next;
 });
}
/** Abandon only this session; an older window must never delete a newer preparation. */
export async function discardCookingSession(previous:CookingSession){
 return db.transaction('rw',db.settings,async()=>{
  const key=COOKING_PREFIX+previous.recipeId,row=await db.settings.get(key);
  if(!row)return;
  if(row.value!==JSON.stringify(previous))throw Error('Cooking session changed; reopen to reload');
  await db.settings.delete(key);
 });
}
