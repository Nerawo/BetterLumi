import {expect,it} from 'vitest';
import {bmiFeedback} from './bmi-feedback';
it.each([[18.49,'underweight'],[18.5,'healthy'],[24.99,'healthy'],[25,'overweight'],[29.99,'overweight'],[30,'obesity']])('selects friendly adult commentary at BMI %s',(value,key)=>{
 const a=bmiFeedback(Number(value),30);expect(a.category).toBe(key);expect(a.comment).toBe('bmiComment_'+key);
});
it('withholds adult classification for known youth, not inventing child percentiles',()=>{
 for(const age of [0,12,17,18,19]){const a=bmiFeedback(22,age);expect(a.category).toBeNull();expect(a.useAdultCategories).toBe(false);expect(a.comment).toBe('bmiCommentYouth')}
 expect(bmiFeedback(22,20).category).toBe('healthy');expect(bmiFeedback(22,null).comment).toBe('bmiCommentAdultReference');
});
it('does not invent commentary for missing/invalid BMI or classify invalid ages',()=>{
 for(const value of [null,NaN,0,-1,Infinity])expect(bmiFeedback(value,30).comment).toBeNull();
 expect(bmiFeedback(22,-1).category).toBeNull();expect(bmiFeedback(22,30.5).comment).toBe('bmiCommentAge');
});
