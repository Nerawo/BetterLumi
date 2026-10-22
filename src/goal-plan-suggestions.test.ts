import {expect,it} from 'vitest';
import {assessGoalPlan,type PlanAssessmentInput} from './goal-plan-assessment';
import {suggestTargetTimeline,suggestWeightForDuration} from './goal-plan-suggestions';
import {durationFromWeeks,weightFromKg} from './calculator-model';
const input:PlanAssessmentInput={age:30,heightCm:175,currentWeight:85,targetWeight:80,weightUnit:'kg',duration:20,durationUnit:'weeks',activity:'light',sex:'male',excluded:false};
it('both suggestions are independent, even when the opposite field is invalid',()=>{
 const time=suggestTargetTimeline(input),weight=suggestWeightForDuration(input);
 for(const duration of [null,0,-1,.001,Infinity,100])expect(suggestTargetTimeline({...input,duration})).toEqual(time);
 for(const targetWeight of [null,0,-1,Infinity,50,90])expect(suggestWeightForDuration({...input,targetWeight})).toEqual(weight);
 expect(suggestTargetTimeline({...input,targetWeight:null})).toBeNull();expect(suggestWeightForDuration({...input,duration:null})).toBeNull();
});
it('adoption is in a conservative direction and passes the same screening',()=>{
 const before=structuredClone(input),time=suggestTargetTimeline(input)!,weight=suggestWeightForDuration(input)!;
 expect(assessGoalPlan({...input,duration:time.adopt!}).planTarget).not.toBeNull();expect(assessGoalPlan({...input,targetWeight:weight.adopt!}).planTarget).not.toBeNull();expect(input).toEqual(before);
});
it('invalid targets do not acquire a timeline, while duration advice remains available',()=>{
 for(const targetWeight of [0,-1,50]){const value={...input,targetWeight};expect(suggestTargetTimeline(value)?.range).toBeNull();expect(suggestTargetTimeline(value)?.adopt).toBeNull();expect(suggestWeightForDuration(value)?.range).not.toBeNull()}
 const both={...input,targetWeight:50,duration:0};expect(suggestTargetTimeline(both)?.range).toBeNull();expect(suggestWeightForDuration(both)?.range).toBeNull();
});
it('does not offer lower weights to underweight people or excluded groups',()=>{
 for(const extra of [{currentWeight:50},{age:17},{excluded:true},{heightCm:null}]){
  const value={...input,targetWeight:55,...extra};expect(suggestTargetTimeline(value)?.range).toBeNull();expect(suggestWeightForDuration(value)?.range).toBeNull();expect(assessGoalPlan(value).planTarget).toBeNull();
 }
 expect(assessGoalPlan({...input,targetWeight:60,duration:100}).planTarget).not.toBeNull();
});
it('requires energy margins in addition to BMI, and accounts for activity',()=>{
 const inactive=suggestWeightForDuration({...input,activity:'sedentary'})!,active=suggestWeightForDuration({...input,activity:'very'})!;expect(inactive.range!.min).toBeGreaterThan(active.range!.min);
 const noMargin={...input,age:120,heightCm:100,currentWeight:30};expect(suggestWeightForDuration(noMargin)?.reason).toBe('energyUnreliable');
 expect(suggestWeightForDuration({...input,duration:100})!.range!.min).toBeGreaterThanOrEqual(18.5*1.75**2);
});
it('handles maintenance, tiny durations, units and over-horizon references without unsafe adoption',()=>{
 expect(suggestTargetTimeline({...input,targetWeight:85})?.reason).toBe('maintenanceGoal');expect(suggestWeightForDuration({...input,duration:.001})!.range!.min).toBe(85);
 const converted={...input,weightUnit:'lb' as const,currentWeight:weightFromKg(85,'lb'),targetWeight:weightFromKg(80,'lb'),durationUnit:'months' as const,duration:durationFromWeeks(20,'months')};
 expect(suggestTargetTimeline(converted)!.adopt).toBeGreaterThanOrEqual(durationFromWeeks(suggestTargetTimeline(input)!.range!.min,'months')-.1);
 expect(suggestWeightForDuration(converted)!.range!.min).toBeCloseTo(weightFromKg(suggestWeightForDuration(input)!.range!.min,'lb'),0);
 const long=suggestTargetTimeline({...input,currentWeight:300,targetWeight:80,activity:'very'})!;expect(long.range).toBeNull();expect(long.reason).toBe('phasedPlan');expect(long.adopt).toBeNull();
});
