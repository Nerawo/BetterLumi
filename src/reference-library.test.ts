import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import {db,stamp,exportAll,restoreAll,unknownNutrition,type PantryItem} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {builtInExercises} from './data/builtInExercises';
import {builtInTags,ingredientTagOptions} from './data/builtInTags';
import {ingredientTags,saveIngredientTag,putTaggedIngredient,filterIngredients,deleteIngredientTag} from './ingredient-tags';
import {searchFoodChoices,safeReferenceUrl} from './reference-library';

afterEach(async()=>{for(const table of db.tables)await table.clear()});
const userItem=(tagIds:string[]=[]):PantryItem=>({...stamp(),name:'Fictional user entry',nameZh:'',brand:'',basis:'100g',servingGrams:null,...unknownNutrition(),tagIds});

it('offers nine stable bilingual default tags without translating custom names',()=>{
 expect(builtInTags).toHaveLength(9);expect(new Set(builtInTags.map(tag=>tag.id)).size).toBe(9);
 const custom=[{id:'custom',name:'User 自定义'}],zh=ingredientTagOptions(custom,'zh-CN'),en=ingredientTagOptions(custom,'en');
 expect(zh[0].name).toBe('蔬菜');expect(en[0].name).toBe('Vegetables');expect(zh[8].name).toBe('调味 / 其他');expect(en[8].name).toBe('Condiments & Other');expect(zh.at(-1)?.name).toBe(custom[0].name);expect(en.at(-1)?.name).toBe(custom[0].name);
 expect(zh.map(tag=>tag.id)).toEqual(en.map(tag=>tag.id));expect(custom).toEqual([{id:'custom',name:'User 自定义'}]);
});
it('composes static references without seeding records and supports an empty reference catalog',async()=>{
 const existing=userItem();await db.ingredients.put(existing);await db.activities.put({...stamp(),date:'2020-01-06',type:'other',name:'Fictional custom movement',duration:null,caloriesBurned:null,distance:null,notes:'Keep'});await db.settings.put({key:'language',value:'en'});
 const before=await exportAll();expect(builtInFoods).toHaveLength(206);expect(builtInExercises).toHaveLength(15);expect(Object.isFrozen(builtInFoods)).toBe(true);expect(Object.isFrozen(builtInExercises)).toBe(true);
 const options=ingredientTagOptions([], 'en');expect(searchFoodChoices([existing],'','',options,[])).toEqual([{kind:'user',item:existing}]);expect(searchFoodChoices([],'','',options,[])).toEqual([]);expect(searchFoodChoices([],'','',options)).toHaveLength(202);expect(await ingredientTags.count()).toBe(0);expect((await exportAll()).tables).toEqual(before.tables);expect(db.verno).toBe(7);
});
it('persists only explicitly chosen associations and preserves defaults through backup roundtrip',async()=>{
 const custom=await saveIngredientTag('Fictional custom tag'),defaultId=builtInTags[0].id,item=userItem([defaultId,custom.id]);await putTaggedIngredient(item);
 expect(await ingredientTags.count()).toBe(1);expect(await db.ingredients.get(item.id)).toEqual(item);
 const tags=ingredientTagOptions([custom],'en');expect(filterIngredients([item],'vegetables',defaultId,tags)).toEqual([item]);expect(searchFoodChoices([item],'fictional',custom.id,tags)).toHaveLength(1);
 const backup=await exportAll();await restoreAll(backup);expect(await db.ingredients.get(item.id)).toEqual(item);expect(await ingredientTags.count()).toBe(1);expect(backup.version).toBe(10);
 await deleteIngredientTag(custom);expect((await db.ingredients.get(item.id))?.tagIds).toEqual([defaultId]);expect(await db.ingredients.count()).toBe(1);
});
it('accepts older backups without tag definitions without inserting defaults',async()=>{
 const existing=userItem();await db.ingredients.put(existing);const old=await exportAll();old.version=5;delete old.tables.ingredientTags;await restoreAll(old);expect(await ingredientTags.count()).toBe(0);expect(await db.ingredients.get(existing.id)).toEqual(existing);expect(ingredientTagOptions([],'en')).toHaveLength(9);
});
it('uses safe source links without enabling script or insecure URL schemes',()=>{
 expect(safeReferenceUrl('https://example.com/reference')).toBe('https://example.com/reference');expect(safeReferenceUrl('javascript:alert(1)')).toBeNull();expect(safeReferenceUrl('http://example.com')).toBeNull();expect(safeReferenceUrl('invalid')).toBeNull();
});
