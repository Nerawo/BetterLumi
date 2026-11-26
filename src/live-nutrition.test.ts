import 'fake-indexeddb/auto';
import {afterEach, expect, it} from 'vitest';
import {db,recipes,stamp,exportAll,restoreAll,type PantryItem,type FoodLog,type RecipeLine} from './domain';
import {FoodStorage} from './food-storage';
import {livePreparation,needsUnitReview} from './live-nutrition';
import {familyCatalog} from './families';
import {recipeNutritionRange} from './recipe-nutrition-range';
import {openCookingSession,saveCookingSession} from './cooking-session';
import {effectiveCookingRecipe} from './cooking-effective';
import {setCookingQuantity} from './cooking-journal';
const store=new FoodStorage();
const date='2026-11-25';
afterEach(async()=>{for(const table of db.tables)await table.clear()});
function yogurt():PantryItem{return {...stamp(),name:'Fage',nameZh:'',brand:'',basis:'100g',referenceUnit:'g',servingGrams:null,calories:60,protein:8,carbs:4,fat:2}}
function line(item:PantryItem,quantity=100):RecipeLine{return {lineId:'fage-slot',ingredientId:item.id,name:item.name,quantity,unit:'g',nutrition:{calories:60*quantity/100,protein:8*quantity/100,carbs:4*quantity/100,fat:2*quantity/100}}}
async function consume(batchId:string){const mealId=stamp().id;await store.saveMeal({operationId:stamp().id,mealId,batchId,date,category:'lunch',portion:{unit:'g',quantity:100}});return (await store.meals.get(mealId))!}
it('uses current nutrition and restores two different concrete snapshots from the same stock',async()=>{
 const item=yogurt(),id=stamp().id;await db.ingredients.put(item);
 await store.registerStock({id,operationId:stamp().id,ingredientId:item.id,grams:350,date});
 const before=await consume(id);await db.ingredients.update(item.id,{calories:55});const after=await consume(id);
 expect(before.nutrition.calories).toBe(60);expect(after.nutrition.calories).toBeCloseTo(55,12);
 expect(after.lines[0]).toMatchObject({ingredientId:item.id,quantity:100,unit:'g'});
 const backup=await exportAll();expect(backup.version).toBe(20);await restoreAll(JSON.parse(JSON.stringify(backup)));
 expect(await store.meals.bulkGet([before.id,after.id])).toEqual([before,after]);
 expect(await store.batches.get(id)).toMatchObject({remainingQuantity:150,stock:{kind:'pantry-ingredient',ingredientId:item.id}});
 await store.saveMeal({operationId:stamp().id,mealId:before.id,batchId:id,date,category:'dinner',portion:{unit:'g',quantity:100},expectedRevision:before.revision});
 expect((await store.meals.get(before.id))?.nutrition).toEqual(before.nutrition);
 const corrupt=structuredClone(backup);(corrupt.tables.foodLogs[0] as FoodLog).lines[0].ingredientId='wrong';await expect(restoreAll(corrupt)).rejects.toThrow();
});
it('retains single-ingredient prepared stock through v17 import until explicitly linked',async()=>{
 const item=yogurt(),id=stamp().id;await db.ingredients.put(item);
 await store.makeBatch({operationId:stamp().id,id,name:item.name,preparedOn:date,cookedYieldGrams:400,ingredients:[{source:'pantry',line:line(item,400)}]});
 const old=await exportAll();old.version=17;await restoreAll(old);
 await db.ingredients.update(item.id,{calories:55});const cooked=await consume(id);expect(cooked.nutrition.calories).toBe(60);
 const batch=(await store.batches.get(id))!,transactions=await store.transactions.toArray();
 expect(batch.stock).toBeUndefined();await store.linkRemaining(id,item.id,batch.revision);
 expect(await store.transactions.toArray()).toEqual(transactions);expect((await store.batches.get(id))!.remainingQuantity).toBe(300);
 expect((await consume(id)).nutrition.calories).toBeCloseTo(55,12);await restoreAll(await exportAll());
 expect(await store.meals.get(cooked.id)).toEqual(cooked);expect((await store.batches.get(id))!.totalNutrition.calories).toBe(240);
});
it('reconciles exact and Family previews and active quantities without rewriting templates or changing checks',async()=>{
 const item=yogurt();await db.ingredients.put(item);
 const f={...stamp(),name:'Yogurt',alternateName:'',memberIds:[item.id],inUseIds:[item.id]};
 const exact=line(item),family={source:'family' as const,lineId:'family-slot',familyId:f.id,name:f.name,unit:'g' as const,quantity:100};
 const template={...stamp(),name:'Breakfast',servings:1,lines:[exact],instructions:'',stickyNote:''};
 await recipes.put(template);
 const session=await openCookingSession(template),key=session.entries[0].id;
 const modified=setCookingQuantity(session,key,125,'g');await saveCookingSession(session,{...modified,checked:[key]});
 for(const calories of [60,55]){
  await db.ingredients.update(item.id,{calories});const pantry=await db.ingredients.toArray();
  const preview=recipeNutritionRange([exact,family],familyCatalog([f],pantry,{}),'en');
  expect(preview.calories).toEqual([calories*2,calories*2]);expect(family.source).toBe('family');
  const restored=await openCookingSession(template);expect(restored.checked).toContain(key);
  const [actual]=livePreparation(effectiveCookingRecipe(template,restored).lines,pantry,{});
  expect(actual).toMatchObject({lineId:exact.lineId,quantity:125,unit:'g'});expect(actual.nutrition.calories).toBeCloseTo(1.25*calories);
 }
 expect(await recipes.get(template.id)).toEqual(template);
 const unsafe={...item,referenceUnit:'mL' as const};const bad=livePreparation([exact],[unsafe],{});
 expect(needsUnitReview(bad,[unsafe],{})).toBe(true);expect(bad[0].nutrition.calories).toBeNull();expect(bad[0].unit).toBe('g');
});

