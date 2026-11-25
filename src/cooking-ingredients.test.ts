import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,stamp,recipes,foodLogs,exportAll,restoreAll,type Recipe,type RecipeLine,type FoodLog} from './domain';
import {COOKING_PREFIX,replaceCookingIngredient,addCookingIngredient,removeCookingIngredient,visibleCookingEntries,changeCookingServings,setCookingQuantity,resetCookingPreparation,reconcileCookingSession,validateCookingSession} from './cooking-journal';
import {openCookingSession,saveCookingSession,updateRecipeFromCooking,updateCookingMethod} from './cooking-session';
import {effectiveCookingRecipe,changeCookingUnit,requantifyLine} from './cooking-effective';
import {recipeServingNutrition,wholeRecipeNutrition} from './recipe-nutrition';
import {FoodStorage,recipeBatchInputs} from './food-storage';
import {storedRecipeLine} from './recipe-storage';
const line=(id:string,quantity=100):RecipeLine=>({lineId:id,ingredientId:id,name:'Repeated ingredient',quantity,unit:'g',nutrition:{calories:quantity,protein:quantity/10,carbs:quantity/5,fat:0}});
const makeRecipe=():Recipe=>({...stamp(),name:'Preparation',servings:2,lines:[line('a'),line('b',200)],instructions:'Keep method',stickyNote:'Keep notes',photo:'',categoryIds:[]});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
async function setup(){const r=makeRecipe();await recipes.put(r);const s=await openCookingSession(r);return {r,s}}
async function source(){const storage=new FoodStorage(),id=stamp().id;await storage.makeBatch({operationId:stamp().id,id,name:'Sauce',preparedOn:'2030-01-01',cookedYieldGrams:1000,ingredients:[{source:'pantry',line:line('sauce',1000)}]});return {storage,id,batch:(await db.foodBatches.get(id))!}}
it('adds duplicate names with unique stable identities and removes exact original or temporary lines without template/stock writes',async()=>{
 const {r,s}=await setup(),before=await exportAll();let next=addCookingIngredient(addCookingIngredient(s,line('new',12.125)),line('new',30));const [a,b,c,d]=visibleCookingEntries(next).map(e=>e.id);expect(new Set([a,b,c,d]).size).toBe(4);next={...setCookingQuantity(next,c,14.123456,'g'),checked:[a,c,d]};next=removeCookingIngredient(next,c);expect(next.checked).toEqual([a,d]);expect(next.quantityOverrides).toEqual([]);expect(next.ingredientChanges!.addedLines).toHaveLength(1);next=removeCookingIngredient(next,b);expect(effectiveCookingRecipe(r,next).lines.map(l=>l.quantity)).toEqual([100,30]);expect((await exportAll()).tables).toEqual(before.tables);
});
it('removed middle rows never transfer quantity overrides to the next ingredient',async()=>{
 const {r,s}=await setup();let next=addCookingIngredient(removeCookingIngredient(s,'a'),line('new',50));const added=visibleCookingEntries(next)[1].id;next=setCookingQuantity(setCookingQuantity(next,'b',250.125,'g'),added,0,'g');const effective=effectiveCookingRecipe(r,next);expect(effective.lines.map(l=>[l.lineId,l.quantity])).toEqual([['b',250.125],[added,0]]);expect(wholeRecipeNutrition(effective.lines).calories).toBeCloseTo(250.125,12);
});
it('empty preparation stays empty, cannot overwrite the template, and resets to saved ingredients',async()=>{
 const {r,s}=await setup(),empty=await saveCookingSession(s,removeCookingIngredient(removeCookingIngredient(s,'a'),'b')),before=await exportAll();expect(effectiveCookingRecipe(r,empty).lines).toEqual([]);await expect(updateRecipeFromCooking(r,empty)).rejects.toThrow('requires ingredients');expect((await exportAll()).tables).toEqual(before.tables);expect(effectiveCookingRecipe(r,resetCookingPreparation(r,empty)).lines).toEqual(r.lines);
});
it('promotes only surviving legacy identities on explicit template update, including repeated names',async()=>{
 const r=makeRecipe();r.lines=r.lines.map(({lineId:_,...l})=>l);await recipes.put(r);const s=await openCookingSession(r),keep=s.entries[1].id;let next=addCookingIngredient(removeCookingIngredient(s,s.entries[0].id),line('new',12.125));const added=next.ingredientChanges!.addedLines[0].entryId;next=await saveCookingSession(s,{...next,checked:[keep,added]});expect((await recipes.get(r.id))!.lines.every(l=>l.lineId===undefined)).toBe(true);const saved=await updateRecipeFromCooking(r,next);expect(saved.recipe.lines.map(l=>l.lineId)).toEqual([keep,added]);expect(saved.session.checked).toEqual([keep,added]);expect(effectiveCookingRecipe(saved.recipe,saved.session).lines.map(l=>l.quantity)).toEqual([200,12.125]);
});
it('scales added snapshots from their explicit yield, clears absolute overrides on serving confirmation, and resets complete preparation',async()=>{
 const {r,s}=await setup();let next=addCookingIngredient(changeCookingServings(s,4),line('new',20));next={...removeCookingIngredient(next,'b'),checked:['a']};const id=next.ingredientChanges!.addedLines[0].entryId;next=setCookingQuantity(next,id,30.125,'g');expect(()=>changeCookingServings(next,8)).toThrow();next=changeCookingServings(next,8,true);expect(effectiveCookingRecipe(r,next).lines.map(l=>l.quantity)).toEqual([400,40]);expect(next.quantityOverrides).toEqual([]);const reset=resetCookingPreparation(r,next);expect(effectiveCookingRecipe(r,reset).lines.map(l=>l.quantity)).toEqual([100,200]);expect(reset.servings).toBe(2);expect(reset.checked).toEqual([]);expect(reset.ingredientChanges).toEqual({addedLines:[],removedEntries:[]});
});
it('retains reorders/group moves, invalidates removal on replacement, and moves temporary lines out of deleted groups',async()=>{
 const {r,s}=await setup();r.ingredientGroups=[{id:'g',name:'Group'}];let next=addCookingIngredient(removeCookingIngredient(s,'b'),{...line('new'),groupId:'g'});const id=next.ingredientChanges!.addedLines[0].entryId;next={...setCookingQuantity(next,id,150.123,'g'),checked:[id]};const moved={...r,revision:2,lines:[...r.lines].reverse().map(l=>({...l,groupId:'g'}))};const reconciled=reconcileCookingSession(moved,next);expect(reconciled.ingredientChanges!.removedEntries.map(e=>e.entryId)).toEqual(['b']);expect(reconciled.quantityOverrides).toEqual(next.quantityOverrides);const replacement={...moved,revision:3,ingredientGroups:[],lines:moved.lines.map(l=>({...l,groupId:undefined,...(l.lineId==='b'?{ingredientId:'replaced'}:{})}))},changed=reconcileCookingSession(replacement,reconciled);expect(changed.ingredientChanges!.removedEntries).toEqual([]);expect(changed.ingredientChanges!.addedLines[0].line.groupId).toBeUndefined();expect(changed.checked).toEqual([id]);expect(changed.needsReview).toBe(true);
});
it('updates a mixed effective recipe atomically, normalizes serving basis, preserves IDs/metadata/checks and leaves inventory/history unchanged',async()=>{
 const {r,s}=await setup(),f=await source();let next=addCookingIngredient(removeCookingIngredient(changeCookingServings(s,4),'b'),storedRecipeLine(f.batch));const id=next.ingredientChanges!.addedLines[0].entryId;next={...setCookingQuantity(next,id,150.125,'g'),checked:['a',id]};next=await saveCookingSession(s,next);const before=await exportAll(),effective=effectiveCookingRecipe(r,next);const saved=await updateRecipeFromCooking(r,next);expect(saved.recipe.lines.map(l=>[l.lineId,l.quantity])).toEqual([['a',100],[id,75.0625]]);expect(saved.recipe.instructions).toBe(r.instructions);expect(saved.recipe.stickyNote).toBe(r.stickyNote);expect(saved.recipe.id).toBe(r.id);expect(saved.recipe.lines[1].sourceBatchId).toBe(f.id);expect(saved.session.checked).toEqual(['a',id]);expect(saved.session.ingredientChanges).toEqual({addedLines:[],removedEntries:[]});expect(saved.session.quantityOverrides).toEqual([]);expect(effectiveCookingRecipe(saved.recipe,saved.session).lines).toEqual(effective.lines);const after=await exportAll();for(const key of Object.keys(before.tables).filter(k=>!['recipeCards','settings'].includes(k)))expect(after.tables[key]).toEqual(before.tables[key]);
});
it('Method-only save preserves complete v3 state and session reopening does not discard valid additions',async()=>{
 const {r,s}=await setup();const next=await saveCookingSession(s,{...addCookingIngredient(removeCookingIngredient(s,'b'),line('new',12.125)),checked:['a']});const saved=await updateCookingMethod(r,next,'New method');expect(saved.session).toEqual({...next,recipeRevision:saved.recipe.revision});expect(await openCookingSession(saved.recipe)).toEqual(saved.session);expect(await openCookingSession(saved.recipe,true)).toMatchObject({version:2,checked:[],quantityOverrides:[]});
});
it('new actual meal snapshots and batches consume only visible positive sources and return only those allocations',async()=>{
 const {r,s}=await setup(),f=await source();let next=addCookingIngredient(removeCookingIngredient(s,'a'),storedRecipeLine(f.batch));const id=next.ingredientChanges!.addedLines[0].entryId;next=setCookingQuantity(next,id,200,'g');const effective=effectiveCookingRecipe(r,next),lines=effective.lines.map(l=>({...l,quantity:l.quantity/2,nutrition:{...l.nutrition,calories:l.nutrition.calories!/2,protein:l.nutrition.protein!/2,carbs:l.nutrition.carbs!/2}}));const meal:FoodLog={...stamp(),source:'recipe',sourceId:r.id,name:r.name,date:'2030-01-02',category:'lunch',quantity:1,unit:'serving',lines,nutrition:recipeServingNutrition(effective,1),consumptionPercent:100,cookingNote:''};await f.storage.saveRecipeMeal({operationId:stamp().id,meal});expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(900);expect((await foodLogs.get(meal.id))!.lines.map(l=>l.lineId)).toEqual(['b',id]);const saved=(await foodLogs.get(meal.id))!;await f.storage.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(1000);const batchId=stamp().id;await f.storage.makeBatch({operationId:stamp().id,id:batchId,name:'New preparation',preparedOn:'2030-01-02',ingredients:recipeBatchInputs(effective.lines),cookedYieldGrams:400});expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(800);expect((await db.foodBatches.get(batchId))!.totalNutrition).toEqual(wholeRecipeNutrition(effective.lines));await f.storage.cancelBatch({operationId:stamp().id,batchId,expectedRevision:1});expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(1000);
});
it('zero remains an ingredient; removed ingredients are absent and never allocate',async()=>{
 const {r,s}=await setup(),f=await source();let next=addCookingIngredient(removeCookingIngredient(s,'a'),storedRecipeLine(f.batch));const id=next.ingredientChanges!.addedLines[0].entryId;next=setCookingQuantity(next,id,0,'g');const effective=effectiveCookingRecipe(r,next);expect(effective.lines.map(l=>l.quantity)).toEqual([200,0]);const batchId=stamp().id;await f.storage.makeBatch({operationId:stamp().id,id:batchId,name:'Zero source',preparedOn:'2030-01-01',cookedYieldGrams:200,ingredients:recipeBatchInputs(effective.lines)});expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(1000);expect((await db.foodBatches.get(batchId))!.ingredients).toHaveLength(2);expect((await db.foodBatches.get(f.id))!.everUsed).toBe(false);
});
it('insufficient mixed sources roll back and retry operation IDs never duplicate deductions',async()=>{
 const {r,s}=await setup(),a=await source(),b=await source();let next=addCookingIngredient(addCookingIngredient(s,storedRecipeLine(a.batch)),storedRecipeLine(b.batch));const ids=next.ingredientChanges!.addedLines.map(a=>a.entryId);next=setCookingQuantity(setCookingQuantity(next,ids[0],100,'g'),ids[1],2000,'g');let before=await exportAll();const id=stamp().id;await expect(a.storage.makeBatch({operationId:stamp().id,id,name:'Rollback',preparedOn:'2030-01-01',cookedYieldGrams:400,ingredients:recipeBatchInputs(effectiveCookingRecipe(r,next).lines)})).rejects.toThrow();expect((await exportAll()).tables).toEqual(before.tables);next=setCookingQuantity(next,ids[1],200,'g');const input={operationId:stamp().id,id,name:'Retry',preparedOn:'2030-01-01',cookedYieldGrams:400,ingredients:recipeBatchInputs(effectiveCookingRecipe(r,next).lines)};await a.storage.makeBatch(input);await a.storage.makeBatch(input);expect((await db.foodBatches.get(a.id))!.remainingQuantity).toBe(900);expect((await db.foodBatches.get(b.id))!.remainingQuantity).toBe(800);
});
it('template update rollback preserves complete v3 state',async()=>{
 const {r,s}=await setup(),next=await saveCookingSession(s,addCookingIngredient(removeCookingIngredient(s,'a'),line('new'))),before=await exportAll(),fail=()=>{throw Error('Injected v3 failure')};db.settings.hook('updating',fail);try{await expect(updateRecipeFromCooking(r,next)).rejects.toThrow()}finally{db.settings.hook('updating').unsubscribe(fail)}expect((await exportAll()).tables).toEqual(before.tables);
});
it('Backup 15 imports v3 exact sources, decimals, removals and checks; invalid structures reject before writes',async()=>{
 const {r,s}=await setup(),f=await source();let next=addCookingIngredient(removeCookingIngredient(s,'b'),storedRecipeLine(f.batch));const id=next.ingredientChanges!.addedLines[0].entryId;next=await saveCookingSession(s,{...setCookingQuantity(next,id,12.123456,'g'),checked:['a',id]});const backup=await exportAll();expect(backup.version).toBe(16);backup.version=15;await restoreAll(JSON.parse(JSON.stringify(backup)));expect((await exportAll()).tables).toEqual(JSON.parse(JSON.stringify(backup.tables)));expect(await openCookingSession(r)).toEqual(next);const reopened=await exportAll();
 const mutations=[(b:any)=>b.version=14,(b:any)=>b.tables.settings.find((r:any)=>r.key===COOKING_PREFIX+next.recipeId).value=JSON.stringify({...next,ingredientChanges:{...next.ingredientChanges,extra:true}}),(b:any)=>{const bad=structuredClone(next);bad.ingredientChanges!.addedLines[0].line.sourceBatchId='missing';bad.ingredientChanges!.addedLines[0].line.ingredientId='missing';b.tables.settings.find((r:any)=>r.key===COOKING_PREFIX+next.recipeId).value=JSON.stringify(bad)},(b:any)=>{const bad=structuredClone(next);bad.checked.push('b');b.tables.settings.find((r:any)=>r.key===COOKING_PREFIX+next.recipeId).value=JSON.stringify(bad)}];for(const mutate of mutations){const bad=structuredClone(backup);mutate(bad);await expect(restoreAll(bad)).rejects.toThrow();expect((await exportAll()).tables).toEqual(reopened.tables)}
 for(const quantity of [-1,NaN,Infinity]){const bad=structuredClone(next);bad.ingredientChanges!.addedLines[0].line.quantity=quantity;expect(()=>validateCookingSession(bad)).toThrow()}
});
it('valid Backup 14 zeros, groups and precise v2 overrides import without upgrade or rewriting',async()=>{
 const r=makeRecipe();r.ingredientGroups=[{id:'g',name:'Group'}];r.lines=r.lines.map((l,i)=>({...requantifyLine(l,i===0?0:l.quantity),groupId:'g'}));await recipes.put(r);const original=await openCookingSession(r),s=await saveCookingSession(original,{...setCookingQuantity(original,'b',12.123456,'g'),checked:['b']}),backup=await exportAll();backup.version=14;await restoreAll(backup);expect((await db.settings.get(COOKING_PREFIX+r.id))!.value).toBe(JSON.stringify(s));expect((await recipes.get(r.id))).toEqual(r);expect(effectiveCookingRecipe(r,s).lines.map(l=>l.quantity)).toEqual([0,12.123456]);
});
it.each([2,3,4,5,6,7,8,9,10,11,12,13,14,15])('continues accepting positive ungrouped Backup %s',async version=>{
 const r=makeRecipe();await recipes.put(r);const backup=await exportAll();backup.version=version;if(version===2){delete backup.tables.recipeNotes;delete backup.tables.goals}if(version<4)delete backup.tables.recipeCategories;if(version<5){delete backup.tables.exercisePlans;delete backup.tables.exerciseOccurrences}if(version<6)delete backup.tables.ingredientTags;if(version<10){delete backup.tables.foodBatches;delete backup.tables.inventoryTransactions}await restoreAll(backup);expect(await recipes.get(r.id)).toEqual(r);
});

