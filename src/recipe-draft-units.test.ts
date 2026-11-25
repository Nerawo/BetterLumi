import {expect,it} from 'vitest';
import {ingredientNutrition,type PantryItem,type RecipeLine} from './domain';
import {userChoice} from './ingredient-preferences';
import {convertRecipeLine,recipeUnitFactors} from './recipe-draft-units';
import {requantifyLine} from './cooking-effective';

const food={basis:'100g',referenceAmount:32,referenceUnit:'g',servingGrams:null,calories:160,protein:2,carbs:18,fat:9} as PantryItem;
const chocolate={...food,consumptionUnit:{quantity:7,amount:32,unit:'g' as const,name:'块'}};
const factors=(item:PantryItem)=>recipeUnitFactors(userChoice(item));
const line:RecipeLine={lineId:'original',ingredientId:'chocolate',name:'Chocolate',unit:'块',quantity:3,nutrition:ingredientNutrition(chocolate,3,'块')};

it('only offers recorded measurement dimensions, even with unknown nutrients',()=>{
  expect([...factors({...food,calories:null}).keys()]).toEqual(['g']);
  expect([...factors({...chocolate,referenceUnit:'mL'}).keys()]).toEqual(['mL']);
  expect([...factors({...chocolate,basis:'serving'}).keys()]).toEqual(['serving']);
  expect([...factors({...chocolate,basis:'serving',servingGrams:32}).keys()]).toEqual(['g','serving','块']);
  expect([...factors({...chocolate,servingGrams:32,servingUnit:'mL'}).keys()]).toEqual(['g','块']);
  expect([...factors({...food,servingGrams:20}).keys()]).toEqual(['g','serving']);
});
it('converts equivalent amounts without replacing saved nutrition with live source values',()=>{
  const units=factors(chocolate);
  const grams=convertRecipeLine(line,'g',units)!;
  expect(grams.quantity).toBeCloseTo(96/7,13);
  expect(grams.nutrition).toEqual(line.nutrition);
  expect(ingredientNutrition(chocolate,grams.quantity,'g').calories).toBeCloseTo(line.nutrition.calories!,12);
  expect(convertRecipeLine(grams,'块',units)!.quantity).toBeCloseTo(3,13);
  const old={...line,nutrition:{...line.nutrition,protein:null}};
  expect(convertRecipeLine(old,'g',units)!.nutrition.protein).toBeNull();
  expect(convertRecipeLine(line,'mL',units)).toBeNull();
  expect(convertRecipeLine({...line,unit:'removed'},'g',units)).toBeNull();
});
it('converts the zero-line reference so restoring a positive amount scales correctly',()=>{
  const grams=convertRecipeLine(requantifyLine(line,0),'g',factors(chocolate))!;
  expect(grams.quantity).toBe(0);
  expect(grams.zeroQuantityReference!.quantity).toBeCloseTo(96/7,13);
  expect(requantifyLine(grams,32).nutrition.calories).toBeCloseTo(160,12);
});
