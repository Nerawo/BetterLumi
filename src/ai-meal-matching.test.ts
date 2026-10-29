import {expect,it} from 'vitest';
import {stamp,type PantryItem,type Recipe} from './domain';
import {builtInFoods} from './data/builtInFoods';
import {builtInRecipeItems} from './data/builtInRecipes';
import {builtInHouseholdUnits} from './household-units';
import {personalNutrition,type IngredientPreference} from './ingredient-preferences';
import {recipeServingNutrition} from './recipe-nutrition';
import {createAIMealDraft,selectAIMealDraftSource,editAIMealDraftRow} from './ai-meal-state';
import {matchAIMealFood,pantryAIMealSource,recipeAIMealSource,type AIMealCatalog} from './ai-meal-matching';
const ingredient=(patch:Partial<PantryItem>={}):PantryItem=>({...stamp(),name:'Synthetic liquid',nameZh:'测试饮品',aliases:['Synthetic alias'],brand:'',basis:'100g',referenceAmount:222,referenceUnit:'mL',servingGrams:null,calories:111,protein:4,carbs:12,fat:0,...patch});
const recipe=(name='Synthetic recipe'):Recipe=>({...stamp(),name,servings:2,lines:[{ingredientId:'original-id',name:'Original line',quantity:100,unit:'g',nutrition:{calories:333.123456,protein:null,carbs:30,fat:4}}],instructions:'',stickyNote:''});
const catalog=(patch:Partial<AIMealCatalog>={}):AIMealCatalog=>({ingredients:[],recipes:[],preferences:{},...patch});
const portion=(amount=2,unit='份')=>({amount,unit,weightG:null});
const row=()=>createAIMealDraft(JSON.stringify({format:'betterlumi-meal',version:1,meals:[{date:null,mealType:null,items:[{name:'Synthetic food',date:null,mealType:null,amount:2,unit:'份',weightG:null,consumedFraction:.5,nutrition:{calories:123,protein:null,carbs:20,fat:0},estimated:true,notes:null,splitSuggestions:[]}]}]})).rows[0];
it('finds built-in foods by everyday Chinese and English names without duplicate rice variants',()=>{
 for(const name of ['梨','Pear','米饭','大米','芒果']){const result=matchAIMealFood(name,catalog(),'zh');expect(result.candidates.length,name).toBeGreaterThan(0);expect(result.automatic,name).not.toBeNull()}
 expect(matchAIMealFood('米饭',catalog(),'zh').candidates.filter(c=>c.rank===0)).toHaveLength(1);
});
it('keeps explicit variety aliases and meaningful meat distinctions instead of stripping qualifiers',()=>{
 const specific=matchAIMealFood('Bartlett',catalog(),'en');expect(specific.candidates.length).toBeGreaterThan(0);expect(specific.automatic).toBeNull();
 const chicken=matchAIMealFood('鸡腿肉',catalog(),'zh');expect(chicken.candidates.length).toBeGreaterThan(1);expect(chicken.automatic).toBeNull();expect(chicken.candidates.some(c=>c.name.includes('去皮'))).toBe(true);expect(chicken.candidates.some(c=>c.name.includes('带皮'))).toBe(true);
});
it('matches personal names and aliases but never auto-selects ambiguous names or substring suggestions',()=>{
 const a=ingredient(),b=ingredient();expect(matchAIMealFood('Ｓｙｎｔｈｅｔｉｃ liquid',catalog({ingredients:[a]}),'en').automatic?.id).toBe(a.id);expect(matchAIMealFood('Synthetic alias',catalog({ingredients:[a]}),'en').automatic?.id).toBe(a.id);expect(matchAIMealFood('Synthetic liquid',catalog({ingredients:[a,b]}),'en').automatic).toBeNull();expect(matchAIMealFood('Synthetic',catalog({ingredients:[a]}),'en').automatic).toBeNull();
 const r=recipe(a.name);expect(matchAIMealFood(a.name,catalog({ingredients:[a],recipes:[r]}),'en').automatic).toBeNull();
});
it('excludes archived and deleted choices without modifying catalog, preferences or records',()=>{
 const a=ingredient(),r=recipe(),food=builtInFoods[0],c=catalog({ingredients:[a],recipes:[{...r,deletedAt:'2026-10-29'}],preferences:{[a.id]:{version:1,units:[],preferred:'mL',archived:true},[food.id]:{version:1,units:[],preferred:'g',archived:true}}}),before=structuredClone(c);
 expect(matchAIMealFood(a.name,c,'en').candidates).toEqual([]);expect(matchAIMealFood(r.name,c,'en').candidates).toEqual([]);expect(matchAIMealFood(food.nameEn,c,'en').candidates.some(candidate=>candidate.id===food.id)).toBe(false);expect(c).toEqual(before);
});
it('composes built-in recipes bilingually and selects saved per-serving nutrition without guessed cooked weights',()=>{
 const builtin=builtInRecipeItems('en')[0];expect(matchAIMealFood(builtin.name,catalog(),'zh').automatic?.id).toBe(builtin.id);const r=recipe(),source=recipeAIMealSource(r,portion(3));const selected=selectAIMealDraftSource(row(),source.baseline,source.portion);expect(selected.item.nutrition).toEqual(recipeServingNutrition(r,3));expect(selected.item.consumedFraction).toBe(.5);expect(()=>recipeAIMealSource(r,portion(100,'g'))).toThrow(/servings explicitly/);expect(r.lines[0].quantity).toBe(100);
});
it('uses existing reference amounts and custom conversions, preserves zero and refuses implicit mL-to-g conversion',()=>{
 const item=ingredient(),choice={kind:'user' as const,item},p:IngredientPreference={version:1,units:[{quantity:1,name:'can',amount:222,unit:'mL'}],preferred:'can',archived:false};
 const source=pantryAIMealSource(choice,portion(2,'can'),p),selected=selectAIMealDraftSource(row(),source.baseline,source.portion);expect(selected.item.nutrition).toEqual(personalNutrition(choice,2,'can',p));expect(selected.item.nutrition.calories).toBe(222);expect(editAIMealDraftRow(selected,{amount:1}).item.nutrition.calories).toBe(111);expect(selected.item.nutrition.fat).toBe(0);expect(()=>pantryAIMealSource(choice,portion(100,'克'),p)).toThrow(/unit/);expect(p.preferred).toBe('can');
});
it('resolves localized official household units without changing their IDs, weights or preference precedence',()=>{
 const food=builtInFoods.find(f=>builtInHouseholdUnits(f.id).length>0)!,unit=builtInHouseholdUnits(food.id)[0],choice={kind:'built-in' as const,item:food},before=structuredClone(unit);const source=pantryAIMealSource(choice,portion(2,unit.labelZh));expect(source.portion.unit).toBe(unit.name);const selected=selectAIMealDraftSource(row(),source.baseline,source.portion);expect(selected.item.nutrition).toEqual(personalNutrition(choice,2,unit.name));expect(unit).toEqual(before);
});
it('matching never changes drafts or estimates and local scaling snapshots survive later recipe edits',()=>{
 const original=row(),r=recipe(),before=structuredClone(original);matchAIMealFood(r.name,catalog({recipes:[r]}),'en');expect(original).toEqual(before);const s=recipeAIMealSource(r,portion(2)),selected=selectAIMealDraftSource(original,s.baseline,s.portion),nutrition={...selected.item.nutrition};r.lines[0].nutrition.calories=999;expect(selected.item.nutrition).toEqual(nutrition);expect(editAIMealDraftRow(selected,{amount:1}).item.nutrition.calories).toBe(333.123456/2);
});
