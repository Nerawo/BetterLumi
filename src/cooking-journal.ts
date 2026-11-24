import type {Recipe,RecipeLine} from './domain';
import {newId} from './ids';

export interface IngredientGroup {id:string;name:string}
export const COOKING_PREFIX='cooking-session:v1:';
export interface CookingEntry {id:string;lineId?:string;fingerprint:string}
export interface CookingSession {
 version:1;id:string;recipeId:string;recipeRevision:number;servings:number;
 entries:CookingEntry[];checked:string[];legacyMappings:{id:string;index:number;fingerprint:string}[];
 status:'active'|'completed';needsReview:boolean;
}
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
/** Organizational metadata deliberately excluded: moving/renaming groups cannot invalidate progress. */
export const cookingFingerprint=(l:RecipeLine)=>JSON.stringify([l.source??'pantry',l.ingredientId,l.sourceBatchId??null,l.quantityBasis??null,l.name,l.quantity,l.unit,l.nutrition]);
export function identifyRecipeLines(lines:RecipeLine[]):RecipeLine[]{
 const seen=new Set<string>();return lines.map(l=>{const id=l.lineId&&!seen.has(l.lineId)?l.lineId:newId();seen.add(id);return {...l,lineId:id}});
}
export function recipeSections(recipe:Pick<Recipe,'lines'|'ingredientGroups'>){
 const groups=recipe.ingredientGroups??[],known=new Set(groups.map(g=>g.id));
 return [{id:'',name:'',lines:recipe.lines.filter(l=>!l.groupId||!known.has(l.groupId))},...groups.map(g=>({...g,lines:recipe.lines.filter(l=>l.groupId===g.id)}))];
}
export function removeIngredientGroup(recipe:Pick<Recipe,'lines'|'ingredientGroups'>,id:string){
 return {ingredientGroups:(recipe.ingredientGroups??[]).filter(g=>g.id!==id),lines:recipe.lines.map(l=>l.groupId===id?{...l,groupId:undefined}:l)};
}
export function reconcileCookingSession(recipe:Recipe,old?:CookingSession):CookingSession {
 const active=old?.status==='active'&&old.recipeId===recipe.id?old:undefined;
 const fingerprints=recipe.lines.map(cookingFingerprint),previous=active?.entries??[];
 const unchanged=active?.recipeRevision===recipe.revision&&previous.length===fingerprints.length&&previous.every((e,i)=>e.fingerprint===fingerprints[i]&&e.lineId===recipe.lines[i].lineId);
 let ambiguous=false;
 const entries=recipe.lines.map((l,index):CookingEntry=>{
  const fingerprint=fingerprints[index];
  if(l.lineId)return {id:l.lineId,lineId:l.lineId,fingerprint};
  const matches=previous.filter(e=>!e.lineId&&e.fingerprint===fingerprint),count=fingerprints.filter((f,i)=>!recipe.lines[i].lineId&&f===fingerprint).length;
  if(unchanged)return {...previous[index]};
  if(matches.length===1&&count===1)return {...matches[0]};
  if(matches.length)ambiguous=true;
  return {id:newId(),fingerprint};
 });
 const checked=entries.filter(e=>{
  const exact=previous.find(p=>p.id===e.id);
  if(exact)return exact.fingerprint===e.fingerprint&&!!active?.checked.includes(exact.id);
  // An explicit editor save can promote a unique legacy mapping to a permanent line ID.
  const legacy=previous.filter(p=>!p.lineId&&p.fingerprint===e.fingerprint);
  if(e.lineId&&legacy.length>1&&legacy.some(p=>active?.checked.includes(p.id)))ambiguous=true;
  return !!e.lineId&&legacy.length===1&&entries.filter(x=>x.fingerprint===e.fingerprint).length===1&&!!active?.checked.includes(legacy[0].id);
 }).map(e=>e.id);
 return {version:1,id:active?.id??newId(),recipeId:recipe.id,recipeRevision:recipe.revision,
  servings:active?.servings??(recipe.servings||1),entries,checked,
  legacyMappings:entries.flatMap((e,index)=>e.lineId?[]:[{id:e.id,index,fingerprint:e.fingerprint}]),
  status:'active',needsReview:ambiguous||!!active?.needsReview};
}
export function changeCookingServings(s:CookingSession,servings:number,confirmReset=false):CookingSession {
 if(!positive(servings))throw Error('Invalid serving quantity');
 if(servings===s.servings)return s;
 if(s.checked.length&&!confirmReset)throw Error('Confirm checklist reset');
 return {...s,servings,checked:[]};
}
export function validateJournalRecipe(recipe:Pick<Recipe,'lines'|'ingredientGroups'>){
 const groups=recipe.ingredientGroups??[];
 if(!Array.isArray(groups)||groups.some(g=>!g||!text(g.id)||!text(g.name))||new Set(groups.map(g=>g.id)).size!==groups.length)throw Error('Invalid ingredient groups');
 const ids=new Set<string>();
 for(const line of recipe.lines){
  if(line.lineId!==undefined){if(!text(line.lineId)||ids.has(line.lineId))throw Error('Invalid ingredient line identity');ids.add(line.lineId)}
  if(line.groupId!==undefined&&(!text(line.groupId)||!groups.some(g=>g.id===line.groupId)||!line.lineId))throw Error('Invalid ingredient group reference');
 }
}
export function validateCookingSession(s:CookingSession):void {
 if(!s||s.version!==1||!text(s.id)||!text(s.recipeId)||!Number.isInteger(s.recipeRevision)||s.recipeRevision<1||!positive(s.servings)||!['active','completed'].includes(s.status)||typeof s.needsReview!=='boolean'||!Array.isArray(s.entries)||!Array.isArray(s.checked)||!Array.isArray(s.legacyMappings))throw Error('Invalid cooking session');
 const ids=new Set<string>();
 for(const e of s.entries){if(!e||!text(e.id)||!text(e.fingerprint)||ids.has(e.id)||e.lineId!==undefined&&e.lineId!==e.id)throw Error('Invalid cooking line');ids.add(e.id)}
 if(new Set(s.checked).size!==s.checked.length||s.checked.some(id=>!ids.has(id)))throw Error('Invalid cooking checklist reference');
 const legacy=s.entries.flatMap((e,index)=>e.lineId?[]:[{id:e.id,index,fingerprint:e.fingerprint}]);
 if(legacy.length!==s.legacyMappings.length||legacy.some((e,i)=>{const m=s.legacyMappings[i];return !m||m.id!==e.id||m.index!==e.index||m.fingerprint!==e.fingerprint}))throw Error('Invalid legacy cooking identities');
}
export function validateJournalBackup(tables:Record<string,unknown[]>,version=12){
 for(const recipe of (tables.recipeCards??[]) as Recipe[]){
  if(version<12&&(recipe.ingredientGroups!==undefined||recipe.lines.some(l=>l.groupId!==undefined)))throw Error('Cooking journal requires backup version 12');
  validateJournalRecipe(recipe);
 }
 for(const row of (tables.settings??[]) as {key:string;value:string}[]){if(!row.key.startsWith(COOKING_PREFIX))continue;
  if(version<12)throw Error('Cooking sessions require backup version 12');
  const s=JSON.parse(row.value) as CookingSession;validateCookingSession(s);
  if(row.key!==COOKING_PREFIX+s.recipeId)throw Error('Invalid cooking recipe association');
  // Stale recipe revisions and orphan sessions remain intact. Reconcile only on opening their recipe.
 }
}