it('replaces in place across repeated picks, group moves, restore, and normalized template update',async()=>{
 const r=makeRecipe();r.ingredientGroups=[{id:'g',name:'Group'}];r.lines[0].groupId='g';
 await recipes.put(r);const first=await openCookingSession(r);
 const batch=await source();
 let s=changeCookingServings(first,4);
 s=addCookingIngredient(s,{...line('temporary'),groupId:'g'},'extra');
 s={...setCookingQuantity(s,'a',99.125,'g'),checked:['a','b','extra']};
 s=replaceCookingIngredient(s,'a',line('first choice',110));
 s=replaceCookingIngredient(s,'a',storedRecipeLine(batch.batch));
 s=replaceCookingIngredient(s,'extra',line('second choice',7));
 expect(s.checked).toEqual(['b']);expect(s.quantityOverrides).toEqual([]);
 expect(s.ingredientChanges!.replacements).toHaveLength(1);
 s=await saveCookingSession(first,setCookingQuantity(s,'a',50.125,'g'));
 const actual=effectiveCookingRecipe(r,s);
 expect(actual.lines.map(l=>[l.lineId,l.ingredientId,l.groupId])).toEqual([['a',batch.id,'g'],['b','b',undefined],['extra','second choice','g']]);
 expect(actual.lines[0].nutrition.calories).toBe(50.125);expect(actual.lines[0].quantity).toBe(50.125);
 const backup=await exportAll();expect(backup.version).toBe(16);
 await expect(restoreAll({...backup,version:15})).rejects.toThrow('version 16');
 await restoreAll(JSON.parse(JSON.stringify(backup)));const reopened=await openCookingSession(r);expect(reopened).toEqual(s);s=reopened;
 const changed={...r,revision:r.revision+1,lines:[r.lines[1],{...r.lines[0],groupId:undefined}]};
 expect(effectiveCookingRecipe(changed,reconcileCookingSession(changed,s)).lines[1]).toMatchObject({lineId:'a',ingredientId:batch.id,groupId:undefined});
 changed.lines[1]={...changed.lines[1],ingredientId:'other'};
 expect(reconcileCookingSession(changed,s).ingredientChanges!.replacements).toEqual([]);
 expect(effectiveCookingRecipe(r,resetCookingPreparation(r,s)).lines).toEqual(r.lines);
 expect(effectiveCookingRecipe(r,removeCookingIngredient(s,'a')).lines.map(l=>l.lineId)).toEqual(['b','extra']);
 const saved=await updateRecipeFromCooking(r,s);
 expect(saved.recipe.lines[0]).toMatchObject({ingredientId:batch.id,lineId:'a',groupId:'g',quantity:25.0625});
 expect(saved.session.checked).toEqual(['b']);expect(effectiveCookingRecipe(saved.recipe,saved.session).lines).toEqual(actual.lines);
 expect((await db.foodBatches.get(batch.id))!.remainingQuantity).toBe(1000);expect(await foodLogs.count()).toBe(0);
});

