import 'fake-indexeddb/auto';
import {afterEach, describe, expect, it} from 'vitest';
import {db, stamp} from './db';
import {exportAll, softDelete, foodLogs, type Recipe, type FoodLog} from './domain';
import {FoodStorage, copyRecipeForBatch, batchRemainingNutrition, type MakeBatchInput, type StorageMealInput} from './food-storage';
import type {FoodBatch, BatchIngredient} from './food-storage-model';

const store = new FoodStorage();
const nutrition = {calories:600, protein:30, carbs:60, fat:20};
const recipe = (): Recipe => ({...stamp(), name:'Synthetic recipe', servings:2, lines:[{ingredientId:'builtin-test', name:'Frozen ingredient', quantity:300, unit:'g', nutrition:{...nutrition}}], instructions:'Keep', stickyNote:'Keep'});
const create = (overrides: Partial<MakeBatchInput> = {}): MakeBatchInput => ({operationId:stamp().id, id:stamp().id, name:'Synthetic batch', preparedOn:'2026-10-28', cookedYieldGrams:600, ingredients:copyRecipeForBatch(recipe()), ...overrides});
async function make(overrides: Partial<MakeBatchInput> = {}) {const input=create(overrides); await store.makeBatch(input); return (await store.batches.get(input.id))!}
const mealInput = (b: FoodBatch, quantity=100): StorageMealInput => ({operationId:stamp().id, mealId:stamp().id, batchId:b.id, portion:{unit:b.mode==='weight'?'g':'percent', quantity}, date:'2026-10-28', category:'lunch'});
const remaining = async (id: string) => (await store.batches.get(id))!;
function initialMeal(percent = 50): FoodLog {
  const r=recipe(); return {...stamp(), date:'2026-10-28', category:'lunch', name:r.name, source:'recipe', sourceId:r.id, quantity:2, unit:'serving', nutrition:{calories:300,protein:15,carbs:30,fat:10}, baseNutrition:{...nutrition}, consumptionPercent:percent, lines:structuredClone(r.lines), cookingNote:'Initial meal'};
}
async function leftovers(weight?:number, percent=50) {
  const meal=initialMeal(percent), batchId=stamp().id;
  await store.saveMealWithLeftovers({operationId:stamp().id, meal, batchId, saveLeftovers:true, cookedWeightGrams:weight});
  return {batch:await remaining(batchId), meal:(await store.meals.get(meal.id))!};
}
afterEach(async()=>{for(const t of db.tables)await t.clear()});

