import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {builtInFoods} from './data/builtInFoods';
import {builtInExercises} from './data/builtInExercises';
import {ingredientTagOptions} from './data/builtInTags';
import {builtInFoodLine,builtInFoodNutrition,referenceNutritionSummary,searchFoodChoices} from './reference-library';
import {db,foodLogs,exportAll,stamp,unknownNutrition,type PantryItem} from './domain';

afterEach(async()=>{for(const table of db.tables)await table.clear()});
const tags=ingredientTagOptions([{id:'custom',name:'Custom reference test'}],'en');
const broccoli=builtInFoods.find(food=>food.id==='builtin-broccoli-raw')!;

// Independent contract with the supplied Phase 2A dataset, including source precision.
it.each([
 ['builtin-broccoli-raw','11090','747447',31,2.57,6.27,0.34],
 ['builtin-carrot-raw','11124','2258586',44.979,0.941,10.3,0.351],
 ['builtin-spinach-raw','11457','1999633',21.6,2.91,2.64,0.604],
 ['builtin-roma-tomato-raw','100261','1999634',19,0.696,3.84,0.425],
 ['builtin-cucumber-raw','11205','2346406',13.935,0.625,2.953,0.178],
 ['builtin-banana-raw','9040','1105314',97,0.74,23,0.29],
 ['builtin-gala-apple-raw','9503','1750341',54.867,0.133,14.768,0.15],
 ['builtin-strawberry-raw','9316','2346409',32.666,0.641,7.964,0.22],
 ['builtin-blueberry-raw','9050','2346411',57.385,0.703,14.572,0.306],
 ['builtin-whole-egg','1123','748967',148,12.4,0.96,9.96],
 ['builtin-whole-milk','1077','746782',60,3.27,4.63,3.2],
 ['builtin-greek-yogurt-whole-plain','1293','2259794',94.5071,8.78,4.754,4.39],
])('preserves supplied values for %s',(id,ndb,fdc,kcal,protein,carbs,fat)=>{
 const food=builtInFoods.find(food=>food.id===id)!;
 expect([food.ndbNumber,food.fdcIdSnapshot,food.kcalPer100g,food.proteinPer100g,food.carbsPer100g,food.fatPer100g]).toEqual([ndb,fdc,kcal,protein,carbs,fat]);
 expect(food.sourceName).toBe('USDA FoodData Central');expect(food.sourceDataType).toBe('Foundation Foods');expect(food.sourceRelease).toBe('April 2026');
 expect(food.sourceDescription).toBe('USDA FoodData Central Foundation Foods reference value per 100 g edible portion.');
 const url=new URL(food.sourceUrl);expect(url.origin).toBe('https://fdc.nal.usda.gov');expect(url.searchParams.get('query')).toBe(ndb);
 expect(food.usdaDescription).toBeTruthy();expect(food.preparationStateZh).toBeTruthy();expect(food.preparationStateEn).toBeTruthy();expect(food.tagIds).toHaveLength(1);
});
it('contains thirty-two unique frozen food references alongside the exercise library',()=>{
 expect(builtInFoods).toHaveLength(32);expect(new Set(builtInFoods.map(food=>food.id)).size).toBe(32);expect(builtInExercises).toHaveLength(15);
 expect(Object.isFrozen(builtInFoods)).toBe(true);expect(builtInFoods.every(food=>Object.isFrozen(food)&&Object.isFrozen(food.tagIds))).toBe(true);
});
it.each([
 ['西兰花','builtin-broccoli-raw'],[' BROCCOLI ','builtin-broccoli-raw'],['酸奶','builtin-greek-yogurt-whole-plain'],['Greek yogurt','builtin-greek-yogurt-whole-plain'],
 ['苹果','builtin-gala-apple-raw'],['Gala','builtin-gala-apple-raw'],['mature','builtin-carrot-raw'],['vegetables','builtin-cucumber-raw'],['蔬菜','builtin-spinach-raw'],['蛋奶','builtin-whole-milk'],
])('finds %s across languages, source descriptions and categories',(query,id)=>{
 expect(searchFoodChoices([],query,'',tags).map(choice=>choice.item.id)).toContain(id);
});
it('combines tag and text search and keeps exact personal matches ahead of references',()=>{
 const personal:PantryItem={...stamp(),name:'Broccoli',nameZh:'',brand:'',basis:'100g',servingGrams:null,tagIds:['custom'],...unknownNutrition()};
 expect(searchFoodChoices([personal],'Broccoli','',tags)[0]).toEqual({kind:'user',item:personal});
 expect(searchFoodChoices([personal],'Broccoli','custom',tags)).toEqual([{kind:'user',item:personal}]);
 expect(searchFoodChoices([],'Broccoli','betterlumi:ingredient-tag:fruits',tags)).toEqual([]);
 expect(searchFoodChoices([],'vegetables','betterlumi:ingredient-tag:vegetables',tags)).toHaveLength(8);
});
it('scales 50 g precisely without deriving energy from macros or rounding snapshots',()=>{
 const nutrition=builtInFoodNutrition(broccoli,50,'g');
 expect(nutrition.calories).toBe(15.5);expect(nutrition.protein).toBeCloseTo(1.285,14);expect(nutrition.carbs).toBeCloseTo(3.135,14);expect(nutrition.fat).toBe(0.17);
 expect(nutrition.calories).not.toBe((nutrition.protein!+nutrition.carbs!)*4+nutrition.fat!*9);
 expect(referenceNutritionSummary(broccoli)).toBe('31 kcal / 100 g · P 2.6 · C 6.3 · F 0.3 g');
 const blueberry=builtInFoods.find(food=>food.id==='builtin-blueberry-raw')!;expect(referenceNutritionSummary(blueberry)).toBe('57 kcal / 100 g · P 0.7 · C 14.6 · F 0.3 g');expect(blueberry.kcalPer100g).toBe(57.385);
 expect(builtInFoodNutrition(broccoli,50,'mL')).toEqual(unknownNutrition());
});
it('does not seed or change user records; meal and recipe snapshots survive a reference revision',async()=>{
 const personal:PantryItem={...stamp(),name:'Fictional personal food',nameZh:'',brand:'',basis:'100g',servingGrams:null,...unknownNutrition()};await db.ingredients.put(personal);
 const line=builtInFoodLine(broccoli,50,'en');
 const meal={...stamp(),date:'2035-03-06',category:'lunch',name:line.name,source:'pantry' as const,sourceId:broccoli.id,quantity:50,unit:'g',nutrition:line.nutrition,baseNutrition:{...line.nutrition},lines:[],cookingNote:''};
 await foodLogs.put(meal);await db.recipes.put({...stamp(),name:'Fictional reference recipe',servings:1,lines:[line],instructions:'',stickyNote:''});
 const before=await exportAll();searchFoodChoices([personal],'','',tags);builtInFoodLine({...broccoli,kcalPer100g:44.979},50,'zh');
 expect((await exportAll()).tables).toEqual(before.tables);expect(await db.ingredients.toArray()).toEqual([personal]);expect(await foodLogs.get(meal.id)).toEqual(meal);expect(line.nutrition.calories).toBe(15.5);expect(db.verno).toBe(6);
});
