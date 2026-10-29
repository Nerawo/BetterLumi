import {test,expect} from '@playwright/test';
test.use({browserName:'webkit',channel:'',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
test('native IndexedDB upgrades v6 in place without changing historical values',async({page})=>{
 await page.goto('/today');
 const result=await page.evaluate(async()=>{
  const {LumiDB,stamp}=await import('/src/db.ts');const name='food-storage-browser-migration-'+crypto.randomUUID();const schema=new LumiDB(name);
  const oldTables=schema.tables.filter(t=>!['foodBatches','inventoryTransactions'].includes(t.name));
  const original=Object.fromEntries(oldTables.map(t=>[t.name,t.name==='settings'?{key:'ingredientPreference:builtin-old',value:'{"version":1,"units":[],"preferred":"g","archived":true}'}:{...stamp(),name:'Historical '+t.name,nutrition:{calories:77,protein:null,carbs:0,fat:4},nested:{retain:[null,0,'']}}]));
  const old=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name,60);request.onupgradeneeded=()=>{for(const table of oldTables){const store=request.result.createObjectStore(table.name,{keyPath:table.schema.primKey.keyPath});for(const index of table.schema.indexes)store.createIndex(index.name,index.keyPath,{unique:index.unique,multiEntry:index.multi});store.put(original[table.name])}};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});old.close();
  try{await schema.open();const after=Object.fromEntries(await Promise.all(oldTables.map(async t=>[t.name,(await schema.table(t.name).toArray())[0]])));return{original,after,version:schema.verno,batches:await schema.foodBatches.count(),transactions:await schema.inventoryTransactions.count()}}finally{await schema.delete()}
 });expect(result.version).toBe(7);expect(result.after).toEqual(result.original);expect(result.batches).toBe(0);expect(result.transactions).toBe(0);
});
test('inventory, nutrition snapshots and retry receipts survive reload and a backup round trip',async({page})=>{
 await page.goto('/today');
 const before=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts');const s=new FoodStorage();
  await d.db.settings.put({key:'storage-synthetic-guard',value:'Keep'});
  const input={operationId:'browser-create',id:'browser-batch',name:'Synthetic prepared food',preparedOn:'2026-10-28',ingredients:[{source:'pantry' as const,line:{ingredientId:'synthetic',name:'Synthetic ingredient',quantity:100,unit:'g',nutrition:{calories:600,protein:30,carbs:60,fat:20}}}],cookedYieldGrams:600};
  await s.makeBatch(input);const meal={operationId:'browser-consume',mealId:'browser-meal',batchId:input.id,portion:{unit:'g' as const,quantity:150},date:'2026-10-28',category:'lunch'};await s.saveMeal(meal);await s.saveMeal(meal);return(await d.exportAll()).tables;
 });await page.reload();
 const after=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts');const snapshot=await d.exportAll();await d.restoreAll(JSON.parse(JSON.stringify(snapshot)));const s=new FoodStorage();const preserved=(await d.exportAll()).tables;const m=(await s.meals.get('browser-meal'))!;await s.deleteMeal({operationId:'browser-delete',mealId:m.id,expectedRevision:m.revision});return{version:snapshot.version,preserved,batch:await s.batches.get('browser-batch'),guard:await d.db.settings.get('storage-synthetic-guard')};
 });expect(after.version).toBe(10);expect(after.preserved).toEqual(before);expect(after.batch!.remainingQuantity).toBe(600);expect(after.batch!.everUsed).toBe(true);expect(after.guard!.value).toBe('Keep');
});