describe('Food Storage snapshots and creation',()=>{
  it('copies recipe ingredients; changing actual amounts never edits the template or Pantry',async()=>{
    const r=recipe(); await db.table('recipeCards').put(r);
    const ingredients=copyRecipeForBatch(r); const first=ingredients[0];if(first.source!=='pantry')throw Error('fixture');
    first.line.quantity=150; first.line.nutrition={calories:300,protein:15,carbs:30,fat:10};
    const b=await make({sourceRecipeId:r.id,ingredients});
    first.line.nutrition.calories=999;
    expect(await db.table('recipeCards').get(r.id)).toEqual(r);expect(await db.ingredients.count()).toBe(0);expect(await store.meals.count()).toBe(0);
    expect(b).toMatchObject({remainingQuantity:600, originalCookedYield:600, mode:'weight', everUsed:false, totalNutrition:{calories:300,protein:15,carbs:30,fat:10}});
    await db.table('recipeCards').put({...r,lines:[],name:'Later edit'});expect((await remaining(b.id)).ingredients[0].quantity).toBe(150);
  });
  it('allows multiple independent batches of one recipe and from-scratch Pantry snapshots',async()=>{
    const r=recipe(); const a=await make({sourceRecipeId:r.id}),b=await make({sourceRecipeId:r.id});expect(a.id).not.toBe(b.id);
    await store.saveMeal(mealInput(a,200));expect((await remaining(a.id)).remainingQuantity).toBe(400);expect((await remaining(b.id)).remainingQuantity).toBe(600);
  });
  it.each([0,-1,NaN,Infinity])('rejects invalid cooked yield %s without writing',async cookedYieldGrams=>{
    await expect(store.makeBatch(create({cookedYieldGrams}))).rejects.toMatchObject({code:'INVALID'});expect(await store.batches.count()).toBe(0);expect(await store.transactions.count()).toBe(0);
  });
  it('does not accept recipes as ingredients or invalid/non-finite nutrition',async()=>{
    const i=create();(i.ingredients[0] as any).source='recipe';await expect(store.makeBatch(i)).rejects.toMatchObject({code:'INVALID'});
    const bad=create();if(bad.ingredients[0].source==='pantry')bad.ingredients[0].line.nutrition.calories=Infinity;
    await expect(store.makeBatch(bad)).rejects.toMatchObject({code:'INVALID'});expect(await store.batches.count()).toBe(0);
  });
  it('keeps unknown nutrients unknown and explicit zero intact',async()=>{
    const i=create();if(i.ingredients[0].source==='pantry')i.ingredients[0].line.nutrition={calories:600,protein:null,carbs:0,fat:20};
    await store.makeBatch(i);const m=mealInput(await remaining(i.id),100);await store.saveMeal(m);const actual=(await store.meals.get(m.mealId))!.nutrition;expect(actual.calories).toBeCloseTo(100,12);expect(actual.protein).toBeNull();expect(actual.carbs).toBe(0);expect(actual.fat).toBeCloseTo(20/6,12);
  });
});
describe('Leftovers, current-remainder ratios and conversion',()=>{
  it('does not assume unconsumed food exists when the option is off',async()=>{
    const meal=initialMeal();await store.saveMealWithLeftovers({operationId:stamp().id,meal,saveLeftovers:false});expect(await store.batches.count()).toBe(0);expect((await store.meals.get(meal.id))!.nutrition.calories).toBe(300);
  });
  it('creates a ratio leftover batch and consumes a percentage of CURRENT remainder',async()=>{
    const {batch,meal}=await leftovers();expect(batch.remainingQuantity).toBe(.5);expect(batch.initialConsumedFraction).toBe(.5);expect(batch.totalNutrition).toEqual(nutrition);
    const first=mealInput(batch,50);await store.saveMeal(first);expect((await remaining(batch.id)).remainingQuantity).toBe(.25);expect((await store.meals.get(first.mealId))!.nutrition.calories).toBe(150);
    const second=mealInput(await remaining(batch.id),50);await store.saveMeal(second);expect((await remaining(batch.id)).remainingQuantity).toBe(.125);expect((await store.meals.get(second.mealId))!.nutrition.calories).toBe(75);
    expect((await store.meals.get(meal.id))!.nutrition.calories).toBe(300);
  });
  it('creates known-weight leftovers from complete prepared weight, not ingredient weight',async()=>{
    const {batch}=await leftovers(800,25);expect(batch).toMatchObject({mode:'weight',originalCookedYield:800,remainingQuantity:600,fractionPerUnit:1/800});expect(batchRemainingNutrition(batch).calories).toBe(450);
  });
  it('rejects 100% leftovers, missing full snapshots, invalid weights and duplicate initial meals',async()=>{
    for(const cookedWeightGrams of [0,-1,Infinity])await expect(store.saveMealWithLeftovers({operationId:stamp().id,meal:initialMeal(),batchId:stamp().id,saveLeftovers:true,cookedWeightGrams})).rejects.toMatchObject({code:'INVALID'});
    await expect(store.saveMealWithLeftovers({operationId:stamp().id,meal:initialMeal(100),batchId:stamp().id,saveLeftovers:true})).rejects.toMatchObject({code:'INVALID'});
    const bad=initialMeal();delete bad.baseNutrition;await expect(store.saveMealWithLeftovers({operationId:stamp().id,meal:bad,saveLeftovers:false})).rejects.toMatchObject({code:'INVALID'});
    const {meal}=await leftovers();await expect(store.saveMealWithLeftovers({operationId:stamp().id,meal,saveLeftovers:false})).rejects.toMatchObject({code:'INVALID'});
  });
  it('preserves remaining nutrition and historical meals when converting ratio to measured remaining grams',async()=>{
    const {batch,meal}=await leftovers();const consume=mealInput(batch,50);await store.saveMeal(consume);
    const before=await remaining(batch.id),oldMeal=await store.meals.get(consume.mealId),currentNutrition=batchRemainingNutrition(before);
    await store.convertToWeight({operationId:'conversion',batchId:batch.id,expectedRevision:before.revision,remainingGrams:125});
    const after=await remaining(batch.id);expect(after.mode).toBe('weight');expect(after.remainingQuantity).toBe(125);expect(after.originalCookedYield).toBeNull();expect(batchRemainingNutrition(after)).toEqual(currentNutrition);
    expect(await store.meals.get(consume.mealId)).toEqual(oldMeal);expect((await store.meals.get(meal.id))!.nutrition.calories).toBe(300);
    const weightMeal=mealInput(after,25);await store.saveMeal(weightMeal);expect((await store.meals.get(weightMeal.mealId))!.nutrition.calories).toBe(30);
    await store.deleteMeal({operationId:stamp().id,mealId:consume.mealId,expectedRevision:oldMeal!.revision});
    expect((await remaining(batch.id)).remainingQuantity).toBe(225); // 100 current + original .25 / .002.
    expect((await store.transactions.get('conversion'))!.kind).toBe('convert');
  });
  it('does not restore the originally eaten portion when deleting the origin leftover meal',async()=>{
    const {batch,meal}=await leftovers();await store.deleteMeal({operationId:stamp().id,mealId:meal.id,expectedRevision:meal.revision});expect(await remaining(batch.id)).toEqual(batch);expect((await store.meals.get(meal.id))!.deletedAt).not.toBeNull();
  });
  it('can reduce a fully consumed ratio meal and retains its permanent formula lock',async()=>{
    const {batch}=await leftovers();const input=mealInput(batch,100);await store.saveMeal(input);const saved=(await store.meals.get(input.mealId))!;expect((await remaining(batch.id)).archiveReason).toBe('exhausted');
    await store.saveMeal({...input,operationId:stamp().id,expectedRevision:saved.revision,portion:{unit:'percent',quantity:50}});const after=await remaining(batch.id);expect(after.remainingQuantity).toBe(.25);expect(after.archived).toBe(false);expect(after.everUsed).toBe(true);
  });
});
describe('Atomic inventory consumption, corrections and idempotency',()=>{
  it('edits only the quantity difference; deletion preserves independent manual adjustments',async()=>{
    const b=await make(),input=mealInput(b,200);await store.saveMeal(input);let meal=(await store.meals.get(input.mealId))!;
    await store.saveMeal({...input,operationId:stamp().id,expectedRevision:meal.revision,portion:{unit:'g',quantity:150}});expect((await remaining(b.id)).remainingQuantity).toBe(450);
    let current=await remaining(b.id);await store.adjustRemaining({operationId:stamp().id,batchId:b.id,expectedRevision:current.revision,quantity:900,reason:'Measured correction'});
    meal=(await store.meals.get(input.mealId))!;await store.deleteMeal({operationId:stamp().id,mealId:meal.id,expectedRevision:meal.revision});current=await remaining(b.id);expect(current.remainingQuantity).toBe(1050);expect(current.originalCookedYield).toBe(600);expect(current.totalNutrition).toEqual(nutrition);expect(current.everUsed).toBe(true);
  });
  it('returns inventory to old batch when changing the selected batch; overdraw rolls back BOTH sides',async()=>{
    const a=await make(),b=await make();const input=mealInput(a,200);await store.saveMeal(input);const old=(await store.meals.get(input.mealId))!;
    const before=await exportAll();await expect(store.saveMeal({...input,operationId:stamp().id,batchId:b.id,expectedRevision:old.revision,portion:{unit:'g',quantity:700}})).rejects.toMatchObject({code:'OVERDRAW'});expect((await exportAll()).tables).toEqual(before.tables);
    await store.saveMeal({...input,operationId:stamp().id,batchId:b.id,expectedRevision:old.revision,portion:{unit:'g',quantity:300}});expect((await remaining(a.id)).remainingQuantity).toBe(600);expect((await remaining(b.id)).remainingQuantity).toBe(300);
  });
  it('prevents repeated saves, retries after deletion and operation-key collisions from double-deducting',async()=>{
    const input=create();await store.makeBatch(input);await store.makeBatch(structuredClone(input));expect(await store.batches.count()).toBe(1);
    const m=mealInput(await remaining(input.id),100);await Promise.all([store.saveMeal(m),store.saveMeal(structuredClone(m))]);expect((await remaining(input.id)).remainingQuantity).toBe(500);expect(await store.meals.count()).toBe(1);
    await expect(store.saveMeal({...m,portion:{unit:'g',quantity:200}})).rejects.toMatchObject({code:'CONFLICT'});
    const saved=(await store.meals.get(m.mealId))!,del={operationId:stamp().id,mealId:m.mealId,expectedRevision:saved.revision};await store.deleteMeal(del);await store.deleteMeal(del);await store.saveMeal(m);expect((await remaining(input.id)).remainingQuantity).toBe(600);expect((await store.meals.get(m.mealId))!.deletedAt).not.toBeNull();
  });
  it('serializes competing consumes so inventory cannot be overdrawn',async()=>{
    const b=await make();const results=await Promise.allSettled([store.saveMeal(mealInput(b,400)),store.saveMeal(mealInput(b,400))]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await remaining(b.id)).remainingQuantity).toBe(200);expect(await store.meals.count()).toBe(1);
  });
  it('rejects stale edits and mismatched units without writing',async()=>{
    const b=await make();const before=await exportAll();await expect(store.saveMeal({...mealInput(b),expectedRevision:3})).rejects.toMatchObject({code:'CONFLICT'});
    for(const portion of [{unit:'percent' as const,quantity:50},{unit:'g' as const,quantity:NaN},{unit:'g' as const,quantity:-1},{unit:'g' as const,quantity:0}])await expect(store.saveMeal({...mealInput(b),portion})).rejects.toMatchObject({code:'INVALID'});expect((await exportAll()).tables).toEqual(before.tables);
  });
  it('rolls back batch, meal and ledger changes when the final transaction write fails',async()=>{
    const b=await make(),before=await exportAll();const hook=()=>{throw Error('Synthetic ledger write failure')};store.transactions.hook('creating',hook);
    try{await expect(store.saveMeal(mealInput(b,100))).rejects.toThrow('Synthetic ledger write failure')}finally{store.transactions.hook('creating').unsubscribe(hook)}expect((await exportAll()).tables).toEqual(before.tables);
  });
  it('rolls back restored inventory if the edited meal write fails',async()=>{
    const a=await make(),b=await make(),input=mealInput(a,100);await store.saveMeal(input);const old=(await store.meals.get(input.mealId))!,before=await exportAll();const hook=()=>{throw Error('Synthetic meal update failure')};store.meals.hook('updating',hook);
    try{await expect(store.saveMeal({...input,operationId:stamp().id,batchId:b.id,expectedRevision:old.revision})).rejects.toThrow('Synthetic meal update failure')}finally{store.meals.hook('updating').unsubscribe(hook)}expect((await exportAll()).tables).toEqual(before.tables);
  });
});
describe('Prepared-food lineage, locking and archives',()=>{
  it('uses sauce in pasta and returns ONLY pasta when a pasta meal is deleted',async()=>{
    const sauce=await make({name:'Tomato sauce'});const pasta=await make({name:'Pasta',cookedYieldGrams:800,ingredients:[{source:'batch',batchId:sauce.id,portion:{unit:'g',quantity:200}},...copyRecipeForBatch(recipe())]});
    expect((await remaining(sauce.id)).remainingQuantity).toBe(400);expect((await remaining(sauce.id)).everUsed).toBe(true);expect(pasta.totalNutrition.calories).toBe(800);expect(pasta.ingredients[0].sourceBatchId).toBe(sauce.id);expect(pasta.ingredients[0].sourceFraction).toBeCloseTo(1/3,14);
    const input=mealInput(pasta,400);await store.saveMeal(input);const saved=(await store.meals.get(input.mealId))!;await store.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});expect((await remaining(pasta.id)).remainingQuantity).toBe(800);expect((await remaining(sauce.id)).remainingQuantity).toBe(400);
  });
  it('rolls back all source deductions when batch creation fails',async()=>{
    const sauce=await make(),before=await exportAll();await expect(store.makeBatch(create({name:'',ingredients:[{source:'batch',batchId:sauce.id,portion:{unit:'g',quantity:200}}]}))).rejects.toMatchObject({code:'INVALID'});expect((await exportAll()).tables).toEqual(before.tables);
  });
  it('allows unused formula corrections and locks forever after any use, even if deleted',async()=>{
    let b=await make();const ingredients:BatchIngredient[]=structuredClone(b.ingredients);ingredients[0].quantity=150;ingredients[0].nutrition={calories:300,protein:15,carbs:30,fat:10};
    await store.correctFormula({operationId:stamp().id,batchId:b.id,expectedRevision:b.revision,ingredients,cookedYieldGrams:500});b=await remaining(b.id);expect(b.originalCookedYield).toBe(500);expect(b.totalNutrition.calories).toBe(300);
    const input=mealInput(b,100);await store.saveMeal(input);const saved=(await store.meals.get(input.mealId))!;await store.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});b=await remaining(b.id);await expect(store.correctFormula({operationId:stamp().id,batchId:b.id,expectedRevision:b.revision,ingredients,cookedYieldGrams:500})).rejects.toMatchObject({code:'LOCKED'});
    await store.updateMetadata({operationId:stamp().id,batchId:b.id,expectedRevision:b.revision,name:'Renamed',notes:'Allowed'});expect((await remaining(b.id)).name).toBe('Renamed');expect((await remaining(b.id)).totalNutrition.calories).toBe(300);
  });
  it('can correct an unused derived batch while preserving every processed source allocation',async()=>{
    const sauce=await make();let pasta=await make({ingredients:[{source:'batch',batchId:sauce.id,portion:{unit:'g',quantity:200}},...copyRecipeForBatch(recipe())]});const ingredients=structuredClone(pasta.ingredients);ingredients[1].nutrition={calories:300,protein:15,carbs:30,fat:10};
    await store.correctFormula({operationId:stamp().id,batchId:pasta.id,expectedRevision:pasta.revision,ingredients,cookedYieldGrams:500});expect((await remaining(sauce.id)).remainingQuantity).toBe(400);pasta=await remaining(pasta.id);
    await expect(store.correctFormula({operationId:stamp().id,batchId:pasta.id,expectedRevision:pasta.revision,ingredients:ingredients.slice(1),cookedYieldGrams:500})).rejects.toMatchObject({code:'CONFLICT'});expect((await remaining(sauce.id)).remainingQuantity).toBe(400);
  });
  it('automatically archives exhausted batches and reactivates only exhaustion archives on restoration',async()=>{
    const b=await make(),input=mealInput(b,600);await store.saveMeal(input);expect((await remaining(b.id)).archiveReason).toBe('exhausted');const saved=(await store.meals.get(input.mealId))!;await store.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});expect((await remaining(b.id)).archived).toBe(false);
  });
  it.each(['archive','discard'] as const)('keeps %s status after meal restoration until explicitly restored',async action=>{
    let b=await make();const input=mealInput(b,100);await store.saveMeal(input);b=await remaining(b.id);await store.setArchive({operationId:stamp().id,batchId:b.id,expectedRevision:b.revision,action});
    const saved=(await store.meals.get(input.mealId))!;await store.deleteMeal({operationId:stamp().id,mealId:saved.id,expectedRevision:saved.revision});b=await remaining(b.id);expect(b.archiveReason).toBe(action==='archive'?'manual':'discarded');expect(b.archived).toBe(true);expect(b.remainingQuantity).toBe(action==='archive'?600:100);
    await expect(store.saveMeal(mealInput(b,10))).rejects.toMatchObject({code:'ARCHIVED'});await store.setArchive({operationId:stamp().id,batchId:b.id,expectedRevision:b.revision,action:'restore'});expect((await remaining(b.id)).archived).toBe(false);
  });
});

