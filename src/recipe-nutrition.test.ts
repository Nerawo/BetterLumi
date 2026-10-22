import {describe,it,expect} from 'vitest';
import {wholeRecipeNutrition,retainedRecipeNutrition} from './recipe-nutrition';
import {consumedNutrition} from './consumption';
const lines=[{ingredientId:'a',name:'oats',quantity:120,unit:'g' as const,nutrition:{calories:480,protein:12,carbs:72,fat:8}}];
describe('whole recipes and historical snapshots',()=>{
 it('uses full totals regardless of legacy serving metadata and never changes ingredient amounts',()=>{const old={servings:4,lines:structuredClone(lines)};expect(wholeRecipeNutrition(old.lines).calories).toBe(480);expect(old).toEqual({servings:4,lines});});
 it('logs full, half and quarter recipes using percentages without any serving division',()=>{const total=wholeRecipeNutrition(lines);expect([100,50,25].map(percent=>consumedNutrition(total,percent).calories)).toEqual([480,240,120]);expect(lines[0].quantity).toBe(120);});
 it('retains arbitrary historical snapshots exactly, including missing data and real zero',()=>{const old={calories:137,protein:null,carbs:0,fat:4};expect(retainedRecipeNutrition(old,50,50)).toEqual(old);expect(retainedRecipeNutrition(old,50,25)).toEqual({calories:68.5,protein:null,carbs:0,fat:2});expect(retainedRecipeNutrition(old,undefined,100)).toEqual(old);});
 it('uses an explicit saved base when adjusted and does not invent an ambiguous zero-percent base',()=>{const old={calories:0,protein:null,carbs:0,fat:0};expect(retainedRecipeNutrition(old,0,0)).toEqual(old);expect(retainedRecipeNutrition(old,0,50).calories).toBeNull();expect(retainedRecipeNutrition(old,0,50,wholeRecipeNutrition(lines)).calories).toBe(240);});
});
