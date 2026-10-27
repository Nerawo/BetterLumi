// Fictional regression data; never seed these tests from a personal journal or export.
import {it,expect} from 'vitest';
import {planInteractively} from './interactive-planner';
import {planReasonMessage} from './goal-plan-suggestions';
import {weightFromKg,durationFromWeeks} from './calculator-model';
import type {PlanAssessmentInput} from './goal-plan-assessment';
const body:PlanAssessmentInput={age:43,heightCm:166,currentWeight:56,targetWeight:54,weightUnit:'kg',duration:12,durationUnit:'weeks',activity:'light',sex:'female',excluded:false};
const durationFor1284=(extra=0)=>(56-54)*1100/(1679.5625+extra-1284);
it('has no margin, status or applicability jump immediately across BMI 21',()=>{
 const inputs=[20.9999,21.0001].map(value=>{const currentWeight=value*1.66**2;return{...body,currentWeight,targetWeight:currentWeight-1,duration:1100/250}}),[a,b]=inputs.map(x=>planInteractively(x));
 expect(a.assessment.currentBmi!).toBeLessThan(21);expect(b.assessment.currentBmi!).toBeGreaterThan(21);
 for(const key of ['cautionFloor','intakeFloor','maxDeficit','deficitLimit','cautionDeficitLimit','weeklyLossLimit'] as const)expect(Math.abs(a.assessment[key]!-b.assessment[key]!)).toBeLessThan(.1);
 expect(Math.abs(a.assessment.cautionFraction!-b.assessment.cautionFraction!)).toBeLessThan(.00001);expect(a.assessment.warningReasons).toEqual(b.assessment.warningReasons);expect(a.assessment.blockingReasons).toEqual(b.assessment.blockingReasons);expect(a.nutritionApplicable).toBe(true);expect(b.nutritionApplicable).toBe(true);
});
it.each([25,30])('keeps numerical margins continuous at the other reference anchors: BMI %s',anchor=>{
 const values=[anchor-.0001,anchor+.0001].map(value=>planInteractively({...body,currentWeight:value*1.66**2,targetWeight:value*1.66**2-1}).assessment);
 for(const key of ['cautionFraction','deficitFraction','intakeFloor','cautionFloor','maxDeficit'] as const)expect(Math.abs(values[0][key]!-values[1][key]!)).toBeLessThan(.1);
});
it('evaluates a fictional adult caution scenario without a BMR veto',()=>{
 const p=planInteractively({...body,duration:durationFor1284()});expect(p.energy!.bmr.min).toBe(1221.5);expect(p.energy!.maintenance.min).toBe(1679.5625);expect(p.assessment.currentBmi).toBeCloseTo(20.322252867);expect(p.intake!.min).toBeCloseTo(1284);expect(p.targetKcal).toBe(1284);expect(p.nutritionApplicable).toBe(true);expect(p.assessment.status).toBe('attention');expect(p.assessment.warningReasons).toContain('cautionIntake');expect(p.assessment.blockingReasons).toEqual([]);expect(p.assessment.cautionFraction!).toBeGreaterThan(.15);
 const copy=planReasonMessage('cautionIntake',p.assessment);expect(copy.key).toBe('planEvidence_cautionIntake');expect(copy.values.intake).toBeCloseTo(1284);expect(copy.values.limit).toBe(p.assessment.cautionFloor);expect(copy.values.percent).toBeCloseTo(p.assessment.cautionFraction!*100);
});
it('explains exercise/time health warnings without blocking the same calculated intake',()=>{
 const extra=3*56*150/60/7,p=planInteractively({...body,duration:durationFor1284(extra)},{exerciseEnabled:true,exerciseMinutes:150});
 expect(p.intake!.min).toBeCloseTo(1284);expect(p.exerciseKcal).toBe(420);expect(p.targetKcal).toBe(1284);expect(p.nutritionApplicable).toBe(true);expect(p.exerciseApplicable).toBe(true);expect(p.assessment.blockingReasons).toContain('intake');expect(p.assessment.blockingReasons).toContain('deficit');expect(p.assessment.intakeBoundarySource).toBe('relative');expect(p.assessment.intakeFloor).toBeCloseTo((1679.5625+extra)*.75);
 const copy=planReasonMessage('intake',p.assessment);expect(copy.key).toBe('planEvidence_intakeRelative');expect(copy.values).toMatchObject({intake:1284,percent:25});expect(copy.values.limit).toBe(p.assessment.intakeFloor);
 const deficit=planReasonMessage('deficit',p.assessment);expect(deficit.values.deficit).toBe(p.assessment.dailyDeficit);expect(deficit.values.limit).toBe(p.assessment.deficitLimit);
});
it('keeps units and the actual mathematical plan invariant while feedback updates',()=>{
 const input={...body,duration:durationFor1284()},before=structuredClone(input),p=planInteractively(input);
 for(const unit of ['lb','jin'] as const){const other=planInteractively({...input,weightUnit:unit,currentWeight:weightFromKg(56,unit),targetWeight:weightFromKg(54,unit),durationUnit:'months',duration:durationFromWeeks(input.duration,'months')});expect(other.intake!.min).toBeCloseTo(p.intake!.min);expect(other.assessment.warningReasons).toEqual(p.assessment.warningReasons);expect(other.nutritionApplicable).toBe(true)}
 expect(planInteractively({...input,duration:input.duration*2}).intake!.min).toBeGreaterThan(p.intake!.min);expect(planInteractively(input,{exerciseEnabled:true,exerciseMinutes:150}).intake!.min-p.intake!.min).toBeCloseTo(420/7);expect(input).toEqual(before);
});
it('uses 18.5 rather than 20 as the sole BMI planning boundary',()=>{
 const under=planInteractively({...body,targetWeight:45}),buffer=planInteractively({...body,targetWeight:53,duration:40});expect(under.assessment.blockingReasons).toContain('targetUnderweight');expect(buffer.assessment.blockingReasons).toEqual([]);expect(planReasonMessage('targetUnderweight',under.assessment).key).toBe('planEvidence_targetUnderweight');expect(buffer.intake!.min).toBeGreaterThan(1200);expect(buffer.nutritionApplicable).toBe(true);
});