it('routes existing domain soft-deletion through inventory restoration without duplicate returns',async()=>{
 const b=await make(),input=mealInput(b,100);await store.saveMeal(input);await softDelete(foodLogs,input.mealId);await softDelete(foodLogs,input.mealId);expect((await remaining(b.id)).remainingQuantity).toBe(600);
 const origin=await leftovers();await softDelete(foodLogs,origin.meal.id);expect(await remaining(origin.batch.id)).toEqual(origin.batch);
});
it('supports 0% initial consumption and does not create inventory without explicit opt-in',async()=>{
 const origin=await leftovers(undefined,0);expect(origin.batch.remainingQuantity).toBe(1);expect(origin.batch.totalNutrition).toEqual(nutrition);expect(origin.meal.nutrition).toEqual({calories:0,protein:0,carbs:0,fat:0});expect(origin.batch.everUsed).toBe(true);
});
it('rejects an inconsistent complete portion snapshot without saving a meal or batch',async()=>{
 const meal=initialMeal();meal.baseNutrition!.calories=999;await expect(store.saveMealWithLeftovers({operationId:stamp().id,meal,batchId:stamp().id,saveLeftovers:true})).rejects.toMatchObject({code:'INVALID'});expect(await store.batches.count()).toBe(0);expect(await store.meals.count()).toBe(0);
});
it('rejects invalid ratio percentages and conversion inputs without changing inventory',async()=>{
 const {batch}=await leftovers(),before=await exportAll();for(const quantity of [-1,0,101,Infinity])await expect(store.saveMeal({...mealInput(batch),portion:{unit:'percent',quantity}})).rejects.toMatchObject({code:'INVALID'});
 for(const remainingGrams of [0,-1,Infinity])await expect(store.convertToWeight({operationId:stamp().id,batchId:batch.id,expectedRevision:batch.revision,remainingGrams})).rejects.toMatchObject({code:'INVALID'});
 expect((await exportAll()).tables).toEqual(before.tables);
});
