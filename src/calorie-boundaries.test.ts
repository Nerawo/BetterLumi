import {it,expect} from 'vitest';
import {planInteractively} from './interactive-planner';
import {type PlanAssessmentInput} from './goal-plan-assessment';
import {estimatedEnergy,weightFromKg,durationFromWeeks} from './calculator-model';
const profile:PlanAssessmentInput={age:43,heightCm:165,currentWeight:56.65,targetWeight:54.975,duration:10,durationUnit:'weeks',weightUnit:'kg',activity:'sedentary',sex:'female',excluded:false};
it('documents the exact old rejection and permits the same arithmetic with caution',()=>{
 const p=planInteractively(profile),m=p.energy!.maintenance.min;
 expect(m).toBeCloseTo(1466.1);expect(p.intake!.min).toBeCloseTo(1281.85);expect(m*.9).toBeCloseTo(1319.49);expect(p.intake!.min).toBeLessThan(m*.9);
 expect(p.assessment.cautionFloor!).toBeLessThan(1319.49);expect(p.assessment.intakeFloor).toBe(1200);expect(p.assessment.blockingReasons).toEqual([]);expect(p.assessment.warningReasons).toEqual(['normalBmi']);expect(p.nutritionApplicable).toBe(true);expect(p.targetKcal).toBe(1282);
});
it('allows exactly 1284 with the female profile and retains the actual plan, not maintenance',()=>{
 const targetWeight=56.65-(1466.1-1284)*10/1100,input={...profile,targetWeight},before=structuredClone(input),p=planInteractively(input);
 expect(p.intake!.min).toBeCloseTo(1284);expect(p.targetKcal).toBe(1284);expect(p.nutritionApplicable).toBe(true);expect(p.assessment.status).toBe('attention');expect(input).toEqual(before);expect(p.targetKcal).not.toBe(p.conservativeTarget);
});
it('distinguishes all three screening tiers without treating BMR as an intake floor',()=>{
 const adult={...profile,age:30,heightCm:175,currentWeight:85,targetWeight:80,sex:'male' as const,duration:20,activity:'sedentary' as const};const m=estimatedEnergy(30,175,85,'male','sedentary').maintenance.min;
 const p=planInteractively({...adult,duration:5*1100/(m-1750)});expect(p.intake!.min).toBeCloseTo(1750);expect(p.intake!.min).toBeLessThan(p.energy!.bmr.min);expect(p.nutritionApplicable).toBe(true);expect(p.assessment.status).toBe('reasonable');expect(planInteractively(profile).assessment.status).toBe('attention');expect(planInteractively({...profile,duration:1}).assessment.status).toBe('notRecommended');
});
it('adds additional exercise exactly once in both arithmetic and safety budgets',()=>{
 const body={...profile,age:30,currentWeight:65,targetWeight:65-(1644.3-1190)*4/1100,duration:4};const base=planInteractively(body),p=planInteractively(body,{exerciseEnabled:true,exerciseMinutes:600});
 expect(base.intake!.min).toBeCloseTo(1190);expect(base.nutritionApplicable).toBe(false);expect(p.intake!.min-base.intake!.min).toBeCloseTo(p.exerciseKcal!/7);expect(p.assessment.requestedIntake!.min).toBeCloseTo(p.intake!.min);expect(p.assessment.dailyDeficit).toBe(base.assessment.dailyDeficit);expect(p.assessment.maxDeficit!).toBeGreaterThan(base.assessment.maxDeficit!);expect(p.nutritionApplicable).toBe(true);
});
it.each([900,1000,1100,1199])('keeps %s kcal theoretical estimates visible but ineligible',value=>{
 const body={...profile,currentWeight:65,age:30,targetWeight:65-(1644.3-value)*4/1100,duration:4};const p=planInteractively(body);expect(p.intake!.min).toBeCloseTo(value);expect(p.nutritionApplicable).toBe(false);expect(p.assessment.blockingReasons).toContain('intake');
});
it('never treats 1284 as universally appropriate for every profile or restricted user',()=>{
 for(const partial of [{sex:'male' as const},{age:17},{excluded:true},{currentWeight:45},{targetWeight:45}])expect(planInteractively({...profile,...partial}).nutritionApplicable).toBe(false);
 expect(planInteractively(profile,{exerciseEnabled:true,exerciseMinutes:9000}).assessment.blockingReasons).toContain('energyUnreliable');
});
it('keeps caution, boundaries and exercise contribution invariant across units',()=>{
 const expected=planInteractively(profile,{exerciseEnabled:true});for(const weightUnit of ['lb','jin'] as const){const actual=planInteractively({...profile,weightUnit,currentWeight:weightFromKg(profile.currentWeight!,weightUnit),targetWeight:weightFromKg(profile.targetWeight!,weightUnit),durationUnit:'months',duration:durationFromWeeks(10,'months')},{exerciseEnabled:true});expect(actual.intake!.min).toBeCloseTo(expected.intake!.min);expect(actual.assessment.intakeFloor).toBeCloseTo(expected.assessment.intakeFloor!);expect(actual.nutritionApplicable).toBe(expected.nutritionApplicable);expect(actual.assessment.status).toBe(expected.assessment.status)}
});
