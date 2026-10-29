import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {normalizeIngredientNutrition} from './ingredient-nutrition';
import {db,stamp,ingredientNutrition,scaleNutrition,sumNutrition,recipes,foodLogs,exportAll,restoreAll,type PantryItem} from './domain';
import {personalNutrition,userChoice} from './ingredient-preferences';
import {builtInFoods} from './data/builtInFoods';
import {builtInFoodNutrition} from './reference-library';
import {wholeRecipeNutrition} from './recipe-nutrition';
const item=(nutrition:Partial<PantryItem>={}):PantryItem=>({...stamp(),name:'Synthetic optional macros',nameZh:'',brand:'',basis:'100g',referenceAmount:100,referenceUnit:'g',servingGrams:null,calories:200,protein:10,carbs:20,fat:5,...nutrition});
afterEach(async()=>{for(const table of db.tables)await table.clear()});

it('preserves explicit calories, zero, full precision and populated macros rather than deriving energy',()=>{
 const value={calories:201.12345,protein:0,carbs:2.34567,fat:8.90123};expect(normalizeIngredientNutrition(value)).toEqual(value);expect(ingredientNutrition(item(value),25,'g')).toEqual({calories:50.2808625,protein:0,carbs:0.5864175,fat:2.2253075});
});
it.each([null,undefined,'','  '])('normalizes blank %s optional macros on a copy without altering calorie values or legacy input',blank=>{
 const input={calories:200,protein:blank,carbs:blank,fat:blank},before={...input};expect(normalizeIngredientNutrition(input)).toEqual({calories:200,protein:0,carbs:0,fat:0});expect(input).toEqual(before);
 const legacy=item(input as Partial<PantryItem>),copy=structuredClone(legacy);expect(personalNutrition(userChoice(legacy),37.5,'g')).toEqual({calories:75,protein:0,carbs:0,fat:0});expect(legacy).toEqual(copy);
});
it('fills only missing macros and keeps wholly unknown food/unsupported units unknown',()=>{
 expect(normalizeIngredientNutrition({calories:0,protein:null,carbs:0,fat:0})).toEqual({calories:0,protein:0,carbs:0,fat:0});expect(ingredientNutrition(item({protein:null,carbs:3.25,fat:0}),50,'g')).toEqual({calories:100,protein:0,carbs:1.625,fat:0});
 expect(normalizeIngredientNutrition({calories:null,protein:null,carbs:undefined,fat:''})).toEqual({calories:null,protein:null,carbs:null,fat:null});expect(ingredientNutrition(item({protein:null}),100,'mL')).toEqual({calories:null,protein:null,carbs:null,fat:null});
});
it.each([NaN,Infinity,-Infinity,-1,'NaN','12.5',{},false])('rejects invalid nutrient %s without coercing it to zero',invalid=>{
 for(const key of ['calories','protein','carbs','fat']as const)expect(()=>normalizeIngredientNutrition({calories:200,protein:1,carbs:2,fat:3,[key]:invalid})).toThrow('Invalid ingredient nutrition');
});
it('supports serving, decimal reference and custom-unit factors without changing their formulas',()=>{
 expect(ingredientNutrition(item({basis:'serving',servingGrams:40,protein:null,carbs:null,fat:null}),2,'serving')).toEqual({calories:400,protein:0,carbs:0,fat:0});
 expect(ingredientNutrition(item({referenceAmount:32.5,referenceUnit:'mL',protein:null}),16.25,'mL')).toEqual({calories:100,protein:0,carbs:10,fat:2.5});
 expect(personalNutrition(userChoice(item({protein:null})),.5,'piece',{version:1,units:[{quantity:2,name:'piece',amount:50,unit:'g'}],preferred:'piece',archived:false})).toEqual({calories:25,protein:0,carbs:2.5,fat:.625});
});
it('adds mixed built-in/custom nutrition independently and scales saved lines without rounding',async()=>{
 const custom=item({protein:null,carbs:null,fat:null});await db.ingredients.put(custom);const banana=builtInFoods.find(f=>f.id==='builtin-banana-raw')!,referenceBefore=structuredClone(banana);
 const lines=[{ingredientId:custom.id,name:custom.name,quantity:100,unit:'g',nutrition:personalNutrition(userChoice(custom),100,'g')},{ingredientId:banana.id,name:banana.nameZh,quantity:100,unit:'g',nutrition:builtInFoodNutrition(banana,100,'g')}];
 expect(wholeRecipeNutrition(lines)).toEqual({calories:297,protein:.74,carbs:23,fat:.29});const recipe={...stamp(),name:'Mixed optional macro recipe',servings:1,lines,instructions:'Keep',stickyNote:''};await recipes.put(recipe);db.close();await db.open();const saved=(await recipes.get(recipe.id))!;saved.lines[0]={...saved.lines[0],quantity:37.5,nutrition:scaleNutrition(saved.lines[0].nutrition,.375)};await recipes.put(saved);expect(wholeRecipeNutrition((await recipes.get(recipe.id))!.lines)).toEqual({calories:172,protein:.74,carbs:23,fat:.29});expect(await db.ingredients.get(custom.id)).toEqual(custom);expect(banana).toEqual(referenceBefore);
});
it('never rewrites old recipe/meal snapshots or changes global null/backup semantics',async()=>{
 const custom=item({protein:null,carbs:null,fat:null});await db.ingredients.put(custom);const nutrition={calories:137,protein:null,carbs:0,fat:4},line={ingredientId:custom.id,name:custom.name,quantity:50,unit:'g',nutrition};const recipe={...stamp(),name:'Historical recipe',servings:1,lines:[line],instructions:'Keep',stickyNote:''},log={...stamp(),date:'2020-01-01',category:'lunch',name:'Historical meal',source:'pantry' as const,sourceId:custom.id,quantity:50,unit:'g',nutrition,lines:[],cookingNote:''};await recipes.put(recipe);await foodLogs.put(log);const before=await exportAll();personalNutrition(userChoice(custom),100,'g');expect((await exportAll()).tables).toEqual(before.tables);expect(sumNutrition([nutrition,{calories:100,protein:2,carbs:3,fat:0}])).toEqual({calories:237,protein:null,carbs:3,fat:4});expect(scaleNutrition(nutrition,2)).toEqual({calories:274,protein:null,carbs:0,fat:8});await restoreAll(before);expect(await recipes.get(recipe.id)).toEqual(recipe);expect(await foodLogs.get(log.id)).toEqual(log);expect(await db.ingredients.get(custom.id)).toEqual(custom);expect(before.version).toBe(10);expect(db.verno).toBe(7);expect(db.name).toBe('BetterLumi');
});
it('does not relax Backup 9 validation for unsupported empty-string or missing stored fields',async()=>{
 await db.ingredients.put(item());const before=await exportAll();for(const value of ['',undefined,NaN,'12']){const invalid=structuredClone(before);(invalid.tables.ingredients[0] as Record<string,unknown>).protein=value;await expect(restoreAll(invalid)).rejects.toThrow();expect((await exportAll()).tables).toEqual(before.tables)}
});