it('replacement sources flow through positive allocations, overdraw rollback, cancellation and inventory return',async()=>{
 const {r,s}=await setup(),f=await source(),second=await source();
 let prepared=replaceCookingIngredient(replaceCookingIngredient(s,'a',storedRecipeLine(f.batch)),'b',storedRecipeLine(second.batch));
 prepared=setCookingQuantity(setCookingQuantity(prepared,'a',99.125,'g'),'b',1100,'g');
 const inputs=()=>recipeBatchInputs(effectiveCookingRecipe(r,prepared).lines);
 const batch={operationId:stamp().id,id:stamp().id,name:'Test',preparedOn:'2030-01-01',cookedYieldGrams:300};
 const before=await exportAll();await expect(f.storage.makeBatch({...batch,ingredients:inputs()})).rejects.toThrow();
 expect((await exportAll()).tables).toEqual(before.tables);
 prepared=setCookingQuantity(prepared,'b',0,'g');const effective=effectiveCookingRecipe(r,prepared);
 await f.storage.makeBatch({...batch,ingredients:inputs()});
 expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(900.875);
 expect((await db.foodBatches.get(second.id))!.remainingQuantity).toBe(1000);
 await f.storage.cancelBatch({operationId:stamp().id,batchId:batch.id,expectedRevision:1});
 const meal:FoodLog={...stamp(),source:'recipe',sourceId:r.id,name:r.name,date:'2030-01-01',category:'lunch',quantity:2,unit:'serving',lines:effective.lines,nutrition:wholeRecipeNutrition(effective.lines),consumptionPercent:100,cookingNote:''};
 await f.storage.saveRecipeMeal({operationId:stamp().id,meal});expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(900.875);
 expect((await foodLogs.get(meal.id))!.recipeAllocations).toHaveLength(1);
 await f.storage.deleteMeal({operationId:stamp().id,mealId:meal.id,expectedRevision:1});
 expect((await db.foodBatches.get(f.id))!.remainingQuantity).toBe(1000);
});

