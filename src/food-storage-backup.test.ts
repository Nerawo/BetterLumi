import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {afterEach, expect, it} from 'vitest';
import {db, LumiDB, stamp, makeBackup, restoreBackup, SCHEMA_VERSION} from './db';
import {exportAll, restoreAll, BACKUP_VERSION, type PantryItem} from './domain';
import {FoodStorage, copyRecipeForBatch, batchRemainingNutrition} from './food-storage';
import type {FoodBatch, StorageTransaction} from './food-storage-model';

const store=new FoodStorage();
const temporary: LumiDB[]=[];
afterEach(async()=>{for(const t of db.tables)await t.clear();for(const d of temporary.splice(0))await d.delete()});
function ingredient():PantryItem{return {...stamp(),name:'Synthetic oats',nameZh:'',brand:'',basis:'100g',servingGrams:null,calories:300,protein:10,carbs:50,fat:5,consumptionUnit:{quantity:1,name:'scoop',amount:25,unit:'g'}}}
async function fixture(){
 const item=ingredient();await db.ingredients.put(item);await db.settings.put({key:'ingredientPreference:builtin-test',value:JSON.stringify({version:1,units:[{quantity:1,name:'bowl',amount:88,unit:'g'}],preferred:'bowl',archived:true})});
 const recipe={...stamp(),name:'Synthetic bowl',servings:1,lines:[{ingredientId:item.id,name:item.name,quantity:100,unit:'g',nutrition:{calories:300,protein:10,carbs:50,fat:5}}],instructions:'Keep',stickyNote:'Keep'};await db.table('recipeCards').put(recipe);
 const meal={...stamp(),date:'2026-10-28',category:'lunch',name:recipe.name,source:'recipe' as const,sourceId:recipe.id,quantity:1,unit:'serving',nutrition:{calories:150,protein:5,carbs:25,fat:2.5},baseNutrition:{calories:300,protein:10,carbs:50,fat:5},consumptionPercent:50,lines:recipe.lines,cookingNote:''};
 const id=stamp().id;await store.saveMealWithLeftovers({operationId:'initial-leftovers',meal,batchId:id,saveLeftovers:true});await store.saveMeal({operationId:'first-consumption',mealId:'first-meal',batchId:id,portion:{unit:'percent',quantity:50},date:'2026-10-28',category:'dinner'});
 let batch=(await store.batches.get(id))!;await store.convertToWeight({operationId:'weigh-current',batchId:id,expectedRevision:batch.revision,remainingGrams:125});batch=(await store.batches.get(id))!;
 return{item,recipe,meal,batch};
}
it('upgrades every v6 store in place, without changing any existing rows, IDs, preferences or snapshots',async()=>{
 await db.open();const name='food-storage-migration-'+crypto.randomUUID();const old=new Dexie(name);const schemas=Object.fromEntries(db.tables.filter(t=>!['foodBatches','inventoryTransactions'].includes(t.name)).map(t=>[t.name,[t.schema.primKey.src,...t.schema.indexes.map(i=>i.src)].join(',')]));
 expect(Object.keys(schemas)).toHaveLength(18);old.version(6).stores(schemas);
 const snapshots:Record<string,unknown[]>={};
 for(const table of old.tables){const row=table.name==='settings'?{key:'ingredientPreference:builtin-old',value:JSON.stringify({version:1,units:[{name:'piece',quantity:1,amount:50,unit:'g'}],preferred:'piece',archived:true})}:{...stamp(),name:'Historical '+table.name,date:'2020-01-01',nutrition:{calories:77,protein:null,carbs:0,fat:4},untouched:{values:[0,null,''],snapshot:'preserve exactly'}};await table.put(row);snapshots[table.name]=await table.toArray()}
 old.close();const updated=new LumiDB(name);temporary.push(updated);await updated.open();expect(updated.verno).toBe(7);expect(updated.name).toBe(name);
 for(const [name,rows]of Object.entries(snapshots))expect(await updated.table(name).toArray(),name).toEqual(rows);
 expect(await updated.foodBatches.count()).toBe(0);expect(await updated.inventoryTransactions.count()).toBe(0);expect(db.name).toBe('BetterLumi');
});
it('round trips v11 inventory, lineage, conversion history, meals, recipe snapshots and preferences exactly',async()=>{
 const {item,recipe,batch}=await fixture();const before=await exportAll();expect(before.version).toBe(11);expect(db.verno).toBe(7);expect(Object.keys(before.tables)).toHaveLength(20);
 await restoreAll(JSON.parse(JSON.stringify(before)));expect((await exportAll()).tables).toEqual(before.tables);expect(await db.ingredients.get(item.id)).toEqual(item);expect(await db.table('recipeCards').get(recipe.id)).toEqual(recipe);
 expect(batchRemainingNutrition((await store.batches.get(batch.id))!)).toEqual(batchRemainingNutrition(batch));
 const meal=(await store.meals.get('first-meal'))!;await store.deleteMeal({operationId:'delete-after-restore',mealId:meal.id,expectedRevision:meal.revision});expect((await store.batches.get(batch.id))!.remainingQuantity).toBe(250);
});
it.each([2,3,4,5,6,7,8,9])('accepts a valid v%s backup without inventory and preserves its historical records',async version=>{
 const item=ingredient();await db.ingredients.put(item);await db.settings.put({key:'language',value:'zh'});const old=await exportAll();old.version=version;delete old.tables.foodBatches;delete old.tables.inventoryTransactions;
 if(version===2){delete old.tables.recipeNotes;delete old.tables.goals}if(version<4)delete old.tables.recipeCategories;if(version<5){delete old.tables.exercisePlans;delete old.tables.exerciseOccurrences}if(version<6)delete old.tables.ingredientTags;
 await restoreAll(old);expect(await db.ingredients.get(item.id)).toEqual(item);expect(await db.settings.get('language')).toEqual({key:'language',value:'zh'});expect(await store.batches.count()).toBe(0);expect(await store.transactions.count()).toBe(0);expect(SCHEMA_VERSION).toBe(7);expect(BACKUP_VERSION).toBe(11);
});
it.each(['missing-table','negative-balance','invalid-nutrition','dangling-meal','dangling-source','cycle','broken-origin','bad-movement','duplicate-transaction','missing-history','wrong-total','wrong-consumption','lost-lock','downgrade'] as const)('rejects %s backup before changing any data',async defect=>{
 await fixture();const original=await exportAll(),bad=structuredClone(original);const b=(bad.tables.foodBatches as FoodBatch[])[0],tx=(bad.tables.inventoryTransactions as StorageTransaction[])[0];
 if(defect==='missing-table')delete bad.tables.foodBatches;
 if(defect==='negative-balance')b.remainingQuantity=-1;
 if(defect==='invalid-nutrition')b.totalNutrition.calories=Infinity;
 if(defect==='dangling-meal')(bad.tables.foodLogs as any[]).find(m=>m.storageConsumption).storageConsumption.batchId='missing';
 if(defect==='dangling-source')b.ingredients[0]={...b.ingredients[0],source:'batch',ingredientId:'missing',sourceBatchId:'missing',sourceFraction:.5};
 if(defect==='cycle')b.ingredients[0]={...b.ingredients[0],source:'batch',ingredientId:b.id,sourceBatchId:b.id,sourceFraction:.5};
 if(defect==='broken-origin')b.originMealId='missing';
 if(defect==='bad-movement')tx.movements[0].after=-1;
 if(defect==='duplicate-transaction')bad.tables.inventoryTransactions.push(structuredClone(tx));
 if(defect==='missing-history')bad.tables.inventoryTransactions=bad.tables.inventoryTransactions.filter(t=>(t as StorageTransaction).kind!=='leftovers');
 if(defect==='wrong-total')b.totalNutrition.calories=999;
 if(defect==='wrong-consumption')(bad.tables.foodLogs as any[]).find(m=>m.storageConsumption).nutrition.calories=999;
 if(defect==='lost-lock')b.everUsed=false;
 if(defect==='downgrade')bad.version=9;
 await expect(restoreAll(bad)).rejects.toThrow();expect((await exportAll()).tables).toEqual(original.tables);
});
it('rolls back a failed import transaction including all existing non-inventory data',async()=>{
 await fixture();const original=await exportAll();const hook=()=>{throw Error('Synthetic import write failure')};store.batches.hook('creating',hook);
 try{await expect(restoreAll(original)).rejects.toThrow('Synthetic import write failure')}finally{store.batches.hook('creating').unsubscribe(hook)}expect((await exportAll()).tables).toEqual(original.tables);
});
it('prevents the obsolete partial v1 helper from silently exporting or restoring around live inventory',async()=>{
 const empty=await makeBackup();await fixture();const before=await exportAll();await expect(makeBackup()).rejects.toThrow('full exportAll');await expect(restoreBackup(empty)).rejects.toThrow('full restoreAll');expect((await exportAll()).tables).toEqual(before.tables);
});
it('keeps derived batch source references and permanent locks through backups',async()=>{
 const {recipe}=await fixture();const sourceId=stamp().id,targetId=stamp().id;await store.makeBatch({operationId:'sauce',id:sourceId,name:'Sauce',preparedOn:'2026-10-28',ingredients:copyRecipeForBatch(recipe),cookedYieldGrams:600});await store.makeBatch({operationId:'pasta',id:targetId,name:'Pasta',preparedOn:'2026-10-28',ingredients:[{source:'batch',batchId:sourceId,portion:{unit:'g',quantity:200}},...copyRecipeForBatch(recipe)],cookedYieldGrams:800});
 const backup=await exportAll();await restoreAll(backup);expect((await store.batches.get(sourceId))!.everUsed).toBe(true);expect((await store.batches.get(targetId))!.ingredients[0].sourceBatchId).toBe(sourceId);
});
it('persists batches and inventory receipts across closing/reopening IndexedDB',async()=>{
 const name='food-storage-reopen-'+crypto.randomUUID();let database=new LumiDB(name);let service=new FoodStorage(database);const r={...stamp(),name:'Temporary',servings:1,lines:[{ingredientId:'temporary',name:'Temporary',quantity:1,unit:'g',nutrition:{calories:100,protein:0,carbs:25,fat:0}}],instructions:'',stickyNote:''};const input={operationId:'durable-create',id:'durable-batch',name:'Durable',preparedOn:'2026-10-28',ingredients:copyRecipeForBatch(r),cookedYieldGrams:200};await service.makeBatch(input);database.close();database=new LumiDB(name);temporary.push(database);service=new FoodStorage(database);await service.makeBatch(input);expect((await service.batches.get(input.id))!.remainingQuantity).toBe(200);expect(await service.transactions.count()).toBe(1);
});
