import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,exportAll,restoreAll,stamp,recipes,type RecipeLine,type PantryItem} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {builtInTagIds} from './data/builtInTags';
import {familyCatalog,familyResolution,saveFamily} from './families';
import {resolveFamilyPreparation,templateEditorLine} from './family-preparation';
import {livePreparation,needsUnitReview} from './live-nutrition';
import {recipeCardRange,recipeNutritionRange} from './recipe-nutrition-range';
import {FoodStorage} from './food-storage';
import {storedRecipeLine} from './recipe-storage';
import {stockViews,liveStockLines} from './stock-view';
import type {IngredientPreference} from './ingredient-preferences';

afterEach(async()=>{for(const table of db.tables)await table.clear()});
const item=():PantryItem=>({...stamp(),name:'Yogurt',nameZh:'',brand:'',basis:'100g',referenceUnit:'g',servingGrams:null,calories:60,protein:8,carbs:4,fat:2});
it('reinterprets an exact built-in custom unit without changing its recipe quantity or choosing the new default',()=>{
 const food=builtInFoods.find(i=>i.id==='builtin-olive-oil')!;
 const line:RecipeLine={lineId:'original-slot',ingredientId:food.id,name:'Oil',quantity:1,unit:'scoop',nutrition:{calories:123,protein:0,carbs:0,fat:0}};
 for(const [grams,preferred,unit] of [[10,'scoop','g'],[20,'scoop','g'],[20,'g','g'],[0,'g','g'],[20,'g','mL']] as const){
  const prefs:Record<string,IngredientPreference>={[food.id]:{version:1,units:grams?[{name:'scoop',quantity:1,amount:grams,unit}]:[],preferred,archived:false}};
  const value=grams&&unit==='g'?food.kcalPer100g!*grams/100:null;
  const result=recipeNutritionRange([line],familyCatalog([],[],prefs),'en');
  expect(result.calories).toEqual(value===null?null:[value,value]);
  expect(needsUnitReview([line],[],prefs)).toBe(value===null);
  expect(livePreparation([line],[],prefs)[0]).toMatchObject({lineId:'original-slot',quantity:1,unit:'scoop',nutrition:{calories:value}});
 }
 expect(line.nutrition.calories).toBe(123);
});
it('keeps card, detail and meal readings in agreement for both stock identities after backup and a Pantry correction',async()=>{
 const yogurt=item(),store=new FoodStorage(),raw=stamp().id,cooked=stamp().id,date='2026-11-26';
 await db.ingredients.put(yogurt);
 await store.registerStock({id:raw,operationId:stamp().id,ingredientId:yogurt.id,grams:350,date});
 await store.makeBatch({id:cooked,operationId:stamp().id,name:'Cooked yogurt',preparedOn:date,cookedYieldGrams:100,ingredients:[{source:'pantry',line:{ingredientId:yogurt.id,name:yogurt.name,quantity:100,unit:'g',nutrition:{calories:60,protein:8,carbs:4,fat:2}}}]});
 const cards=await Promise.all([raw,cooked].map(async id=>({...stamp(),name:'Recipe',instructions:'',stickyNote:'',servings:1,lines:[storedRecipeLine((await store.batches.get(id))!)]})));
 await recipes.bulkPut(cards);await db.ingredients.update(yogurt.id,{calories:55});await restoreAll(await exportAll());
 const views=await stockViews(),catalog=familyCatalog([],await db.ingredients.toArray(),{});
 for(const [index,card] of cards.entries()){
  const value=index===0?55:60;
  expect(recipeCardRange(card,catalog,'en',views).nutrition.calories?.[0]).toBeCloseTo(value);
  expect(recipeNutritionRange(card.lines,catalog,'en',1,views).calories?.[1]).toBeCloseTo(value);
  expect(liveStockLines(card.lines,views)[0].nutrition.calories).toBeCloseTo(value);
  expect(await recipes.get(card.id)).toEqual(card);
 }
});
it('makes the same actual-use decision from eligible In Use products and never defaults to an inactive product',()=>{
 const a=item(),b={...item(),referenceUnit:'mL' as const};
 const family={...stamp(),name:'Yogurt',alternateName:'',memberIds:[a.id,b.id],inUseIds:[a.id,b.id]};
 const line={source:'family' as const,familyId:family.id,lineId:'slot',unit:'g' as const,quantity:100,name:'Yogurt'};
 for(const [inUseIds,status] of [[[a.id,b.id],'automatic'],[[],'requires-selection'],[[b.id],'unavailable']] as const){
  const c=familyCatalog([{...family,inUseIds:[...inUseIds]}],[a,b],{});
  expect(familyResolution(line,c).kind).toBe(status);
  const result=resolveFamilyPreparation([templateEditorLine(line)],c,'en');
  expect(result.lines.map(l=>l.ingredientId)).toEqual(status==='automatic'?[a.id]:[]);
 }
});
it.each(['family','tag'])('rejects a dangling Backup 18 Family tag %s before overwriting the journal',async(kind)=>{
 const f={...stamp(),name:'Breakfast',alternateName:'',memberIds:[],inUseIds:[]};
 const tag=[...builtInTagIds][0];
 await saveFamily(f,[tag]);
 const before=await exportAll(),bad=structuredClone(before);
 const setting=bad.tables.settings.find(row=>(row as {key:string}).key.startsWith('familyTags:')) as {key:string;value:string};
 if(kind==='family')setting.key='familyTags:missing';else setting.value=JSON.stringify([tag,'missing']);
 await expect(restoreAll({...bad,version:18})).rejects.toThrow(/Invalid Family tag reference/);
 await expect(restoreAll(bad)).rejects.toThrow(/Invalid Family tag reference/);
 expect((await exportAll()).tables).toEqual(before.tables);
 await restoreAll({...bad,version:17});
 const restored=await exportAll();
 expect(await db.settings.get('familyTags:missing')).toBeUndefined();
 if(kind==='tag')expect(await db.settings.get('familyTags:'+f.id)).toMatchObject({value:JSON.stringify([tag])});
 await restoreAll(restored);
});
