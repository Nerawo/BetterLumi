import 'fake-indexeddb/auto';
import {afterEach,it,expect} from 'vitest';
import {db,stamp,exportAll,restoreAll,recipes,type PantryItem} from './domain';
import {ingredientTags,saveIngredientTag,deleteIngredientTag,putTaggedIngredient,filterIngredients} from './ingredient-tags';
import {categories,saveCategory,filterRecipes,findOrCreateCategory,deleteCategory} from './categories';
import {orderedItems,moveOrderedItem} from './collection-order';
afterEach(async()=>{for(const table of db.tables)await table.clear()});
const ingredient=(tagIds:string[]):PantryItem=>({...stamp(),name:'巧克力',nameZh:'Chocolate',brand:'Brand',basis:'100g',servingGrams:null,calories:10,protein:null,carbs:0,fat:null,tagIds});
it('searches only associated active names with AND filtering, updating after rename',async()=>{
 const cocoa=await saveIngredientTag('可可'),other=await saveIngredientTag('Other');const i=ingredient([cocoa.id]);await putTaggedIngredient(i);
 expect(filterIngredients([i],' 可 ',cocoa.id,await ingredientTags.toArray())).toEqual([i]);expect(filterIngredients([i],'可可',other.id,await ingredientTags.toArray())).toEqual([]);
 await saveIngredientTag('Cocoa',cocoa);expect(filterIngredients([i],'可可','',await ingredientTags.toArray())).toEqual([]);expect(filterIngredients([i],' COCO ','',await ingredientTags.toArray())).toEqual([i]);
 await saveCategory('Dessert');const c=(await categories.toArray())[0],r={...stamp(),name:'Cake',servings:1,categoryIds:[c.id],lines:[],instructions:'',stickyNote:''};await recipes.put(r);
 expect(filterRecipes([r],' SSeRt ',c.id,await categories.toArray())).toEqual([r]);expect(filterRecipes([r],'Cocoa','',await categories.toArray())).toEqual([]);
});
it('persists stable custom ordering, appends creations, retains rename positions and backup order',async()=>{
 const a=await saveIngredientTag('A'),b=await saveIngredientTag('B'),c=await saveIngredientTag('C');await moveOrderedItem(ingredientTags,c.id,a.id);
 expect(orderedItems(await ingredientTags.toArray()).map(x=>x.name)).toEqual(['C','A','B']);await saveIngredientTag('Renamed',a);const d=await saveIngredientTag('D');expect(orderedItems(await ingredientTags.toArray()).map(x=>x.name)).toEqual(['C','Renamed','B','D']);await deleteIngredientTag(b);
 for(const name of ['One','Two','Three'])await saveCategory(name);const cs=orderedItems(await categories.toArray());await moveOrderedItem(categories,cs[2].id,cs[0].id);await findOrCreateCategory('Four');
 const before=await exportAll();await restoreAll(before);expect((await exportAll()).tables).toEqual(before.tables);expect(orderedItems(await categories.toArray()).map(x=>x.name)).toEqual(['Three','One','Two','Four']);expect(orderedItems((await ingredientTags.toArray()).filter(x=>!x.deletedAt)).map(x=>x.id)).toEqual([c.id,a.id,d.id]);
 const bad=structuredClone(before);(bad.tables.ingredientTags[0] as {sortOrder:number}).sortOrder=-1;await expect(restoreAll(bad)).rejects.toThrow('Invalid collection order');expect((await exportAll()).tables).toEqual(before.tables);
 const legacy=structuredClone(before);for(const name of ['ingredientTags','recipeCategories'])for(const row of legacy.tables[name])delete (row as {sortOrder?:number}).sortOrder;await restoreAll(legacy);const old=await categories.toArray();expect(orderedItems(old).map(x=>x.id)).toEqual(old.map(x=>x.id));await deleteCategory(old[0]);expect(await recipes.count()).toBe(0);
});
it('keeps unordered legacy items before newly appended records even when IDs interleave',async()=>{
 await ingredientTags.bulkPut([{...stamp(),id:'a',name:'Legacy A'},{...stamp(),id:'z',name:'Legacy Z'}]);const created=await saveIngredientTag('New');expect(orderedItems(await ingredientTags.toArray()).map(x=>x.name)).toEqual(['Legacy A','Legacy Z','New']);await saveIngredientTag('Renamed new',created);expect(orderedItems(await ingredientTags.toArray()).map(x=>x.name)).toEqual(['Legacy A','Legacy Z','Renamed new']);
});
