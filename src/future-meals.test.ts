import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {db,stamp,localDate} from './db';
import {foodLogs,exportAll,type FoodLog} from './domain';
import {FoodStorage,copyRecipeForBatch} from './food-storage';
import {dailyAggregation} from './aggregation';
const service=new FoodStorage(),nutrition={calories:600,protein:30,carbs:60,fat:20};
const recipe=()=>({...stamp(),name:'Future test recipe',servings:1,lines:[{ingredientId:'future-test-food',name:'Future test food',quantity:100,unit:'g',nutrition:{...nutrition}}],instructions:'',stickyNote:''});
afterEach(async()=>{vi.useRealTimers();for(const table of db.tables)await table.clear()});
it('future storage consumption saves, edits and deletes immediately while totals follow meal dates',async()=>{
 const r=recipe(),batchId=stamp().id,mealId=stamp().id;await service.makeBatch({operationId:stamp().id,id:batchId,name:'Prepared today',preparedOn:localDate(),ingredients:copyRecipeForBatch(r),cookedYieldGrams:600});
 const input={mealId,batchId,portion:{unit:'g' as const,quantity:100},date:'2099-01-02',category:'breakfast' as const};await service.saveMeal({...input,operationId:stamp().id});let meal=(await foodLogs.get(mealId))!;expect(meal.date).toBe(input.date);for(const [key,value] of Object.entries({calories:100,protein:5,carbs:10,fat:20/6}))expect(meal.nutrition[key as keyof typeof nutrition]).toBeCloseTo(value,10);expect((await service.batches.get(batchId))!.remainingQuantity).toBe(500);expect(dailyAggregation(localDate(),[meal],[]).foodCount).toBe(0);expect(dailyAggregation(input.date,[meal],[]).nutrition).toEqual(meal.nutrition);
 await service.saveMeal({...input,operationId:stamp().id,date:'2099-01-09',portion:{unit:'g',quantity:200},expectedRevision:meal.revision});meal=(await foodLogs.get(mealId))!;expect((await service.batches.get(batchId))!.remainingQuantity).toBe(400);expect(meal.nutrition.calories).toBeCloseTo(200,10);expect(dailyAggregation(input.date,[meal],[]).foodCount).toBe(0);
 await service.deleteMeal({operationId:stamp().id,mealId,expectedRevision:meal.revision});expect((await service.batches.get(batchId))!.remainingQuantity).toBe(600);expect((await foodLogs.get(mealId))!.deletedAt).toBeTruthy();
});
it('future recipe leftovers are available immediately with a local preparation date independent of the meal date',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-29T16:00:00Z'));const r=recipe(),meal:FoodLog={...stamp(),name:r.name,date:'2026-10-30',category:'breakfast',source:'recipe',sourceId:r.id,quantity:1,unit:'serving',nutrition:{calories:300,protein:15,carbs:30,fat:10},baseNutrition:{...nutrition},consumptionPercent:50,lines:r.lines,cookingNote:''},batchId=stamp().id;
 await service.saveMealWithLeftovers({operationId:stamp().id,meal,batchId,saveLeftovers:true,cookedWeightGrams:600});const batch=(await service.batches.get(batchId))!;expect(batch.preparedOn).toBe(localDate());expect(batch.preparedOn).not.toBe(meal.date);expect(batch.remainingQuantity).toBe(300);expect(await foodLogs.get(meal.id)).toMatchObject({date:meal.date,nutrition:meal.nutrition});
 const saved=(await foodLogs.get(meal.id))!;await service.editLeftoverOrigin({operationId:stamp().id,meal:{...saved,date:'2026-11-05'},expectedMealRevision:saved.revision,expectedBatchRevision:batch.revision,strategy:'sync'});expect((await service.batches.get(batchId))!.preparedOn).toBe(batch.preparedOn);expect((await foodLogs.get(meal.id))!.date).toBe('2026-11-05');
});
it('invalid calendar dates still fail without changing inventory or existing records',async()=>{
 const batchId=stamp().id;await service.makeBatch({operationId:stamp().id,id:batchId,name:'Date validation',preparedOn:localDate(),ingredients:copyRecipeForBatch(recipe()),cookedYieldGrams:600});const before=await exportAll();await expect(service.saveMeal({operationId:stamp().id,mealId:stamp().id,batchId,portion:{unit:'g',quantity:100},date:'2099-02-30',category:'breakfast'})).rejects.toMatchObject({code:'INVALID'});expect((await exportAll()).tables).toEqual(before.tables);
});
