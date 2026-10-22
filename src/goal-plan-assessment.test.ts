import {describe,expect,it} from 'vitest';
import {assessGoalPlan,type PlanAssessmentInput} from './goal-plan-assessment';
import {calculateHealthGoal} from './health-calculator';
import {durationFromWeeks,durationInWeeks,maxDurationWeeks,weightFromKg} from './calculator-model';

const input:PlanAssessmentInput={age:30,heightCm:175,currentWeight:85,targetWeight:80,weightUnit:'kg',duration:20,durationUnit:'weeks',activity:'light',sex:'male',excluded:false};
describe('live goal-plan screening',()=>{
 it('gives a target-first timeline without filling in or requiring duration',()=>{
  const value={...input,duration:null},before=structuredClone(value),a=assessGoalPlan(value);
  expect(a.referenceWeeks?.min).toBeGreaterThan(0);expect(a.referenceWeeks!.max).toBeCloseTo(a.referenceWeeks!.min*2);
  expect(a.weeklyChangeKg).toBeNull();expect(a.planTarget).toBeNull();expect(value).toEqual(before);
 });
 it('gives a duration-first loss range without inventing a target',()=>{
  const a=assessGoalPlan({...input,targetWeight:null});expect(a.reachableWeightKg!.min).toBeLessThan(85);expect(a.reachableWeightKg!.max).toBeLessThan(85);expect(a.referenceWeeks).toBeNull();expect(a.requestedIntake).toBeNull();expect(a.planTarget).toBeNull();
 });
 it('keeps missing, explicitly zero and invalid values distinct',()=>{
  const empty=assessGoalPlan({...input,targetWeight:null,duration:null});expect(empty.status).toBe('incomplete');expect(empty.reasons).toEqual([]);expect(empty.weeklyChangeKg).toBeNull();
  expect(assessGoalPlan({...input,currentWeight:null}).reasons).toContain('missingBody');
  for(const value of [0,-1,NaN,Infinity]){
   expect(assessGoalPlan({...input,duration:value}).reasons).toContain('invalidDuration');
   expect(assessGoalPlan({...input,targetWeight:value}).reasons).toContain('invalidTarget');
   expect(assessGoalPlan({...input,currentWeight:value}).reasons).toContain('invalidBody');
  }
  expect(assessGoalPlan({...input,targetWeight:85}).weeklyChangeKg).toBe(0);
 });
 it.each([{age:17},{age:12,heightCm:null},{excluded:true},{currentWeight:50}])('does not generate automatic diet targets for ineligible profiles %j',change=>{
  const a=assessGoalPlan({...input,...change});expect(a.status).toBe('notRecommended');expect(a.canEstimate).toBe(false);expect(a.energy).toBeNull();expect(a.referenceWeeks).toBeNull();expect(a.reachableWeightKg).toBeNull();expect(a.planTarget).toBeNull();expect(a.maintenanceTarget).toBeNull();
 });
 it('rejects an underweight target even with a very long timeline',()=>{
  const a=assessGoalPlan({...input,targetWeight:50,duration:100});expect(a.reasons).toContain('targetUnderweight');expect(a.referenceWeeks).toBeNull();expect(a.planTarget).toBeNull();expect(a.withinPlanningRange).toBe(false);
 });
 it('uses both relative pace and available energy margins rather than one fixed weekly rate',()=>{
  const a=assessGoalPlan({...input,currentWeight:65,heightCm:165,targetWeight:61,duration:8});expect(a.warningReasons).toContain('cautionPace');
  const b=assessGoalPlan({...input,targetWeight:81,duration:8});expect(b.blockingReasons).not.toContain('pace');expect(b.warningReasons).toContain('cautionDeficit');expect(b.planTarget).not.toBeNull();
  expect(assessGoalPlan({...input,age:70}).maxDeficit).toBeLessThan(assessGoalPlan(input).maxDeficit!);
 });
 it('varies intake boundaries with profile and activity, never treating BMR as the floor',()=>{
  const a=assessGoalPlan(input),b=assessGoalPlan({...input,sex:'female'}),c=assessGoalPlan({...input,activity:'very'});
  expect(a.intakeFloor).not.toBe(b.intakeFloor);expect(c.intakeFloor).toBeGreaterThan(a.intakeFloor!);expect(a.intakeFloor).not.toBe(a.energy!.bmr.min);
  expect(assessGoalPlan({...input,age:120,heightCm:100,currentWeight:30}).reasons).toContain('energyUnreliable');
 });
 it('the former BMI 20.8 / 1282 kcal plan is cautionary and applicable without substituting maintenance',()=>{
  const a=assessGoalPlan({...input,age:43,heightCm:165,currentWeight:56.65,targetWeight:54.975,duration:10,sex:'female',activity:'sedentary'});
  expect(a.currentBmi).toBeCloseTo(20.8,1);expect(a.requestedIntake!.min).toBeCloseTo(1281.7,0);expect(a.blockingReasons).toEqual([]);expect(a.warningReasons).toContain('normalBmi');expect(a.status).toBe('attention');expect(a.planTarget).toBe(1275);expect(a.maintenanceTarget).toBe(1475);expect(a.referenceWeeks!.min).toBeLessThan(10);
 });
 it.each([900,1000,1100])('never generates a %s kcal diet target from aggressive inputs',intake=>{
  const energy=assessGoalPlan(input).energy!.maintenance.min;
  const targetWeight=85-(energy-intake)/1100*8;
  const value={...input,targetWeight,duration:8} as Parameters<typeof calculateHealthGoal>[0];
  const result=calculateHealthGoal(value);expect(result.assessment.requestedIntake!.min).toBeCloseTo(intake);expect(result.theoretical.min).toBeCloseTo(intake);expect(result.planTarget).toBeNull();
 });
 it('preserves physical assessments through kg/lb/jin and week/month switches',()=>{
  const expected=assessGoalPlan(input);
  for(const weightUnit of ['lb','jin'] as const){const actual=assessGoalPlan({...input,weightUnit,currentWeight:weightFromKg(85,weightUnit),targetWeight:weightFromKg(80,weightUnit),durationUnit:'months',duration:durationFromWeeks(20,'months')});
   expect(actual.status).toBe(expected.status);expect(actual.planTarget).toBe(expected.planTarget);expect(actual.weeklyChangeKg).toBeCloseTo(expected.weeklyChangeKg!,10);expect(actual.referenceWeeks!.min).toBeCloseTo(expected.referenceWeeks!.min,10);
  }
  expect(durationInWeeks(24,'months')).toBe(maxDurationWeeks);expect(assessGoalPlan({...input,duration:24,durationUnit:'months'}).reasons).not.toContain('invalidDuration');expect(assessGoalPlan({...input,duration:maxDurationWeeks+.01}).reasons).toContain('invalidDuration');
 });
 it('uses the same endpoint margin in both directions of the reference',()=>{
  const targetFirst=assessGoalPlan({...input,duration:null}),min=targetFirst.referenceWeeks!.min;
  expect(assessGoalPlan({...input,duration:min}).planTarget).not.toBeNull();expect(assessGoalPlan({...input,duration:min*.9}).planTarget).toBeNull();
  const durationFirst=assessGoalPlan({...input,targetWeight:null});expect(assessGoalPlan({...input,targetWeight:durationFirst.reachableWeightKg!.min}).planTarget).not.toBeNull();
 });
 it('handles extremely short duration, missing coefficient and modest gain explicitly',()=>{
  expect(assessGoalPlan({...input,duration:.001}).planTarget).toBeNull();
  const noSex=assessGoalPlan({...input,sex:''});expect(noSex.reasons).toContain('sexNeeded');expect(noSex.planTarget).toBeNull();expect(noSex.maintenanceTarget).toBeNull();expect(noSex.energy!.maintenance.min).toBeLessThan(noSex.energy!.maintenance.max);
  const gain=assessGoalPlan({...input,targetWeight:90,duration:25});expect(gain.status).toBe('reasonable');expect(gain.reachableWeightKg!.min).toBeGreaterThan(85);expect(gain.planTarget).not.toBeNull();expect(assessGoalPlan({...input,targetWeight:90,duration:5}).reasons).toContain('gainPace');
 });
 it('quantizes only already eligible requests without dipping below the intake boundary',()=>{
  for(const activity of ['sedentary','light','moderate','very'] as const)for(const age of [25,50,70]){
   const a=assessGoalPlan({...input,age,activity,targetWeight:84,duration:20});expect(a.planTarget).not.toBeNull();expect(a.planTarget!).toBeGreaterThanOrEqual(a.intakeFloor!);expect(a.planTarget!%25).toBe(0);
  }
 });
 it('keeps long-duration gain references ordered at the supported weight boundary',()=>{
  const a=assessGoalPlan({...input,currentWeight:349,targetWeight:350,duration:100});expect(a.reachableWeightKg!.min).toBeLessThanOrEqual(a.reachableWeightKg!.max);expect(a.reachableWeightKg!.max).toBeLessThanOrEqual(350);
 });
});
