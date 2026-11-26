import type {Recipe,RecipeLine,TemplateLine} from './domain';
import {validZeroReference} from './line-nutrition';
import {newId} from './ids';

export interface IngredientGroup {id:string;name:string}
export const COOKING_PREFIX='cooking-session:v1:';
export interface CookingEntry {id:string;lineId?:string;fingerprint:string}
export interface CookingQuantityOverride {entryId:string;quantity:number;unit:string;fingerprint:string;servings:number}
export interface CookingIngredientChanges {
 addedLines:{entryId:string;line:RecipeLine;servings:number}[];
 replacements?:{entryId:string;fingerprint:string;line:RecipeLine;servings:number}[];
 removedEntries:{entryId:string;fingerprint:string}[];
}
export interface CookingSession {
 version:1|2|3|4;ingredientChanges?:CookingIngredientChanges;quantityOverrides?:CookingQuantityOverride[];id:string;recipeId:string;recipeRevision:number;servings:number;
 entries:CookingEntry[];checked:string[];legacyMappings:{id:string;index:number;fingerprint:string}[];
 status:'active'|'completed';needsReview:boolean;
}
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
/** Organizational metadata deliberately excluded: moving/renaming groups cannot invalidate progress. */
export const cookingFingerprint=(l:TemplateLine)=>l.source==="family"?JSON.stringify(["family",l.familyId,null,null,"",l.quantity,l.unit]):JSON.stringify([l.source??'pantry',l.ingredientId,l.sourceBatchId??null,l.quantityBasis??null,l.name,l.quantity,l.unit,l.nutrition,...(l.zeroQuantityReference?[l.zeroQuantityReference]:[])]);
export function identifyRecipeLines<L extends TemplateLine>(lines:L[]):L[]{
 const seen=new Set<string>();return lines.map(l=>{const id=l.lineId&&!seen.has(l.lineId)?l.lineId:newId();seen.add(id);return {...l,lineId:id}});
}
export function recipeSections<L extends TemplateLine>(recipe:{lines:L[];ingredientGroups?:IngredientGroup[]}){
 const groups=recipe.ingredientGroups??[],known=new Set(groups.map(g=>g.id));
 return [{id:'',name:'',lines:recipe.lines.filter(l=>!l.groupId||!known.has(l.groupId))},...groups.map(g=>({...g,lines:recipe.lines.filter(l=>l.groupId===g.id)}))];
}
export function removeIngredientGroup<L extends TemplateLine>(recipe:{lines:L[];ingredientGroups?:IngredientGroup[]},id:string){
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
  if(legacy.some(p=>active?.ingredientChanges?.replacements?.some(r=>r.entryId===p.id)))return false;
  if(e.lineId&&legacy.length>1&&legacy.some(p=>active?.checked.includes(p.id)))ambiguous=true;
  return !!e.lineId&&legacy.length===1&&entries.filter(x=>x.fingerprint===e.fingerprint).length===1&&!!active?.checked.includes(legacy[0].id);
 }).map(e=>e.id);
 const replacements=active?.ingredientChanges?.replacements?.filter(r=>entries.some(e=>e.id===r.entryId&&e.fingerprint===r.fingerprint));
 const changes=active?.ingredientChanges?{...(replacements?{replacements}:{}),addedLines:active.ingredientChanges!.addedLines.filter(a=>!entries.some(e=>e.id===a.entryId)).map(a=>({...a,line:{...a.line,...(a.line.groupId&&!recipe.ingredientGroups?.some(g=>g.id===a.line.groupId)?{groupId:undefined}:{})}})),removedEntries:active.ingredientChanges!.removedEntries.filter(r=>entries.some(e=>e.id===r.entryId&&e.fingerprint===r.fingerprint))}:undefined;
 const visible=visibleCookingEntries({entries,ingredientChanges:changes});
 const quantityOverrides=(active?.quantityOverrides??[]).filter(o=>visible.some(e=>e.id===o.entryId&&e.fingerprint===o.fingerprint));
 return {version:active?.version===4?4:changes?3:2,...(changes?{ingredientChanges:changes}:{}),quantityOverrides,id:active?.id??newId(),recipeId:recipe.id,recipeRevision:recipe.revision,
  servings:active?.servings??(recipe.servings||1),entries,checked:[...checked.filter(id=>visible.some(e=>e.id===id)),...(changes?.addedLines.filter(a=>active?.checked.includes(a.entryId)).map(a=>a.entryId)??[])],
  legacyMappings:entries.flatMap((e,index)=>e.lineId?[]:[{id:e.id,index,fingerprint:e.fingerprint}]),
  status:'active',needsReview:replacements?.length!==active?.ingredientChanges?.replacements?.length||ambiguous||!!active?.needsReview||!!changes&&(changes.addedLines.length!==active!.ingredientChanges!.addedLines.length||changes.removedEntries.length!==active!.ingredientChanges!.removedEntries.length)};
}
export function changeCookingServings(s:CookingSession,servings:number,confirmReset=false):CookingSession {
 if(!positive(servings))throw Error('Invalid serving quantity');
 if(servings===s.servings)return s;
 if((s.checked.length||s.quantityOverrides?.length||hasCookingIngredientChanges(s))&&!confirmReset)throw Error('Confirm checklist reset');
 return {...s,version:s.version===1?2:s.version,servings,checked:[],quantityOverrides:[]};
}
/** Absolute preparation quantities. Only explicit meal/batch/update actions apply them downstream. */
export function setCookingQuantity(s:CookingSession,entryId:string,quantity:number,unit:string):CookingSession {
 const entry=visibleCookingEntries(s).find(e=>e.id===entryId);
 if(!entry||!Number.isFinite(quantity)||quantity<0||JSON.parse(entry.fingerprint)[6]!==unit)throw Error('Invalid cooking quantity');
 const next:CookingSession={...s,version:s.version===1?2:s.version,quantityOverrides:[...(s.quantityOverrides??[]).filter(o=>o.entryId!==entryId),{entryId,quantity,unit,fingerprint:entry.fingerprint,servings:s.servings}]};
 validateCookingSession(next);return next;
}
export function restoreCookingQuantity(s:CookingSession,entryId:string):CookingSession {
 return {...s,version:s.version===1?2:s.version,quantityOverrides:(s.quantityOverrides??[]).filter(o=>o.entryId!==entryId)};
}
export function visibleCookingEntries(s:Pick<CookingSession,'entries'|'ingredientChanges'>):CookingEntry[]{
 return [...s.entries.filter(e=>!s.ingredientChanges?.removedEntries.some(r=>r.entryId===e.id)).map(e=>{
  const replacement=s.ingredientChanges?.replacements?.find(r=>r.entryId===e.id);
  return replacement?{...e,fingerprint:cookingFingerprint(replacement.line)}:e;
 }),...(s.ingredientChanges?.addedLines.map(a=>({id:a.entryId,lineId:a.entryId,fingerprint:cookingFingerprint(a.line)}))??[])];
}
export const hasCookingIngredientChanges=(s:CookingSession)=>!!(s.ingredientChanges?.replacements?.length||s.ingredientChanges?.addedLines.length||s.ingredientChanges?.removedEntries.length);
export function addCookingIngredient(s:CookingSession,line:RecipeLine,entryId=newId()):CookingSession{
 const next:CookingSession={...s,version:s.version===4?4:3,ingredientChanges:{...s.ingredientChanges,addedLines:[...(s.ingredientChanges?.addedLines??[]),{entryId,line:{...structuredClone(line),lineId:entryId},servings:s.servings}],removedEntries:s.ingredientChanges?.removedEntries??[]}};
 validateCookingSession(next);return next;
}
/** A recipe slot retains its original fingerprint across successive replacements.
 * Temporary rows already own their snapshot and retain their position in addedLines. */
