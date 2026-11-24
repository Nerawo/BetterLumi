import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,stamp,SCHEMA_VERSION} from './db';
import {recipes,foodLogs,exportAll,restoreAll,type Recipe,type RecipeLine} from './domain';
import {wholeRecipeNutrition,recipeServingLines} from './recipe-nutrition';
import {changeCookingServings,COOKING_PREFIX,identifyRecipeLines,reconcileCookingSession,removeIngredientGroup,validateJournalRecipe,validateCookingSession} from './cooking-journal';
import {openCookingSession,saveCookingSession} from './cooking-session';
import {FoodStorage} from './food-storage';
import {storedRecipeLine} from './recipe-storage';
const line=(patch:Partial<RecipeLine>={}):RecipeLine=>({ingredientId:'egg',name:'Egg',quantity:100,unit:'g',nutrition:{calories:70.123,protein:6,carbs:null,fat:0},...patch});
const recipe=(lines=[line()]):Recipe=>({...stamp(),name:'Journal',servings:2,lines,instructions:'Keep exact\n1. Cook.',stickyNote:'Keep note'});
afterEach(async()=>{for(const t of db.tables)await t.clear()});
it('assigns editor identities without mutating old lines; retains existing IDs and repeated names',()=>{
 const old=[line(),line({lineId:'existing'})],next=identifyRecipeLines(old);expect(old[0].lineId).toBeUndefined();expect(next[1].lineId).toBe('existing');expect(new Set(next.map(l=>l.lineId)).size).toBe(2);expect(identifyRecipeLines(next)).toEqual(next);
});
it('group ordering/removal and moving only affect metadata, never nutrition or scaling',()=>{
 const r=recipe(identifyRecipeLines([line(),line({source:'batch',sourceBatchId:'sauce',ingredientId:'sauce',quantityBasis:'g'})]));
 r.ingredientGroups=[{id:'a',name:'Sauce'},{id:'b',name:'Toppings'}];const before=wholeRecipeNutrition(r.lines);
 r.lines=r.lines.map(l=>({...l,groupId:'a'}));r.ingredientGroups.reverse();validateJournalRecipe(r);
 const moved=removeIngredientGroup(r,'a');expect(moved.lines.map(l=>l.groupId)).toEqual([undefined,undefined]);expect(moved.lines.map(l=>l.lineId)).toEqual(r.lines.map(l=>l.lineId));expect(wholeRecipeNutrition(moved.lines)).toEqual(before);expect(recipeServingLines(r,4)[0].quantity).toBe(200);
});
it('stable IDs preserve checks on reorder/group rename and clear them on quantity, unit or replacement',()=>{
 let r=recipe(identifyRecipeLines([line(),line({ingredientId:'pepper'})]));let s=reconcileCookingSession(r);s.checked=s.entries.map(e=>e.id);
 r={...r,revision:2,lines:[...r.lines].reverse(),ingredientGroups:[{id:'g',name:'Renamed'}]};let next=reconcileCookingSession(r,s);expect(new Set(next.checked)).toEqual(new Set(s.checked));
 for(const patch of [{quantity:101},{unit:'mL'},{ingredientId:'new'}, {nutrition:{calories:80,protein:6,carbs:null,fat:0}}]){next=reconcileCookingSession({...r,lines:[{...r.lines[0],...patch},r.lines[1]]},s);expect(next.checked).toEqual([r.lines[1].lineId])}
});
it('legacy mappings survive refresh, safely follow unique reorder, and reject ambiguous repeated lines',()=>{
 const r=recipe([line(),line({ingredientId:'pepper',name:'Pepper'})]);const s=reconcileCookingSession(r);s.checked=[s.entries[0].id];expect(reconcileCookingSession(r,s)).toEqual(s);
 const reordered=reconcileCookingSession({...r,revision:2,lines:[...r.lines].reverse()},s);expect(reordered.checked).toEqual(s.checked);
 const duplicates=recipe([line(),line()]),d=reconcileCookingSession(duplicates);d.checked=[d.entries[0].id];expect(reconcileCookingSession(duplicates,d).checked).toEqual(d.checked);
 const next=reconcileCookingSession({...duplicates,revision:2},d);expect(next.checked).toEqual([]);expect(next.needsReview).toBe(true);
});
it('promotes unique legacy identities on explicit save, and new/removed lines never inherit checks',()=>{
 const r=recipe(),s=reconcileCookingSession(r);s.checked=[s.entries[0].id];const permanent=identifyRecipeLines(r.lines),next=reconcileCookingSession({...r,revision:2,lines:permanent},s);expect(next.checked).toEqual([permanent[0].lineId]);
 const n=reconcileCookingSession({...r,revision:2,lines:[line({ingredientId:'different'})]},s);expect(n.checked).toEqual([]);
 expect(reconcileCookingSession({...r,revision:2,lines:[]},s).checked).toEqual([]);
});
it('serving changes require reset confirmation and leave original untouched on cancel',()=>{
 const s=reconcileCookingSession(recipe());s.checked=[s.entries[0].id];const before=structuredClone(s);expect(()=>changeCookingServings(s,4)).toThrow('Confirm');expect(s).toEqual(before);expect(changeCookingServings(s,4,true)).toMatchObject({servings:4,checked:[]});for(const n of [0,-1,NaN,Infinity])expect(()=>changeCookingServings(s,n,true)).toThrow();
});
it('sessions persist and finish independently per recipe without changing templates, inventory or meals',async()=>{
 const r=recipe(),other=recipe();await recipes.bulkPut([r,other]);await db.settings.put({key:'keep',value:'safe'});const before=await exportAll();let s=await openCookingSession(r);const otherSession=await openCookingSession(other);
 s=await saveCookingSession(s,{...s,checked:[s.entries[0].id]});db.close();await db.open();expect(await openCookingSession(r)).toEqual(s);expect(await openCookingSession(other)).toEqual(otherSession);
 await saveCookingSession(s,{...s,status:'completed'});const fresh=await openCookingSession(r);expect(fresh.id).not.toBe(s.id);expect(fresh.checked).toEqual([]);
 const after=await exportAll();for(const key of Object.keys(before.tables).filter(k=>k!=='settings'))expect(after.tables[key]).toEqual(before.tables[key]);expect(await db.settings.get('keep')).toEqual({key:'keep',value:'safe'});expect(SCHEMA_VERSION).toBe(7);expect(db.name).toBe('BetterLumi');expect(await foodLogs.count()).toBe(0);
});
it('rejects stale writes and injected failures without overwriting progress',async()=>{
 const r=recipe(),s=await openCookingSession(r),next=await saveCookingSession(s,{...s,checked:[s.entries[0].id]});await expect(saveCookingSession(s,{...s,servings:9})).rejects.toThrow('changed');expect(await openCookingSession(r)).toEqual(next);
 const fail=()=>{throw Error('injected')};db.settings.hook('updating',fail);try{await expect(saveCookingSession(next,{...next,checked:[]})).rejects.toThrow('injected')}finally{db.settings.hook('updating').unsubscribe(fail)}expect(await openCookingSession(r)).toEqual(next);
});
it('Backup 12 round trips grouped recipes and sessions exactly, retaining stale/orphan sessions',async()=>{
 const r=recipe(identifyRecipeLines([line()]));r.ingredientGroups=[{id:'a',name:'Sauce'}];r.lines[0].groupId='a';await recipes.put(r);await openCookingSession(r);const orphan=await openCookingSession(recipe());expect(orphan.recipeId).not.toBe(r.id);
 const backup=await exportAll();expect(backup.version).toBe(12);await restoreAll(JSON.parse(JSON.stringify(backup)));expect((await exportAll()).tables).toEqual(backup.tables);
});
it.each([2,3,4,5,6,7,8,9,10,11])('accepts supported Backup %s without new metadata',async version=>{
 const r=recipe();await recipes.put(r);const backup=await exportAll();backup.version=version;
 if(version===2){delete backup.tables.recipeNotes;delete backup.tables.goals}if(version<4)delete backup.tables.recipeCategories;if(version<5){delete backup.tables.exercisePlans;delete backup.tables.exerciseOccurrences}if(version<6)delete backup.tables.ingredientTags;if(version<10){delete backup.tables.foodBatches;delete backup.tables.inventoryTransactions}
 await restoreAll(backup);expect(await recipes.get(r.id)).toEqual(r);
});
it('rejects invalid journal backup data before any writes',async()=>{
 const r=recipe(identifyRecipeLines([line()]));r.ingredientGroups=[{id:'a',name:'Sauce'}];r.lines[0].groupId='a';await recipes.put(r);await openCookingSession(r);const before=await exportAll();
 const mutations=[(b:any)=>b.tables.recipeCards[0].ingredientGroups.push({id:'a',name:'Duplicate'}),(b:any)=>b.tables.recipeCards[0].lines[0].groupId='missing',(b:any)=>b.tables.recipeCards[0].lines.push(b.tables.recipeCards[0].lines[0]),(b:any)=>b.version=11];
 for(const patch of [{servings:0},{checked:['missing']},{recipeId:'wrong'},{legacyMappings:[{id:'bad',index:0,fingerprint:'x'}]}])mutations.push((b:any)=>{const row=b.tables.settings.find((s:any)=>s.key.startsWith(COOKING_PREFIX));row.value=JSON.stringify({...JSON.parse(row.value),...patch})});
 for(const mutate of mutations){const bad=structuredClone(before);mutate(bad);await expect(restoreAll(bad)).rejects.toThrow();expect((await exportAll()).tables).toEqual(before.tables)}
});
it('validates all group and session shapes',()=>{
 expect(()=>validateJournalRecipe({...recipe(),ingredientGroups:[{id:'',name:'Bad'}]})).toThrow();const s=reconcileCookingSession(recipe());expect(()=>validateCookingSession({...s,entries:[...s.entries,...s.entries]})).toThrow();
});
it('retains invalid session data until explicit restart and preserves unrelated settings',async()=>{
 const r=recipe();await recipes.put(r);await db.settings.put({key:COOKING_PREFIX+r.id,value:'invalid'});await db.settings.put({key:'unrelated',value:'keep'});
 await expect(openCookingSession(r)).rejects.toThrow();expect((await db.settings.get(COOKING_PREFIX+r.id))!.value).toBe('invalid');
 const fresh=await openCookingSession(r,true);expect(fresh.checked).toEqual([]);expect(await recipes.get(r.id)).toEqual(r);expect(await db.settings.get('unrelated')).toEqual({key:'unrelated',value:'keep'});
});
it('accepts Backup 11 mixed stored-food templates with exact frozen snapshots and no deduction',async()=>{
 const storage=new FoodStorage(),batchId=stamp().id;
 await storage.makeBatch({operationId:stamp().id,id:batchId,name:'Stored sauce',preparedOn:'2026-11-23',cookedYieldGrams:400,ingredients:[{source:'pantry',line:line()}]});
 const r=recipe([line(),storedRecipeLine((await db.foodBatches.get(batchId))!)]);await recipes.put(r);
 const backup=await exportAll();backup.version=11;await restoreAll(backup);expect((await exportAll()).tables).toEqual(backup.tables);expect(await recipes.get(r.id)).toEqual(r);expect((await db.foodBatches.get(batchId))!.remainingQuantity).toBe(400);
});
