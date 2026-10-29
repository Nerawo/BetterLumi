import 'fake-indexeddb/auto';
import {afterEach,it,expect} from 'vitest';
import {db,stamp,exportAll,restoreAll,ingredientNutrition} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {builtInFoodNutrition,type FoodChoice} from './reference-library';
import {baseUnit,personalUnits,personalNutrition,preferredFoodUnit,saveIngredientPreference,ingredientPreferenceRows,validIngredientPreference,ingredientPreferencePrefix,type IngredientPreference} from './ingredient-preferences';
const food:FoodChoice={kind:'built-in',item:builtInFoods[0]},preferences:IngredientPreference={version:1,units:[{quantity:1,name:'piece',amount:55,unit:'g'},{quantity:1,name:'pair',amount:110,unit:'g'}],preferred:'piece',archived:false};
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('keeps immutable reference nutrition and base units while scaling fractional personal servings',()=>{
 const before=structuredClone(food.item);expect(baseUnit(food)).toBe('g');expect(preferredFoodUnit(food,preferences)).toBe('piece');expect(personalNutrition(food,2,'piece',preferences)).toEqual(builtInFoodNutrition(food.item as typeof builtInFoods[number],110,'g'));expect(personalNutrition(food,.5,'piece',preferences)).toEqual(builtInFoodNutrition(food.item as typeof builtInFoods[number],27.5,'g'));expect(food.item).toEqual(before);expect(personalNutrition(food,55,'g',preferences)).toEqual(builtInFoodNutrition(food.item as typeof builtInFoods[number],55,'g'));
});
it.each([0,-1,NaN,Infinity])('rejects invalid quantity/amount factors %s without saving',async factor=>{
 for(const field of ['quantity','amount'] as const){const p={...preferences,units:[{...preferences.units[0],[field]:factor}]};expect(validIngredientPreference(food,p)).toBe(false);await expect(saveIngredientPreference(food,p)).rejects.toThrow()}expect(await db.settings.count()).toBe(0);
});
it('rejects duplicate/reserved names, unsupported default and implicit density conversions',()=>{
 for(const units of [[preferences.units[0],{...preferences.units[1],name:'PIECE'}],[{...preferences.units[0],name:'g'}],[{...preferences.units[0],unit:'mL' as const}]])expect(validIngredientPreference(food,{...preferences,units})).toBe(false);expect(validIngredientPreference(food,{...preferences,preferred:'missing'})).toBe(false);expect(personalNutrition(food,100,'mL',preferences)).toEqual({calories:null,protein:null,carbs:null,fat:null});
});
it('unit edits, removal and archive/restore never rewrite reference records or history snapshots',async()=>{
 const line={ingredientId:food.item.id,name:'Historical food',quantity:2,unit:'piece',nutrition:personalNutrition(food,2,'piece',preferences)};const recipe={...stamp(),name:'Synthetic recipe',servings:1,lines:[line],instructions:'Keep',stickyNote:''};await db.table('recipeCards').put(recipe);const initial=await exportAll();await saveIngredientPreference(food,preferences);await saveIngredientPreference(food,{...preferences,units:[{...preferences.units[0],amount:60}],archived:true});await saveIngredientPreference(food,{...preferences,units:[],preferred:'g',archived:false});const after=await exportAll();for(const key of Object.keys(initial.tables))if(key!=='settings')expect(after.tables[key]).toEqual(initial.tables[key]);expect(await db.ingredients.count()).toBe(0);expect(await db.table('recipeCards').get(recipe.id)).toEqual(recipe);
});
it('Backup 9 round-trips all personal units, preferred unit and archive state; older backups remain valid',async()=>{
 const old=await exportAll();await saveIngredientPreference(food,{...preferences,archived:true});const backup=await exportAll();expect(backup.version).toBe(10);expect(db.verno).toBe(7);await restoreAll(backup);expect(ingredientPreferenceRows(await db.settings.toArray())[food.item.id]).toEqual({...preferences,archived:true});await restoreAll(old);expect(await db.settings.get(ingredientPreferencePrefix+food.item.id)).toBeUndefined();await restoreAll({...old,version:8});expect(db.verno).toBe(7);
});
it('preserves legacy custom ingredient conversions and supports explicit personal replacement/removal',()=>{
 const item={...stamp(),name:'Synthetic liquid',nameZh:'',brand:'',basis:'100g' as const,referenceAmount:222,referenceUnit:'mL' as const,servingGrams:null,calories:111,protein:4,carbs:12,fat:3,consumptionUnit:{quantity:1,name:'can',amount:222,unit:'mL' as const}},choice:FoodChoice={kind:'user',item};expect(personalUnits(choice)).toEqual([item.consumptionUnit]);expect(personalNutrition(choice,2,'can')).toEqual(ingredientNutrition(item,2,'can'));expect(personalUnits(choice,{version:1,units:[],preferred:'mL',archived:false})).toEqual([]);expect(validIngredientPreference(choice,{version:1,units:[item.consumptionUnit],preferred:'can',archived:false})).toBe(true);
});
