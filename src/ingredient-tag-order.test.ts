import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,exportAll,restoreAll,stamp,unknownNutrition,type PantryItem} from './domain';
import {ingredientTags,saveIngredientTag,deleteIngredientTag} from './ingredient-tags';
import {ingredientTagOptions,builtInTags} from './data/builtInTags';
import {orderedItems} from './collection-order';
import {applyIngredientTagOrder,ingredientTagOrderKey,moveIngredientTag,parseIngredientTagOrder} from './ingredient-tag-order';
afterEach(async()=>{for(const table of db.tables)await table.clear()});
const ids=()=>builtInTags.map(tag=>tag.id);
const visible=async()=>applyIngredientTagOrder(ingredientTagOptions(orderedItems(await ingredientTags.filter(tag=>!tag.deletedAt).toArray()),'en'),parseIngredientTagOrder((await db.settings.get(ingredientTagOrderKey))?.value));

it('defaults to current built-in order followed by legacy custom order without writes',async()=>{
 await ingredientTags.bulkPut([{...stamp(),id:'a',name:'Legacy A'},{...stamp(),id:'z',name:'Legacy Z'}]);
 const before=await exportAll();expect((await visible()).map(tag=>tag.id)).toEqual([...ids(),'a','z']);expect((await exportAll()).tables).toEqual(before.tables);expect(await db.settings.get(ingredientTagOrderKey)).toBeUndefined();
});
it('persists an interleaved stable-ID preference without rewriting tag definitions or associations',async()=>{
 const a=await saveIngredientTag('Fictional A'),b=await saveIngredientTag('Fictional B');const item:PantryItem={...stamp(),name:'Fictional food',nameZh:'',brand:'',basis:'100g',servingGrams:null,tagIds:[a.id,ids()[0]],...unknownNutrition()};await db.ingredients.put(item);const before=await exportAll();
 await moveIngredientTag(a.id,ids()[1]);expect((await visible()).map(tag=>tag.id).slice(0,4)).toEqual([ids()[0],a.id,ids()[1],ids()[2]]);
 await moveIngredientTag(ids()[2],a.id);expect((await visible()).map(tag=>tag.id).slice(0,4)).toEqual([ids()[0],ids()[2],a.id,ids()[1]]);
 await moveIngredientTag(a.id,-1);expect((await visible()).map(tag=>tag.id).slice(0,3)).toEqual([ids()[0],a.id,ids()[2]]);
 const after=await exportAll();for(const name of Object.keys(before.tables).filter(name=>name!=='settings'))expect(after.tables[name]).toEqual(before.tables[name]);expect(await ingredientTags.toArray()).toHaveLength(2);expect(await db.ingredients.get(item.id)).toEqual(item);expect(await ingredientTags.get(b.id)).toEqual(b);
 expect(parseIngredientTagOrder((await db.settings.get(ingredientTagOrderKey))?.value)).toHaveLength(11);expect(db.verno).toBe(7);expect(after.version).toBe(10);
});
it('appends future built-in/custom tags and ignores removed or duplicate preferred IDs',()=>{
 const available=[...ingredientTagOptions([{id:'custom-a',name:'A'}],'en'),{id:'future-built-in',name:'Future',builtIn:true},{id:'new-custom',name:'New'}];const order=['custom-a',...ids(),'missing','custom-a'];
 expect(applyIngredientTagOrder(available,order).map(tag=>tag.id)).toEqual(['custom-a',...ids(),'future-built-in','new-custom']);
 expect(applyIngredientTagOrder([{id:'same',builtIn:true},{id:'same',builtIn:false}],[])).toEqual([{id:'same',builtIn:true}]);
});
it('retains custom rename positions, appends new tags and reconciles deletions without phantom rows',async()=>{
 const a=await saveIngredientTag('A');await moveIngredientTag(a.id,ids()[0]);await saveIngredientTag('Renamed',a);expect((await visible())[0].name).toBe('Renamed');const b=await saveIngredientTag('B');expect((await visible()).at(-1)?.id).toBe(b.id);await deleteIngredientTag(a);expect((await visible()).some(tag=>tag.id===a.id)).toBe(false);expect((await visible()).at(-1)?.id).toBe(b.id);
});
it('keeps IDs/order independent of interface language or user-created names',()=>{
 const custom=[{id:'custom',name:'My 自定义'}],preferred=['custom',...ids().reverse()];const zh=applyIngredientTagOrder(ingredientTagOptions(custom,'zh'),preferred),en=applyIngredientTagOrder(ingredientTagOptions(custom,'en'),preferred);expect(zh.map(tag=>tag.id)).toEqual(en.map(tag=>tag.id));expect(zh[0].name).toBe(custom[0].name);expect(en[0].name).toBe(custom[0].name);
});
it('preserves ordering through the current backup format and accepts older backups without the preference',async()=>{
 const a=await saveIngredientTag('A');await moveIngredientTag(a.id,ids()[0]);const expected=(await visible()).map(tag=>tag.id),backup=await exportAll();await restoreAll(backup);expect((await visible()).map(tag=>tag.id)).toEqual(expected);expect((await exportAll()).tables).toEqual(backup.tables);
 const old=structuredClone(backup);old.tables.settings=old.tables.settings.filter(row=>(row as {key:string}).key!==ingredientTagOrderKey);await restoreAll(old);expect((await visible()).map(tag=>tag.id)).toEqual([...ids(),a.id]);
});
it('handles malformed settings and invalid moves without writes or new records',async()=>{
 for(const raw of [undefined,'bad json','null','{}','42'])expect(parseIngredientTagOrder(raw)).toEqual([]);expect(parseIngredientTagOrder('["one",null,1,"one","","two"]')).toEqual(['one','two']);
 const before=await exportAll();for(const target of [-1,99,NaN,0,'missing'])await moveIngredientTag(ids()[0],target);await moveIngredientTag('All',ids()[0]);expect((await exportAll()).tables).toEqual(before.tables);expect(await ingredientTags.count()).toBe(0);
});
