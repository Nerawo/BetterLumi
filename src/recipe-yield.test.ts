import {describe,it,expect} from 'vitest';
import {recipeYield,recipeServingLines,recipeServingNutrition,retainedRecipeNutrition} from './recipe-nutrition';
import {consumedNutrition} from './consumption';
const recipe={servings:6,lines:[{ingredientId:'synthetic',name:'Synthetic ingredient',quantity:480,unit:'g',nutrition:{calories:1800,protein:60,carbs:300,fat:40}}]};
describe('canonical yield and independent serving snapshots',()=>{
 it('falls back without modifying legacy records',()=>{for(const servings of [undefined,0,NaN,-1])expect(recipeYield({servings})).toBe(1)});
 it.each([0.5,1,1.5,3,6])('scales a %s serving batch without changing the recipe',amount=>{const before=structuredClone(recipe),lines=recipeServingLines(recipe,amount);expect(lines[0].quantity).toBe(80*amount);expect(recipeServingNutrition(recipe,amount).calories).toBe(300*amount);expect(recipe).toEqual(before)});
 it('a later yield/source change cannot change an existing meal snapshot',()=>{const snapshot=recipeServingNutrition(recipe,1.5);recipeServingNutrition({...recipe,servings:2},3);expect(retainedRecipeNutrition(snapshot,100,100)).toEqual({calories:450,protein:15,carbs:75,fat:10});});
 it('preserves missing nutrients and full precision',()=>{const r={...recipe,lines:[{...recipe.lines[0],nutrition:{calories:123.4567,protein:null,carbs:0,fat:2.345}}]};expect(recipeServingNutrition(r).calories).toBeCloseTo(20.576116666666666,12);expect(recipeServingNutrition(r).protein).toBeNull();expect(recipeServingNutrition(r).carbs).toBe(0)});
 it.each([[1,100,600],[1,50,300],[2,50,600],[2,0,0]])('combines %s servings and %s percent through the existing calculation path',(servings,percent,calories)=>{
  const r={servings:2,lines:[{ingredientId:'synthetic',name:'Synthetic batch',quantity:200,unit:'g',nutrition:{calories:1200,protein:60,carbs:120,fat:40}}]},before=structuredClone(r);
  expect(consumedNutrition(recipeServingNutrition(r,servings),percent)).toEqual({calories,protein:30*servings*percent/100,carbs:60*servings*percent/100,fat:20*servings*percent/100});expect(r).toEqual(before);
 });
});
