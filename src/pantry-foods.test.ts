import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,exportAll,stamp,unknownNutrition,type PantryItem} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {ingredientTagOptions} from './data/builtInTags';
import {searchFoodChoices} from './reference-library';
import {pantryListNutrition,sortPantryFoods} from './pantry-foods';

afterEach(async()=>{for(const table of db.tables)await table.clear()});
const tags=ingredientTagOptions([{id:'custom-test',name:'Fictional custom tag'}],'en');
const user=():PantryItem=>({...stamp(),name:'Fictional frozen broccoli',nameZh:'测试冷冻菜',brand:'Fictional Brand',basis:'100g',referenceAmount:32,servingGrams:null,tagIds:['betterlumi:ingredient-tag:vegetables','custom-test'],...unknownNutrition()});

it.each([
 {definition:{referenceAmount:100},calories:322,expected:322,unit:'g',factor:1},
 {definition:{referenceAmount:30},calories:120,expected:400,unit:'g',factor:100/30},
 {definition:{referenceAmount:15,referenceUnit:'mL'},calories:50,expected:333,unit:'mL',factor:100/15},
 {definition:{referenceAmount:100,referenceUnit:'mL'},calories:43,expected:43,unit:'mL',factor:1},
 {definition:{basis:'serving',servingGrams:25,consumptionUnit:{name:'piece',quantity:1,amount:25,unit:'g'}},calories:80,expected:320,unit:'g',factor:4},
 {definition:{basis:'serving',servingGrams:null},calories:80,expected:80,unit:'serving',factor:1},
] as const)('shows $expected kcal on the $unit basis across browsing states',({definition,calories,expected,unit,factor})=>{
 const item={...user(),...definition,calories,protein:3,carbs:6,fat:2},before=structuredClone(item);
 for(const [query,tag] of [['',''],['fictional',''],['fictional','custom-test']]){
  for(const sort of ['name-asc','calories-desc'] as const){
   const choice=sortPantryFoods(searchFoodChoices([item],query,tag,tags),sort,'en').find(c=>c.item.id===item.id);
   if(choice?.kind!=='user')throw Error('Missing personal ingredient');
   const row=pantryListNutrition(choice.item);
   expect(row.basis).toEqual({amount:unit==='serving'?1:100,unit});
   expect(Math.round(row.nutrition.calories!)).toBe(expected);
   for(const key of ['protein','carbs','fat'] as const)expect(row.nutrition[key]).toBeCloseTo(item[key]*factor);
  }
 }
 expect(item).toEqual(before);
});

it.each([['vegetables',38],['fruits',32],['dairy-eggs',3]] as const)('composes the %s category with its exact static count',(category,count)=>{
 const result=sortPantryFoods(searchFoodChoices([],'',`betterlumi:ingredient-tag:${category}`,tags),'name-asc','en');expect(result).toHaveLength(count);expect(result.every(food=>food.kind==='built-in')).toBe(true);
});
it('includes personal foods in category counts and combines search with the active tag',()=>{
 const first=user(),second={...user(),name:'Another fictional vegetable'},items=[first,second];
 expect(searchFoodChoices(items,'','betterlumi:ingredient-tag:vegetables',tags)).toHaveLength(40);
 expect(searchFoodChoices(items,'broccoli','betterlumi:ingredient-tag:vegetables',tags)).toHaveLength(2);
 expect(searchFoodChoices(items,'broccoli','betterlumi:ingredient-tag:fruits',tags)).toEqual([]);
 expect(searchFoodChoices(items,'fictional brand','',tags).map(food=>food.item.id)).toEqual(items.map(item=>item.id));
 expect(searchFoodChoices(items,'测试冷冻菜','',tags)).toHaveLength(2);expect(searchFoodChoices(items,'fictional custom tag','',tags)).toHaveLength(2);
});
it('sorts the combined list without changing references, inputs or saved nutrition bases',()=>{
 const personal={...user(),calories:0},missing={...user(),name:'Fictional unknown nutrition'},result=searchFoodChoices([personal,missing],'','',tags),before=structuredClone(result);
 const asc=sortPantryFoods(result,'calories-asc','en'),desc=sortPantryFoods(result,'calories-desc','en');
 expect(asc[0].item.id).toBe(personal.id);expect(desc[0].item.id).toBe('builtin-olive-oil');expect(asc.at(-1)?.item.id).toBe(missing.id);expect(desc.at(-1)?.item.id).toBe(missing.id);
 expect(sortPantryFoods(result,'name-desc','en').map(food=>food.item.id)).toEqual(sortPantryFoods(result,'name-asc','en').map(food=>food.item.id).reverse());
 expect(result).toEqual(before);expect(personal.referenceAmount).toBe(32);expect(personal.calories).toBe(0);expect(builtInFoods).toHaveLength(206);
});
it('returns a genuinely empty combined set only when neither source matches',()=>{
 expect(searchFoodChoices([],'','',tags)).toHaveLength(202);expect(searchFoodChoices([user()],'no such food','',tags)).toEqual([]);
 expect(searchFoodChoices([user()],'','custom-test',tags)).toHaveLength(1);expect(searchFoodChoices([],'','custom-test',tags)).toEqual([]);
});
it('never writes composed rows to IndexedDB or changes existing tables',async()=>{
 const item=user();await db.ingredients.put(item);const before=await exportAll();
 for(const sort of ['name-asc','name-desc','calories-asc','calories-desc'] as const)expect(sortPantryFoods(searchFoodChoices([item],'','',tags),sort,'zh')).toHaveLength(203);
 expect((await exportAll()).tables).toEqual(before.tables);expect(await db.ingredients.toArray()).toEqual([item]);expect(db.verno).toBe(8);
});
