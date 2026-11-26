import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,stamp,recipes,foodLogs,exportAll,restoreAll,type Recipe,type FoodLog} from './domain';
import {effectiveCookingRecipe,requantifyLine} from './cooking-effective';
import {wholeRecipeNutrition} from './recipe-nutrition';
import {openCookingSession,saveCookingSession,updateRecipeFromCooking} from './cooking-session';
import {setCookingQuantity,reconcileCookingSession} from './cooking-journal';
import {FoodStorage,recipeBatchInputs} from './food-storage';
import {storedRecipeLine} from './recipe-storage';
const n={calories:100,protein:null,carbs:10,fat:0};
const recipe=():Recipe<import("./domain").RecipeLine>=>({...stamp(),name:'Actual preparation',servings:6,lines:[{lineId:'a',groupId:'g',ingredientId:'a',name:'Pasta',quantity:480,unit:'g',nutrition:n},{lineId:'b',ingredientId:'b',name:'Pasta',quantity:400,unit:'g',nutrition:n}],ingredientGroups:[{id:'g',name:'Sauce'}],instructions:'Keep method',stickyNote:'Keep notes',photo:'photo',categoryIds:['category']});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('effective quantities use exact overrides, zero defeats unknown, and repeated names remain independent',()=>{
 const r=recipe();let s=reconcileCookingSession(r);s=setCookingQuantity(s,'a',600.125,'g');s=setCookingQuantity(s,'b',0,'g');const actual=effectiveCookingRecipe(r,s);expect(actual.lines.map(l=>l.quantity)).toEqual([600.125,0]);expect(wholeRecipeNutrition(actual.lines)).toEqual({calories:600.125/480*100,protein:null,carbs:600.125/480*10,fat:0});expect(wholeRecipeNutrition([actual.lines[1]])).toEqual({calories:0,protein:0,carbs:0,fat:0});expect(r.lines[0].quantity).toBe(480);expect(requantifyLine(actual.lines[1],800).nutrition).toEqual({calories:200,protein:null,carbs:20,fat:0});
 const reordered={...r,revision:2,lines:[r.lines[1],r.lines[0]].map(l=>({...l,groupId:undefined}))},next=reconcileCookingSession(reordered,s);expect(effectiveCookingRecipe(reordered,next).lines.map(l=>l.quantity)).toEqual([0,600.125]);
});
it('rejects arithmetic overflow before a snapshot or template can be persisted',()=>{const line={...recipe().lines[0],quantity:1e-300};expect(()=>requantifyLine(line,1e300)).toThrow();expect(()=>requantifyLine(line,Infinity)).toThrow();expect(()=>requantifyLine(line,-1)).toThrow()});
it('normalizes template amounts and atomically reconciles checks without inventory or metadata changes',async()=>{
 const r=recipe();await recipes.put(r);let s=await openCookingSession(r,true);s=await saveCookingSession(s,{...s,servings:12});s=await saveCookingSession(s,{...setCookingQuantity(setCookingQuantity(s,'a',1000,'g'),'b',0,'g'),checked:['a','b']});const before=await exportAll();const next=await updateRecipeFromCooking(r,s);expect(next.recipe.lines.map(l=>l.quantity)).toEqual([500,0]);expect({...next.recipe,lines:r.lines,revision:r.revision,updatedAt:r.updatedAt}).toEqual(r);expect(next.session.checked).toEqual(['a','b']);expect(next.session.quantityOverrides).toEqual([]);expect(effectiveCookingRecipe(next.recipe,next.session).lines.map(l=>l.quantity)).toEqual([1000,0]);expect(await foodLogs.count()).toBe(0);const after=await exportAll();for(const key of Object.keys(before.tables).filter(k=>!['settings','recipeCards'].includes(k)))expect(after.tables[key]).toEqual(before.tables[key]);
});
it('template/session failure rolls both writes back, rejects stale writers',async()=>{
 const r=recipe();await recipes.put(r);let s=await openCookingSession(r,true);s=await saveCookingSession(s,setCookingQuantity(s,'a',600,'g'));const before=await exportAll(),fail=()=>{throw Error('Injected failure')};db.settings.hook('updating',fail);try{await expect(updateRecipeFromCooking(r,s)).rejects.toThrow()}finally{db.settings.hook('updating').unsubscribe(fail)}expect((await exportAll()).tables).toEqual(before.tables);await recipes.put({...r,revision:2});await expect(updateRecipeFromCooking(r,s)).rejects.toThrow();
});
it('mixed zero sources survive Backup 14, never allocate/return unused inventory; positive sources remain atomic',async()=>{
 const storage=new FoodStorage(),source=stamp().id;await storage.makeBatch({operationId:stamp().id,id:source,name:'Sauce',preparedOn:'2026-11-01',cookedYieldGrams:1000,ingredients:[{source:'pantry',line:recipe().lines[0]}]});const batch=(await db.foodBatches.get(source))!;const r=recipe();r.lines=[{...storedRecipeLine(batch),lineId:'used',quantity:100,nutrition:{calories:10,protein:null,carbs:1,fat:0}},{...requantifyLine({...storedRecipeLine(batch),lineId:'unused'},0)},{...r.lines[0],quantity:0,nutrition:{calories:null,protein:null,carbs:null,fat:null}}];r.ingredientGroups=undefined;r.lines=r.lines.map(l=>({...l,groupId:undefined}));await recipes.put(r);
 const meal:FoodLog={...stamp(),date:'2030-01-01',category:'lunch',source:'recipe',sourceId:r.id,name:r.name,quantity:1,unit:'serving',lines:r.lines,cookingNote:'',nutrition:n,consumptionPercent:100};await storage.saveRecipeMeal({operationId:stamp().id,meal});const saved=(await foodLogs.get(meal.id))!;expect(saved.recipeAllocations).toHaveLength(1);expect(saved.lines).toHaveLength(3);expect((await db.foodBatches.get(source))!.remainingQuantity).toBe(900);const child=stamp().id;await storage.makeBatch({operationId:stamp().id,id:child,name:'Prepared',preparedOn:'2026-11-01',cookedYieldGrams:300,ingredients:recipeBatchInputs(r.lines)});expect((await db.foodBatches.get(child))!.ingredients.map(l=>l.quantity)).toEqual([100,0,0]);expect((await db.foodBatches.get(child))!.totalNutrition.calories).toBe(10);const backup=await exportAll();expect(backup.version).toBe(20);await restoreAll(JSON.parse(JSON.stringify(backup)));expect((await exportAll()).tables).toEqual(backup.tables);await storage.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});expect((await db.foodBatches.get(source))!.remainingQuantity).toBe(900);await storage.cancelBatch({operationId:stamp().id,batchId:child,expectedRevision:1});expect((await db.foodBatches.get(source))!.remainingQuantity).toBe(1000);
 const bad=structuredClone(backup);const row=(bad.tables.foodLogs as FoodLog[]).find(m=>m.id===saved.id)!;row.recipeAllocations![0].quantity=0;await expect(restoreAll(bad)).rejects.toThrow();
});
it('imports valid positive Backup 13 and rejects zero extensions under old version labels',async()=>{const r=recipe();await recipes.put(r);const b=await exportAll();b.version=13;await restoreAll(b);expect(await recipes.get(r.id)).toEqual(r);(b.tables.recipeCards as Recipe[])[0].lines[0].quantity=0;await expect(restoreAll(b)).rejects.toThrow()});
it('zero-only sources never lock, allocate or enter source history, including cancellation and receipt rollback',async()=>{
 const storage=new FoodStorage(),source=stamp().id;await storage.makeBatch({operationId:stamp().id,id:source,name:'Unused sauce',preparedOn:'2026-11-01',cookedYieldGrams:100,ingredients:[{source:'pantry',line:recipe().lines[0]}]});const zero=requantifyLine(storedRecipeLine((await db.foodBatches.get(source))!),0),meal:FoodLog={...stamp(),name:'Zero',date:'2030-01-01',category:'lunch',source:'recipe',sourceId:null,quantity:1,unit:'serving',lines:[zero],nutrition:n,cookingNote:''};await storage.saveRecipeMeal({operationId:stamp().id,meal});const saved=(await foodLogs.get(meal.id))!;expect(saved.recipeAllocations).toEqual([]);expect(saved.nutrition).toEqual({calories:0,protein:0,carbs:0,fat:0});await storage.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});const id=stamp().id,request={operationId:stamp().id,id,name:'Zero composition',preparedOn:'2026-11-01',cookedYieldGrams:100,ingredients:recipeBatchInputs([zero])};const before=await exportAll(),fail=()=>{throw Error('receipt failure')};db.inventoryTransactions.hook('creating',fail);try{await expect(storage.makeBatch(request)).rejects.toThrow()}finally{db.inventoryTransactions.hook('creating').unsubscribe(fail)}expect((await exportAll()).tables).toEqual(before.tables);await storage.makeBatch(request);await storage.makeBatch(request);const child=(await db.foodBatches.get(id))!,unchanged=await exportAll();await expect(storage.correctFormula({operationId:stamp().id,batchId:id,expectedRevision:1,cookedYieldGrams:100,ingredients:child.ingredients.map(l=>({...l,ingredientId:'missing',sourceBatchId:'missing'}))})).rejects.toThrow();expect((await exportAll()).tables).toEqual(unchanged.tables);await storage.cancelBatch({operationId:stamp().id,batchId:id,expectedRevision:1});const sourceAfter=(await db.foodBatches.get(source))!;expect(sourceAfter.remainingQuantity).toBe(100);expect(sourceAfter.everUsed).toBe(false);const history=await db.inventoryTransactions.toArray();expect(history.filter(t=>t.batchIds.includes(source))).toHaveLength(1);const b=await exportAll();await restoreAll(b);expect((await exportAll()).tables).toEqual(b.tables);
});
it('legacy line identities promote only on explicit update and zero reference validation rejects unknown fields',async()=>{
 const r=recipe();delete r.lines[0].lineId;r.lines[0].groupId=undefined;await recipes.put(r);let s=await openCookingSession(r,true);const id=s.entries[0].id;s=await saveCookingSession(s,{...setCookingQuantity(s,id,0,'g'),checked:[id]});const updated=await updateRecipeFromCooking(r,s);expect(updated.recipe.lines[0].lineId).toBe(id);expect(updated.session.checked).toEqual([id]);if(updated.recipe.lines[0].source==="family")throw Error("Expected concrete food");expect(requantifyLine(updated.recipe.lines[0],480).nutrition).toEqual(n);const b=await exportAll();((b.tables.recipeCards as Recipe[])[0].lines[0].zeroQuantityReference as any).arbitrary='reject';await expect(restoreAll(b)).rejects.toThrow();
});
it('editing positive to zero returns only its original allocation; zero to positive and deletion remain exact',async()=>{
 const storage=new FoodStorage(),id=stamp().id;await storage.makeBatch({operationId:stamp().id,id,name:'Source',preparedOn:'2026-11-01',cookedYieldGrams:100,ingredients:[{source:'pantry',line:recipe().lines[0]}]});const line=storedRecipeLine((await db.foodBatches.get(id))!),meal:FoodLog={...stamp(),name:'Portion',date:'2030-01-01',category:'lunch',source:'recipe',sourceId:null,quantity:1,unit:'serving',consumptionPercent:50,lines:[line],nutrition:n,cookingNote:''};await storage.saveRecipeMeal({operationId:stamp().id,meal});let saved=(await foodLogs.get(meal.id))!;expect((await db.foodBatches.get(id))!.remainingQuantity).toBe(50);await storage.saveRecipeMeal({operationId:stamp().id,expectedRevision:saved.revision,meal:{...saved,lines:[requantifyLine(line,0)]}});saved=(await foodLogs.get(meal.id))!;expect(saved.recipeAllocations).toEqual([]);expect((await db.foodBatches.get(id))!.remainingQuantity).toBe(100);await storage.saveRecipeMeal({operationId:stamp().id,expectedRevision:saved.revision,meal:{...saved,lines:[requantifyLine(saved.lines[0],20)]}});saved=(await foodLogs.get(meal.id))!;expect((await db.foodBatches.get(id))!.remainingQuantity).toBe(90);await storage.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});expect((await db.foodBatches.get(id))!.remainingQuantity).toBe(100);
});
it('Pantry-only zero snapshots retain unknown references but require zero consumed nutrition on backup restore',async()=>{
 const r=recipe();r.lines=r.lines.map(l=>({...l,quantity:0,nutrition:{calories:null,protein:null,carbs:null,fat:null}}));await recipes.put(r);const meal:FoodLog={...stamp(),name:'Zero meal',date:'2030-01-01',category:'lunch',source:'recipe',sourceId:r.id,quantity:1,unit:'serving',lines:r.lines,nutrition:{calories:0,protein:0,carbs:0,fat:0},cookingNote:''};await foodLogs.add(meal);const b=await exportAll();await restoreAll(b);expect((await exportAll()).tables).toEqual(b.tables);const bad=structuredClone(b);(bad.tables.foodLogs as FoodLog[])[0].nutrition.calories=1;await expect(restoreAll(bad)).rejects.toThrow();expect((await exportAll()).tables).toEqual(b.tables);expect(await db.inventoryTransactions.count()).toBe(0);
});

