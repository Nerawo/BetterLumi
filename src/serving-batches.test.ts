import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,stamp} from './db';
import {exportAll,restoreAll,type FoodLog} from './domain';
import {FoodStorage} from './food-storage';
import {type FoodBatch,type StorageTransaction} from './food-storage-model';
import {initialConsumptionAmount} from './storage-consumption-ui';
import {storedRecipeLine} from './recipe-storage';

const storage=new FoodStorage(), date='2026-11-27';
const total={calories:1185,protein:23,carbs:170,fat:45};
const line={ingredientId:'cocoa',name:'Brownie',quantity:100,unit:'g',nutrition:total};
const nextId=()=>stamp().id;
async function make(mode:FoodBatch['mode'],size=5){
  const id=nextId();
  await storage.makeBatch({id,operationId:nextId(),mode,preparedOn:date,name:'Brownie',ingredients:[{source:'pantry',line}],...(mode==='weight'?{cookedYieldGrams:size}:mode==='servings'?{totalServings:size}:{})});
  return id;
}
const batch=async(id:string)=>(await storage.batches.get(id))!;
async function eat(id:string,unit:'percent'|'serving',quantity:number){
  const mealId=nextId();
  await storage.saveMeal({operationId:nextId(),mealId,batchId:id,date,category:'dinner',portion:{unit,quantity}});
  return (await storage.meals.get(mealId))!;
}
async function repack(id:string,count:number){
  await storage.repartition({operationId:nextId(),batchId:id,expectedRevision:(await batch(id)).revision,totalServings:count});
}
async function roundTrip(){
 const data=await exportAll();expect(data.version).toBe(21);await restoreAll(JSON.parse(JSON.stringify(data)));expect((await exportAll()).tables).toEqual(data.tables);return data;
}
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('keeps packing separate from composition, derives per-serving snapshots, refunds and reconciles above output',async()=>{
 const id=await make('servings',4);
 await repack(id,5);
 expect(await batch(id)).toMatchObject({totalNutrition:total,totalServings:5,fractionPerUnit:.2,remainingQuantity:5,originalCookedYield:null});
 const first=await eat(id,'serving',1);
 expect(first).toMatchObject({quantity:1,unit:'serving',nutrition:{calories:237},storageConsumption:{originalFraction:.2}});
 for(const key of ['calories','protein','carbs','fat'] as const)expect(first.nutrition[key]).toBeCloseTo(total[key]/5,12);
 expect((await batch(id)).remainingQuantity).toBe(4);
 const second=await eat(id,'serving',.5);
 expect(second).toMatchObject({quantity:.5,nutrition:{calories:118.5},storageConsumption:{originalFraction:.1}});
 expect((await batch(id)).remainingQuantity).toBe(3.5);
 await roundTrip();
 await expect(eat(id,'serving',4)).rejects.toMatchObject({code:'OVERDRAW'});
 await expect(repack(id,6)).rejects.toMatchObject({code:'LOCKED'});
 await storage.adjustRemaining({operationId:nextId(),batchId:id,expectedRevision:(await batch(id)).revision,quantity:5,reason:'count'});
 await storage.deleteMeal({operationId:nextId(),mealId:second.id,expectedRevision:second.revision});
 expect(await batch(id)).toMatchObject({remainingQuantity:5.5,totalServings:5,fractionPerUnit:.2});
 await make('weight',600);await make('ratio');
 const data=await roundTrip();
 (data.tables.foodBatches as FoodBatch[]).find(b=>b.id===id)!.remainingQuantity=6;
 await expect(restoreAll(data)).rejects.toThrow();
 expect((await storage.meals.get(first.id))!.nutrition).toEqual(first.nutrition);
 await eat(id,'serving',5.5);expect(await batch(id)).toMatchObject({remainingQuantity:0,archiveReason:'exhausted'});
});
it('uses original batch percentages after restore and rolls back overdraw',async()=>{
 const id=await make('ratio');
 expect((await eat(id,'percent',25)).nutrition.calories).toBe(296.25);
 await roundTrip();
 expect((await eat(id,'percent',50)).nutrition.calories).toBe(592.5);
 expect((await batch(id)).remainingQuantity).toBe(.25);
 const before=await exportAll();await expect(eat(id,'percent',50)).rejects.toMatchObject({code:'OVERDRAW'});
 expect((await exportAll()).tables).toEqual(before.tables);
 await eat(id,'percent',25);expect((await batch(id)).remainingQuantity).toBe(0);
});
it('respects legacy evidence after restore, including opaque receipts, and refunds the actual share',async()=>{
 const meal:FoodLog={...stamp(),date,source:'recipe',sourceId:null,category:'lunch',name:'Origin',quantity:1,unit:'serving',consumptionPercent:25,baseNutrition:total,nutrition:{calories:296.25,protein:5.75,carbs:42.5,fat:11.25},cookingNote:'',lines:[line]};
 const id=nextId();await storage.saveMealWithLeftovers({operationId:nextId(),meal,batchId:id,saveLeftovers:true});
 const consumed=await eat(id,'percent',50), fraction=consumed.storageConsumption!.originalFraction;
 expect(fraction).toBe(.375);expect(consumed.nutrition.calories).toBe(444.375);
 const receipt={mealId:consumed.id,transactionId:consumed.storageConsumption!.transactionId};
 await roundTrip();
 const read=async()=>initialConsumptionAmount(await batch(id),.66,fraction,await storage.transactions.toArray(),undefined,undefined,receipt);
 expect(await read()).toBe('50');
 const legacy=await exportAll();legacy.version=20;
 (legacy.tables.inventoryTransactions as StorageTransaction[]).find(tx=>tx.id===receipt.transactionId)!.request='opaque';
 await restoreAll(legacy);expect(await read()).toBe('');
 expect((await batch(id)).remainingQuantity).toBe(.375);
 await storage.deleteMeal({operationId:nextId(),mealId:consumed.id,expectedRevision:consumed.revision});
 expect((await batch(id)).remainingQuantity).toBe(.75);
});
it('locks portions after a refunded meal, inventory count or downstream preparation',async()=>{
 const a=await make('servings'),b=await make('servings'),c=await make('servings');
 const meal=await eat(a,'serving',1);await storage.deleteMeal({operationId:nextId(),mealId:meal.id,expectedRevision:meal.revision});
 await storage.adjustRemaining({operationId:nextId(),batchId:b,expectedRevision:1,quantity:5,reason:'recount'});
 await storage.makeBatch({id:nextId(),operationId:nextId(),mode:'ratio',name:'Child',preparedOn:date,ingredients:[{source:'batch',batchId:c,portion:{unit:'fraction',quantity:.2}}]});
 for(const id of [a,b,c])await expect(repack(id,6)).rejects.toMatchObject({code:'LOCKED'});
 const recipeLine=storedRecipeLine(await batch(c));expect(recipeLine.unit).toBe('fraction');
 await roundTrip();
});

