import {it,expect} from 'vitest';
import {sortRecipes} from './recipe-sort';
import type {Recipe} from './domain';
import {builtInRecipeItems} from './data/builtInRecipes';
const recipe=(id:string,name:string,calories:number|null,servings=1)=>({id,name,servings,lines:[{ingredientId:'fictional',name:'Fictional',quantity:1,unit:'g',nutrition:{calories,protein:null,carbs:null,fat:null}}]} as Recipe);
it('sorts per serving rather than whole recipe, keeps zero, and never mutates sources',()=>{
 const a=recipe('a','Batch',400,20),b=recipe('b','Single',100),zero=recipe('z','Zero',0),unknown=recipe('u','Unknown',null),invalid=recipe('n','Invalid',NaN);const rows=[unknown,b,invalid,a,zero],before=structuredClone(rows);
 expect(sortRecipes(rows,'calories-asc','en').map(r=>r.id)).toEqual(['z','a','b','n','u']);expect(sortRecipes(rows,'calories-desc','en').map(r=>r.id)).toEqual(['b','a','z','n','u']);expect(rows).toEqual(before);
});
it('uses the same locale-aware numeric name ordering as Pantry with deterministic ties',()=>{
 const rows=[recipe('b','苹果2',20),recipe('a','苹果2',20),recipe('c','苹果10',20),recipe('d','香蕉',20)];const expected=[...rows].sort((a,b)=>a.name.localeCompare(b.name,'zh',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id,'en'));
 expect(sortRecipes(rows,'name-asc','zh')).toEqual(expected);expect(sortRecipes(rows,'name-desc','zh').map(r=>r.name)).toEqual(expected.map(r=>r.name).reverse());expect(sortRecipes([...rows].reverse(),'calories-asc','zh')).toEqual(expected);
});
it('sorts reference and user recipes together and supports legacy one-serving fallback',()=>{
 const legacy=recipe('legacy','Legacy',12);delete (legacy as Partial<Recipe>).servings;const rows=[...builtInRecipeItems('en'),legacy,recipe('zero','Zero',0)];expect(sortRecipes(rows,'calories-asc','en')[0].id).toBe('zero');const names=sortRecipes(rows,'name-asc','en').map(r=>r.name);expect(names).toEqual([...names].sort((a,b)=>a.localeCompare(b,'en',{numeric:true,sensitivity:'base'})));expect(sortRecipes(rows,'calories-desc','en')).toContain(legacy);
});
