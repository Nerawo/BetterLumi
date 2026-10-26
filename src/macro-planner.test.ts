import {it,expect} from 'vitest';
import {calculateMacroPlan} from './macro-planner';
import {weightFromKg,weightInKg} from './calculator-model';
import {validCalculatorDraft,initialCalculatorDraft,parseCalculatorDraft} from './calculator-settings';
it('allocates balanced protein by weight, 30% fat and remaining carbs without rounding',()=>{
 const p=calculateMacroPlan(70,2000)!;expect(p.protein).toBe(98);expect(p.fat).toBeCloseTo(66.6666666667,8);expect(p.carbs).toBe(252);expect(p.protein*4+p.carbs*4+p.fat*9).toBeCloseTo(2000,10);expect(p.cautions).toEqual([]);
});
it('switches protein without changing calories or fat',()=>{const a=calculateMacroPlan(70,2000)!,b=calculateMacroPlan(70,2000,'highProtein')!;expect(b.protein).toBe(112);expect(b.carbs).toBe(238);expect(b.fat).toBe(a.fat);expect(b.protein*4+b.carbs*4+b.fat*9).toBeCloseTo(2000,10)});
it('flags specific AMDR proportions without discarding an otherwise valid allocation',()=>{const p=calculateMacroPlan(80,1300,'highProtein')!;expect(p).not.toBeNull();expect(p.cautions.map(c=>c.nutrient)).toEqual(['protein','carbs']);expect(p.cautions[0]).toMatchObject({min:10,max:35});expect(p.cautions[1]).toMatchObject({min:45,max:65});expect(p.protein*4+p.carbs*4+p.fat*9).toBeCloseTo(1300,10)});
it('does not produce negative grams or treat invalid and blank inputs as zero',()=>{for(const [kg,kcal] of [[null,2000],[70,null],[0,2000],[70,0],[-1,2000],[70,-100],[Infinity,2000],[70,NaN],[70,100]] as const)expect(calculateMacroPlan(kg,kcal)).toBeNull()});
it.each(['kg','lb','jin'] as const)('retains physical weight and exact energy with %s conversion',unit=>{const kg=weightInKg(weightFromKg(76.4,unit),unit),p=calculateMacroPlan(kg,1837,'highProtein')!;expect(p.protein).toBeCloseTo(122.24,10);expect(p.protein*4+p.carbs*4+p.fat*9).toBeCloseTo(1837,10)});
it('accepts legacy drafts and persists an optional scheme without a format version upgrade',()=>{expect(validCalculatorDraft(initialCalculatorDraft)).toBe(true);expect(validCalculatorDraft({...initialCalculatorDraft,nutritionPlan:'bad'})).toBe(false);const value={...initialCalculatorDraft,nutritionPlan:'highProtein' as const};expect(parseCalculatorDraft(JSON.stringify({version:1,value}))).toEqual(value)});
