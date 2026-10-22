import {it,expect} from 'vitest';
import {defaultIngredientQuantity} from './consumption-units';
import type {Ingredient} from './db';
const ingredient={basis:'100g',referenceAmount:32,referenceUnit:'g',servingGrams:null} as Ingredient;
it('selects defaults rather than equivalent quantities for custom and base units',()=>{expect(defaultIngredientQuantity(ingredient,'块')).toBe(1);expect(defaultIngredientQuantity(ingredient,'g')).toBe(32);expect(defaultIngredientQuantity(ingredient,'serving')).toBe(1)});
it('uses mL references and known serving sizes without changing nutrition semantics',()=>{expect(defaultIngredientQuantity({...ingredient,referenceAmount:12.5,referenceUnit:'mL'},'mL')).toBe(12.5);expect(defaultIngredientQuantity({...ingredient,basis:'serving',servingGrams:40},'g')).toBe(40)});
it('keeps legacy and missing-base defaults safe',()=>{expect(defaultIngredientQuantity({...ingredient,referenceAmount:undefined},'g')).toBe(100);expect(defaultIngredientQuantity({...ingredient,basis:'serving',servingGrams:null},'g')).toBe(100);expect(defaultIngredientQuantity(undefined,'块')).toBe(1)});