it('seeds the complete adjusted meal preparation at its yield, retaining zero, additions and removals',async()=>{
 const saved=recipe();
 const addition={...saved.lines[1],lineId:'new',ingredientId:'extra',quantity:12.375};
 const session=await openCookingSession(saved,true,{baseline:saved,servings:3,lines:[requantifyLine(saved.lines[0],0),addition]});
 const result=effectiveCookingRecipe(saved,session);
 expect(result.servings).toBe(3);
 expect(result.lines.map(l=>[l.lineId,l.quantity])).toEqual([['a',0],['new',12.375]]);
 expect(session.ingredientChanges?.removedEntries.map(r=>r.entryId)).toEqual(['b']);
 expect(await foodLogs.count()).toBe(0);
 expect(await db.inventoryTransactions.count()).toBe(0);
});
it('preserves legacy duplicate identities in the draft and rejects stale initialization atomically',async()=>{
 const saved=recipe();saved.lines=[saved.lines[1],saved.lines[1]].map(l=>({...l,lineId:undefined}));
 const baseline={...saved,lines:saved.lines.map((l,i)=>({...l,lineId:'draft-'+i}))};
 const session=await openCookingSession(saved,true,{baseline,servings:1.5,lines:[requantifyLine(baseline.lines[1],67.125)]});
 expect(effectiveCookingRecipe(saved,session).lines.map(l=>[l.lineId,l.quantity])).toEqual([['draft-1',67.125]]);
 expect(session.legacyMappings.map(m=>m.id)).toEqual(['draft-0','draft-1']);
 const before=await db.settings.toArray();
 await expect(openCookingSession({...saved,revision:2},true,{baseline,servings:1.5,lines:[]})).rejects.toThrow();
 expect(await db.settings.toArray()).toEqual(before);
});

it('carries a replacement nutrition snapshot even when the source ID and unit still match',async()=>{
 const saved=recipe(),line={...saved.lines[0],nutrition:{...n,calories:234.5625}};

 const session=await openCookingSession(saved,true,{baseline:saved,servings:6,lines:[line]});
 const actual=effectiveCookingRecipe(saved,session).lines[0];
 expect(actual.nutrition).toEqual(line.nutrition);
 expect(actual.lineId).toBe(line.lineId);
 expect(saved.lines[0].nutrition.calories).toBe(100);
});
