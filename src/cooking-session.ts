import {db} from './db';
import type {Recipe} from './domain';
import {COOKING_PREFIX,reconcileCookingSession,validateJournalRecipe,validateCookingSession,type CookingSession} from './cooking-journal';

export async function openCookingSession(recipe:Recipe,restart=false){
 validateJournalRecipe(recipe);
 return db.transaction('rw',db.settings,async()=>{
  const key=COOKING_PREFIX+recipe.id,row=await db.settings.get(key);
  let old:CookingSession|undefined;
  if(row&&!restart){old=JSON.parse(row.value);validateCookingSession(old!);if(old!.recipeId!==recipe.id)throw Error('Invalid cooking recipe association')}
  const next=reconcileCookingSession(recipe,old);validateCookingSession(next);await db.settings.put({key,value:JSON.stringify(next)});return next;
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
