import {ingredientNutritionFactor,type RecipeLine} from './domain';
import {availableUnits,baseUnit,type IngredientPreference} from './ingredient-preferences';
import {validConsumptionUnit} from './consumption-units';
import type {FoodChoice} from './reference-library';

/** Conversion scale in nutrition-reference portions. Independent of whether a nutrient is known. */
export function recipeUnitFactors(choice:FoodChoice,preference?:IngredientPreference) {
  const factors=new Map<string,number>();
  const base=baseUnit(choice);
  const source=choice.kind==='user'?{...choice.item,consumptionUnit:null}:null;
  const baseFactor=source?ingredientNutritionFactor(source,1,base):1/100;
  if(baseFactor!==null && Number.isFinite(baseFactor) && baseFactor>0)factors.set(base,baseFactor);
  const serving=source && ingredientNutritionFactor(source,1,'serving');
  if(serving!==null && Number.isFinite(serving) && serving>0)factors.set('serving',serving);
  if(factors.has(base)){
    for(const unit of availableUnits(choice,preference)){
      if(!validConsumptionUnit(unit)||unit.unit!==base)continue;
      const factor=(unit.amount/unit.quantity)*baseFactor!;
      if(Number.isFinite(factor)&&factor>0)factors.set(unit.name,factor);
    }
  }
  return factors;
}

export function convertRecipeLine(line:RecipeLine,unit:string,factors:ReadonlyMap<string,number>):RecipeLine|null {
  const from=factors.get(line.unit),to=factors.get(unit);
  if(!from||!to)return null;
  const ratio=from/to;
  const quantity=line.quantity*ratio;
  if(!Number.isFinite(ratio)||ratio<=0||!Number.isFinite(quantity)||(line.quantity>0&&quantity===0))return null;
  if(!line.zeroQuantityReference)return {...line,quantity,unit};
  const reference=line.zeroQuantityReference.quantity*ratio;
  if(!Number.isFinite(reference)||reference<=0)return null;
  return {...line,quantity,unit,zeroQuantityReference:{...line.zeroQuantityReference,quantity:reference}};
}