it('rejects forged replacement references, duplicate slots, invalid quantity bases and missing batches before import',async()=>{
 const {r,s}=await setup(),f=await source(),next=await saveCookingSession(s,replaceCookingIngredient(s,'a',storedRecipeLine(f.batch)));
 const backup=await exportAll();
 for(const fault of ['fingerprint','id','duplicate','servings','missing batch','extra field']){
  const invalid=structuredClone(next),rows=invalid.ingredientChanges!.replacements!,row=rows[0];
  if(fault==='fingerprint')row.fingerprint+='!';
  if(fault==='id')row.entryId='missing';
  if(fault==='duplicate')rows.push({...row});
  if(fault==='servings')row.servings=0;
  if(fault==='missing batch')row.line.ingredientId=row.line.sourceBatchId='missing';
  if(fault==='extra field')Object.assign(row,{order:1});
  const bad=structuredClone(backup);(bad.tables.settings as {key:string;value:string}[]).find(x=>x.key===COOKING_PREFIX+r.id)!.value=JSON.stringify(invalid);
  await expect(restoreAll(bad)).rejects.toThrow();expect((await exportAll()).tables).toEqual(backup.tables);
 }
});

it('converts session quantities on their own yield basis, retaining checks, absolute overrides and nutrition across backup',async()=>{
 const {r,s}=await setup(),factors=new Map([['g',.01],['piece',.25]]);
 const original={...setCookingQuantity(changeCookingServings(s,4),'a',150.5,'g'),checked:['a']};
 expect(()=>changeCookingUnit(r,original,'a','mL',factors)).toThrow();
 const changed=await saveCookingSession(s,changeCookingUnit(r,original,'a','piece',factors));
 expect(changed.checked).toEqual(['a']);
 const effective=effectiveCookingRecipe(r,changed).lines[0];
 expect(effective.quantity).toBeCloseTo(6.02);expect(effective.unit).toBe('piece');
 const priorNutrition=effectiveCookingRecipe(r,original).lines[0].nutrition;
 for(const key of ['calories','carbs','protein','fat'] as const)expect(effective.nutrition[key]).toBeCloseTo(priorNutrition[key]!,12);
 expect(effectiveCookingRecipe(r,{...changed,quantityOverrides:[]}).lines[0].quantity).toBe(8);
 expect((await recipes.get(r.id))!.lines[0].unit).toBe('g');
 const backup=await exportAll();await restoreAll(backup);
 expect(effectiveCookingRecipe(r,await openCookingSession(r))).toEqual(effectiveCookingRecipe(r,changed));
});