export function replaceCookingIngredient(s:CookingSession,entryId:string,line:RecipeLine):CookingSession {
 if(!visibleCookingEntries(s).some(e=>e.id===entryId))throw Error('Unknown preparation ingredient');
 const changes=s.ingredientChanges??{addedLines:[],removedEntries:[]};
 const original=s.entries.find(e=>e.id===entryId);
 const {groupId:_,...source}=line;
 const snapshot={entryId,line:{...structuredClone(source),lineId:entryId},servings:s.servings};
 const replacements=(changes.replacements??[]).filter(r=>r.entryId!==entryId);
 if(original)replacements.push({...snapshot,fingerprint:original.fingerprint});
 const addedLines=changes.addedLines.map(a=>a.entryId===entryId?{...snapshot,line:{...snapshot.line,groupId:a.line.groupId}}:a);
 const next:CookingSession={...s,version:4,checked:s.checked.filter(id=>id!==entryId),
  quantityOverrides:(s.quantityOverrides??[]).filter(o=>o.entryId!==entryId),
  ingredientChanges:{...changes,addedLines,replacements}};
 validateCookingSession(next);
 return next;
}
export function removeCookingIngredient(s:CookingSession,entryId:string):CookingSession{
 const entry=visibleCookingEntries(s).find(e=>e.id===entryId);if(!entry)throw Error('Unknown preparation ingredient');
 const added=s.ingredientChanges?.addedLines??[],removed=s.ingredientChanges?.removedEntries??[];
 const next:CookingSession={...s,version:s.version===4?4:3,checked:s.checked.filter(id=>id!==entryId),quantityOverrides:(s.quantityOverrides??[]).filter(o=>o.entryId!==entryId),ingredientChanges:{...(s.ingredientChanges?.replacements?{replacements:s.ingredientChanges.replacements.filter(r=>r.entryId!==entryId)}:{}),addedLines:added.filter(a=>a.entryId!==entryId),removedEntries:added.some(a=>a.entryId===entryId)?removed:[...removed,{entryId,fingerprint:s.entries.find(e=>e.id===entryId)!.fingerprint}]}};
 validateCookingSession(next);return next;
}
export function resetCookingPreparation(recipe:Recipe,s:CookingSession):CookingSession{
 return reconcileCookingSession(recipe,{...s,servings:recipe.servings||1,checked:[],quantityOverrides:[],needsReview:false,...(s.version>=3?{ingredientChanges:{addedLines:[],removedEntries:[]}}:{})});
}
const keysOnly=(v:object,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
function validAddedLine(l:RecipeLine){
 return !!l&&keysOnly(l,['source','lineId','groupId','sourceBatchId','quantityBasis','ingredientId','name','quantity','unit','nutrition','zeroQuantityReference'])&&text(l.ingredientId)&&text(l.name)&&text(l.unit)&&l.unit.length<=40&&Number.isFinite(l.quantity)&&l.quantity>=0&&(l.groupId===undefined||text(l.groupId))&&(l.zeroQuantityReference===undefined||validZeroReference(l.zeroQuantityReference))&&!!l.nutrition&&Object.keys(l.nutrition).length===4&&['calories','protein','carbs','fat'].every(k=>{const n=l.nutrition[k as keyof typeof l.nutrition];return n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0})&&(l.source==='batch'?text(l.sourceBatchId)&&l.ingredientId===l.sourceBatchId&&((l.quantityBasis==='g'&&l.unit==='g')||(l.quantityBasis==='original-fraction'&&l.unit==='fraction')):(l.source===undefined||l.source==='pantry')&&l.sourceBatchId===undefined&&l.quantityBasis===undefined);
}
function validateIngredientChanges(s:CookingSession){
 if(s.version<3){if(s.ingredientChanges!==undefined)throw Error('Ingredient changes require Session v3');return}
 const c=s.ingredientChanges;if(!c||!keysOnly(c,s.version===4?['addedLines','removedEntries','replacements']:['addedLines','removedEntries'])||!Array.isArray(c.addedLines)||!Array.isArray(c.removedEntries))throw Error('Invalid ingredient changes');
 const ids=new Set(s.entries.map(e=>e.id)),removed=new Set<string>();
 for(const a of c.addedLines){if(!a||!keysOnly(a,['entryId','line','servings'])||!text(a.entryId)||ids.has(a.entryId)||!positive(a.servings)||!validAddedLine(a.line)||a.line.lineId!==a.entryId)throw Error('Invalid temporary ingredient');ids.add(a.entryId)}
 for(const r of c.removedEntries){if(!r||!keysOnly(r,['entryId','fingerprint'])||removed.has(r.entryId)||!s.entries.some(e=>e.id===r.entryId&&e.fingerprint===r.fingerprint))throw Error('Invalid removed ingredient');removed.add(r.entryId)}
 if(c.replacements!==undefined){
  if(!Array.isArray(c.replacements))throw Error('Invalid cooking replacements');
  const replaced=new Set<string>();
  for(const r of c.replacements){
   if(!r||!keysOnly(r,['entryId','line','servings','fingerprint'])||removed.has(r.entryId)||replaced.has(r.entryId)||
    !s.entries.some(e=>e.id===r.entryId&&e.fingerprint===r.fingerprint)||!positive(r.servings)||
    !validAddedLine(r.line)||r.line.lineId!==r.entryId||r.line.groupId!==undefined)throw Error('Invalid cooking replacement');
   replaced.add(r.entryId);
  }
 }
}
export function validateJournalRecipe(recipe:Pick<Recipe,'lines'|'ingredientGroups'>){
 const groups=recipe.ingredientGroups??[];
 if(!Array.isArray(groups)||groups.some(g=>!g||!text(g.id)||!text(g.name))||new Set(groups.map(g=>g.id)).size!==groups.length)throw Error('Invalid ingredient groups');
 const ids=new Set<string>();
 for(const line of recipe.lines){
  if(!Number.isFinite(line.quantity)||line.quantity<0||line.zeroQuantityReference!==undefined&&!validZeroReference(line.zeroQuantityReference))throw Error('Invalid recipe quantity reference');
  if(line.lineId!==undefined){if(!text(line.lineId)||ids.has(line.lineId))throw Error('Invalid ingredient line identity');ids.add(line.lineId)}
  if(line.groupId!==undefined&&(!text(line.groupId)||!groups.some(g=>g.id===line.groupId)||!line.lineId))throw Error('Invalid ingredient group reference');
 }
}
export function validateCookingSession(s:CookingSession):void {
 if(!s||![1,2,3,4].includes(s.version)||!text(s.id)||!text(s.recipeId)||!Number.isInteger(s.recipeRevision)||s.recipeRevision<1||!positive(s.servings)||!['active','completed'].includes(s.status)||typeof s.needsReview!=='boolean'||!Array.isArray(s.entries)||!Array.isArray(s.checked)||!Array.isArray(s.legacyMappings))throw Error('Invalid cooking session');
 const ids=new Set<string>();
 for(const e of s.entries){if(!e||!text(e.id)||!text(e.fingerprint)||ids.has(e.id)||e.lineId!==undefined&&e.lineId!==e.id)throw Error('Invalid cooking line');ids.add(e.id)}
 validateIngredientChanges(s);
 const visible=visibleCookingEntries(s);const visibleIds=new Set(visible.map(e=>e.id));
 if(new Set(s.checked).size!==s.checked.length||s.checked.some(id=>!visibleIds.has(id)))throw Error('Invalid cooking checklist reference');
 if(s.version===1&&s.quantityOverrides!==undefined||s.version>=2&&!Array.isArray(s.quantityOverrides))throw Error('Invalid cooking overrides');
 const overrideIds=new Set<string>();
 for(const o of s.quantityOverrides??[]){
  const entry=visible.find(e=>e.id===o?.entryId);
  if(!o||Object.keys(o).some(k=>!['entryId','quantity','unit','fingerprint','servings'].includes(k))||!entry||overrideIds.has(o.entryId)||typeof o.quantity!=='number'||!Number.isFinite(o.quantity)||o.quantity<0||!text(o.unit)||o.fingerprint!==entry.fingerprint||o.servings!==s.servings)throw Error('Invalid cooking quantity override');
  let source;try{source=JSON.parse(o.fingerprint)}catch{throw Error('Invalid cooking quantity source')}
  if(!Array.isArray(source)||source[6]!==o.unit)throw Error('Invalid cooking quantity unit');
  overrideIds.add(o.entryId);
 }
 const legacy=s.entries.flatMap((e,index)=>e.lineId?[]:[{id:e.id,index,fingerprint:e.fingerprint}]);
 if(legacy.length!==s.legacyMappings.length||legacy.some((e,i)=>{const m=s.legacyMappings[i];return !m||m.id!==e.id||m.index!==e.index||m.fingerprint!==e.fingerprint}))throw Error('Invalid legacy cooking identities');
}
export function validateJournalBackup(tables:Record<string,unknown[]>,version=17){
 for(const recipe of (tables.recipeCards??[]) as Recipe[]){
  if(version<12&&(recipe.ingredientGroups!==undefined||recipe.lines.some(l=>l.groupId!==undefined)))throw Error('Cooking journal requires backup version 12');
  validateJournalRecipe(recipe);
 }
 for(const row of (tables.settings??[]) as {key:string;value:string}[]){if(!row.key.startsWith(COOKING_PREFIX))continue;
  if(version<12)throw Error('Cooking sessions require backup version 12');
  const s=JSON.parse(row.value) as CookingSession;validateCookingSession(s);
  for(const entry of s.entries){
   if(!entry.fingerprint.startsWith('["family",'))continue;
   const fingerprint=JSON.parse(entry.fingerprint),id=fingerprint[1];
   if(fingerprint.length!==7||!text(id)||fingerprint[2]!==null||fingerprint[3]!==null||fingerprint[4]!==''||
     !Number.isFinite(fingerprint[5])||fingerprint[5]<0||!['g','mL'].includes(fingerprint[6])||!entry.lineId)throw Error('Invalid family slot');
   if(s.version!==4&&!s.ingredientChanges?.removedEntries.some(r=>r.entryId===entry.id))throw Error('Invalid cooking family session version');
   if(version<17||!(tables.ingredientFamilies as {id:string;deletedAt:string|null}[]|undefined)?.some(f=>f.id===id&&(!f.deletedAt||s.status!=='active')))throw Error('Invalid cooking family reference');
  }
  if(version<16&&s.version===4)throw Error('Cooking Session v4 requires backup version 16');
  if(version<15&&s.version===3)throw Error('Cooking Session v3 requires backup version 15');
  const recipe=(tables.recipeCards as Recipe[]).find(r=>r.id===s.recipeId);
  if(recipe?.revision===s.recipeRevision){
   for(const r of s.ingredientChanges?.replacements??[]){
    const entry=s.entries.find(e=>e.id===r.entryId)!;
    const base=entry.lineId?recipe.lines.find(l=>l.lineId===entry.lineId):recipe.lines[s.entries.indexOf(entry)];
    if(!base||cookingFingerprint(base)!==r.fingerprint)throw Error('Invalid replacement recipe source');
   }
  }
  for(const a of [...s.ingredientChanges?.addedLines??[],...s.ingredientChanges?.replacements??[]]){if(a.line.source==='batch'&&!(tables.foodBatches??[]).some(b=>(b as {id:string}).id===a.line.sourceBatchId))throw Error('Missing temporary source batch');if(recipe?.revision===s.recipeRevision&&a.line.groupId&&!recipe.ingredientGroups?.some(g=>g.id===a.line.groupId))throw Error('Invalid temporary ingredient group')}
  if(version<13&&s.version===2)throw Error('Cooking Session v2 requires backup version 13');
  if(row.key!==COOKING_PREFIX+s.recipeId)throw Error('Invalid cooking recipe association');
  // Stale recipe revisions and orphan sessions remain intact. Reconcile only on opening their recipe.
 }
}
