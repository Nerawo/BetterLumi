import 'fake-indexeddb/auto';
import provenanceJson from '../docs/data/phase2b-usda-records.json?raw';
import {afterEach,expect,it} from 'vitest';
import {builtInFoods} from './data/builtInFoods';
import {builtInTags,ingredientTagOptions} from './data/builtInTags';
import {builtInFoodLine,builtInFoodNutrition,searchFoodChoices} from './reference-library';
import {db,foodLogs,exportAll,stamp,unknownNutrition,type PantryItem} from './domain';

const provenance=JSON.parse(provenanceJson) as {records:{fdcId:number;ndbNumber:string;description:string;dataType:string;publicationDate:string;nutrients:{id:number;amount:number;unit:string}[]}[]};
const phase2b=builtInFoods.filter(food=>provenance.records.some(record=>String(record.fdcId)===food.fdcIdSnapshot));
const tags=ingredientTagOptions([],'en');
afterEach(async()=>{for(const table of db.tables)await table.clear()});

it('adds exactly eleven foods while retaining all twelve Foundation references and static tag IDs',()=>{
 expect(phase2b).toHaveLength(11);expect(builtInFoods.filter(food=>food.id.startsWith('builtin-')&&food.sourceDataType==='Foundation Foods')).toHaveLength(12);expect(builtInFoods).toHaveLength(206);
 expect(new Set(builtInFoods.map(food=>food.id)).size).toBe(206);expect(builtInTags).toHaveLength(9);
});
it.each(provenance.records)('matches the official USDA record $fdcId, exact description, identifiers and reported nutrients',record=>{
 const food=phase2b.find(food=>food.fdcIdSnapshot===String(record.fdcId))!;expect(food).toBeDefined();
 expect(food.ndbNumber).toBe(record.ndbNumber);expect(food.usdaDescription).toBe(record.description);expect(food.sourceDataType).toBe(record.dataType);expect(food.sourceName).toBe('USDA FoodData Central');expect(food.sourceRelease).toBe('April 2018');expect(food.sourcePublishedAt).toBe('2019-04-01');expect(food.sourceRetrievedAt).toBe('2026-10-22');
 expect(food.nameZh).toBeTruthy();expect(food.nameEn).toBeTruthy();expect(food.preparationStateZh).toBeTruthy();expect(food.preparationStateEn).toBeTruthy();
 const nutrient=(id:number)=>record.nutrients.find(n=>n.id===id)?.amount??null;
 expect([food.kcalPer100g,food.proteinPer100g,food.carbsPer100g,food.fatPer100g]).toEqual([nutrient(1008),nutrient(1003),nutrient(1005),nutrient(1004)]);
 const url=new URL(food.sourceUrl);expect(url.origin).toBe('https://fdc.nal.usda.gov');expect(url.searchParams.get('query')).toBe(record.ndbNumber);
 expect(builtInFoodNutrition(food,100,'g')).toEqual({calories:nutrient(1008),protein:nutrient(1003),carbs:nutrient(1005),fat:nutrient(1004)});
});
it.each([
 ['builtin-chicken-breast-roasted','171477',/meat only, cooked, roasted/,165],
 ['builtin-ground-beef-90-lean-broiled','174031',/90% lean meat \/ 10% fat, patty, cooked, broiled/,217],
 ['builtin-white-rice-cooked','168878',/enriched, cooked$/,130],
 ['builtin-atlantic-salmon-farmed-cooked','175168',/Atlantic, farmed, cooked, dry heat/,206],
 ['builtin-oats-dry','173904',/regular and quick, not fortified, dry$/,379],
 ['builtin-tofu-firm-calcium-set','172475',/raw, firm, prepared with calcium sulfate/,144],
 ['builtin-sweet-potato-baked','168483',/cooked, baked in skin, flesh, without salt/,90],
])('protects preparation identity for %s',(id,fdc,description,kcal)=>{
 const food=phase2b.find(food=>food.id===id)!;expect(food.fdcIdSnapshot).toBe(fdc);expect(food.usdaDescription).toMatch(description);expect(food.kcalPer100g).toBe(kcal);
});
it.each([['meat',3],['seafood',2],['grains-staples',4],['legumes-soy',2]] as const)('maps %s to the existing static filter with %i foods',(category,count)=>{
 const id=`betterlumi:ingredient-tag:${category}`;expect(tags.some(tag=>tag.id===id)).toBe(true);const found=searchFoodChoices([],'',id,tags,phase2b);expect(found).toHaveLength(count);expect(found.every(food=>food.kind==='built-in'&&food.item.category===category)).toBe(true);
});
it.each([['鸡胸','builtin-chicken-breast-roasted'],['CHICKEN','builtin-chicken-breast-roasted'],['牛肉','builtin-ground-beef-90-lean-broiled'],['salmon','builtin-atlantic-salmon-farmed-cooked'],['三文鱼','builtin-atlantic-salmon-farmed-cooked'],['米饭','builtin-white-rice-cooked'],['rice','builtin-white-rice-cooked'],['豆腐','builtin-tofu-firm-calcium-set'],['oats','builtin-oats-dry']])('supports bilingual search %s',(query,id)=>{
 expect(searchFoodChoices([],query,'',tags).map(choice=>choice.item.id)).toContain(id);
});
it('retains a reported zero separately from unavailable nutrients and scales unrounded values',()=>{
 const chicken=phase2b.find(food=>food.id==='builtin-chicken-breast-roasted')!;expect(chicken.carbsPer100g).toBe(0);expect(builtInFoodNutrition({...chicken,carbsPer100g:null},50,'g').carbs).toBeNull();
 const salmon=phase2b.find(food=>food.id==='builtin-atlantic-salmon-farmed-cooked')!;expect(builtInFoodNutrition(salmon,50,'g').fat).toBe(6.175);
});
it('keeps existing records and snapshots untouched with no food or default-tag seed',async()=>{
 const user:PantryItem={...stamp(),name:'Fictional test food',nameZh:'',brand:'',basis:'100g',servingGrams:null,...unknownNutrition()};await db.ingredients.put(user);
 const salmon=phase2b.find(food=>food.id==='builtin-atlantic-salmon-farmed-cooked')!,line=builtInFoodLine(salmon,100,'en');const meal={...stamp(),date:'2035-06-12',category:'lunch',name:line.name,source:'pantry' as const,sourceId:line.ingredientId,quantity:100,unit:'g',nutrition:line.nutrition,baseNutrition:{...line.nutrition},lines:[],cookingNote:''};await foodLogs.put(meal);
 const before=await exportAll();for(const food of phase2b){searchFoodChoices([user],food.nameZh,'',tags);builtInFoodLine(food,50,'en')}
 builtInFoodLine({...salmon,kcalPer100g:165},100,'en');expect((await foodLogs.get(meal.id))?.nutrition.calories).toBe(206);expect((await exportAll()).tables).toEqual(before.tables);expect(await db.ingredients.toArray()).toEqual([user]);expect(await db.table('ingredientTags').count()).toBe(0);expect(db.verno).toBe(6);expect(before.version).toBe(9);
});