it.each([19.8,20.2])('BMI %s can plan a modest loss with independent energy checks',currentBmi=>{
 const input={...body,currentWeight:currentBmi*1.66**2,targetWeight:(currentBmi-.2)*1.66**2,duration:12},p=planInteractively(input,{exerciseEnabled:true,exerciseMinutes:150});expect(p.assessment.currentBmi).toBeCloseTo(currentBmi);expect(p.assessment.targetBmi).toBeCloseTo(currentBmi-.2);expect(p.assessment.blockingReasons).toEqual([]);expect(p.nutritionApplicable).toBe(true);expect(p.exerciseApplicable).toBe(true);expect(p.assessment.referenceWeeks).not.toBeNull();expect(p.assessment.reachableWeightKg!.min).toBeLessThan(input.currentWeight);
});
it('has no discontinuity immediately across BMI20 and cannot replace it with another buffer',()=>{
 const[a,b]=[19.9999,20.0001].map(value=>planInteractively({...body,currentWeight:value*1.66**2,targetWeight:(value-.2)*1.66**2,duration:12}));expect(a.nutritionApplicable).toBe(true);expect(b.nutritionApplicable).toBe(true);expect(a.assessment.status).toBe(b.assessment.status);expect(a.assessment.reasons).toEqual(b.assessment.reasons);expect(Math.abs(a.assessment.intakeFloor!-b.assessment.intakeFloor!)).toBeLessThan(.1);
 const unsafe=planInteractively({...body,currentWeight:19.8*1.66**2,targetWeight:19.6*1.66**2,duration:.1});expect(unsafe.nutritionApplicable).toBe(false);expect(unsafe.assessment.blockingReasons).toContain('pace');expect(unsafe.assessment.blockingReasons).toContain('intake');
 const under=planInteractively({...body,currentWeight:19.8*1.66**2,targetWeight:18.49*1.66**2,duration:12});expect(under.assessment.blockingReasons).toContain('targetUnderweight');
});