it('rolls back a raw-stock debit when a corrected basis can no longer interpret grams',async()=>{
 const item=yogurt(),id=stamp().id;await db.ingredients.put(item);
 await store.registerStock({id,operationId:stamp().id,ingredientId:item.id,grams:350,date});
 const first=await consume(id);
 await db.ingredients.update(item.id,{referenceUnit:'mL'});
 const before=await exportAll();await expect(consume(id)).rejects.toMatchObject({code:'UNIT_REVIEW'});
 expect((await exportAll()).tables).toEqual(before.tables);
 await store.deleteMeal({operationId:stamp().id,mealId:first.id,expectedRevision:first.revision});
 expect((await store.batches.get(id))?.remainingQuantity).toBe(350);
 await restoreAll(await exportAll());
});

it.each([10,11,12,13,14,15,16,17])('imports storage from Backup %i with its original snapshot identity',async version=>{
 const item=yogurt(),id=stamp().id;await db.ingredients.put(item);
 await store.makeBatch({operationId:stamp().id,id,name:item.name,preparedOn:date,cookedYieldGrams:300,ingredients:[{source:'pantry',line:line(item,300)}]});
 const saved=await consume(id),before=await store.batches.get(id),backup=await exportAll();
 backup.version=version;if(version<17)delete backup.tables.ingredientFamilies;
 await restoreAll(backup);expect(await store.batches.get(id)).toEqual(before);
 await db.ingredients.update(item.id,{calories:55});expect((await consume(id)).nutrition).toEqual(saved.nutrition);
});
it('reflects corrected reference portions, macros and explicit piece conversions at the original recipe quantity',()=>{
 const item={...yogurt(),referenceAmount:30,consumptionUnit:{name:'piece',amount:15,quantity:1,unit:'g' as const}};
 const required={...line(item),quantity:2,unit:'piece'};
 const [original]=livePreparation([required],[item],{});
 expect(original.nutrition).toEqual({calories:60,protein:8,carbs:4,fat:2});
 const corrected={...item,referenceAmount:60,protein:12,carbs:2,fat:6,consumptionUnit:{...item.consumptionUnit,amount:30}};
 const [next]=livePreparation([required],[corrected],{});
 expect(next).toMatchObject({lineId:required.lineId,unit:'piece',quantity:2,nutrition:{calories:60,protein:12,carbs:2,fat:6}});
 expect(needsUnitReview([required],[{...corrected,consumptionUnit:null}],{})).toBe(true);
});