it('atomic failure rolls back both repartition and actual meal writes',async()=>{
 const id=await make('servings',4),before=await exportAll();
 const interrupt=()=>{throw Error('injected receipt failure')};storage.transactions.hook('creating',interrupt);
 try{
   await expect(repack(id,5)).rejects.toThrow('injected receipt failure');
   await expect(eat(id,'serving',1)).rejects.toThrow('injected receipt failure');
 }finally{storage.transactions.hook('creating').unsubscribe(interrupt)}
 expect((await exportAll()).tables).toEqual(before.tables);
});
it('retains the per-serving basis after template use and allocates template fractions in actual servings',async()=>{
 const {saveFamilyRecipe}=await import('./families');
 const id=await make('servings',5);
 const template={...stamp(),name:'Mix',instructions:'',stickyNote:'',servings:1,lines:[{...storedRecipeLine(await batch(id)),quantity:.2,nutrition:{calories:237,protein:4.6,carbs:34,fat:9}}]};
 await saveFamilyRecipe(template);
 await expect(repack(id,3)).rejects.toMatchObject({code:'LOCKED'});
 const meal:FoodLog={...stamp(),date,source:'recipe',sourceId:template.id,category:'lunch',name:template.name,quantity:1,unit:'serving',nutrition:template.lines[0].nutrition,cookingNote:'',lines:template.lines};
 await storage.saveRecipeMeal({operationId:nextId(),meal});
 expect((await storage.meals.get(meal.id))?.recipeAllocations?.[0]).toMatchObject({batchId:id,quantity:1,unit:'serving',originalFraction:.2});
 expect((await batch(id)).remainingQuantity).toBe(4);
 await roundTrip();
});
it.each(['zero','infinity','null','factor','legacy','disconnected'] as const)('rejects invalid serving data before restore writes: %s',async defect=>{
 const id=await make('servings',2.5),before=await exportAll(),bad=structuredClone(before);
 const b=(bad.tables.foodBatches as FoodBatch[]).find(b=>b.id===id)!;
 if(defect==='zero')b.totalServings=0;
 if(defect==='infinity')b.totalServings=Infinity;
 if(defect==='null')Object.assign(b,{totalServings:null});
 if(defect==='factor')b.fractionPerUnit=.5;
 if(defect==='legacy')bad.version=20;
 if(defect==='disconnected')(bad.tables.inventoryTransactions as StorageTransaction[])[0].movements=[];
 await expect(restoreAll(bad)).rejects.toThrow();
 expect((await exportAll()).tables).toEqual(before.tables);
});

it.each([10,11,12,13,14,15,16,17,18,19,20])('imports legacy v%s leftovers with no packing inference',async version=>{
 const meal:FoodLog={...stamp(),date,category:'lunch',source:'recipe',sourceId:null,name:'Leftover',quantity:1,unit:'serving',nutrition:{calories:0,protein:0,carbs:0,fat:0},baseNutrition:total,consumptionPercent:0,lines:[line],cookingNote:''};
 const id=nextId();await storage.saveMealWithLeftovers({operationId:nextId(),meal,batchId:id,saveLeftovers:true});
 const data=await exportAll();data.version=version;
 await restoreAll(data);
 await eat(id,'percent',25);const half=await eat(id,'percent',50);
 expect(half.storageConsumption!.originalFraction).toBe(.375);
 expect(await batch(id)).toMatchObject({mode:'ratio',remainingQuantity:.375});
 expect((await batch(id)).totalServings).toBeUndefined();
});
