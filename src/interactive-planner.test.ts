import {describe,it,expect} from 'vitest';
import {planInteractively,estimateExerciseCalories,validPlannerSettings} from './interactive-planner';
import {durationFromWeeks,weightFromKg} from './calculator-model';
import type {PlanAssessmentInput} from './goal-plan-assessment';
const body:PlanAssessmentInput={age:30,heightCm:175,currentWeight:85,targetWeight:80,weightUnit:'kg',duration:20,durationUnit:'weeks',activity:'light',sex:'male',excluded:false};
describe('linked planner',()=>{
 it('updates calories from weight and duration using the shared model',()=>{
  const p=planInteractively(body);expect(p.intake!.min).toBeCloseTo(2198.28125);expect(p.nutritionApplicable).toBe(true);
  expect(planInteractively({...body,targetWeight:79}).intake!.min).toBeLessThan(p.intake!.min);
  expect(planInteractively({...body,duration:30}).intake!.min).toBeGreaterThan(p.intake!.min);
 });
 it('estimates net moderate exercise and adds it exactly once',()=>{
  expect(estimateExerciseCalories(85,150)).toBe(637.5);
  const base=planInteractively(body),ex=planInteractively(body,{exerciseEnabled:true});
  expect(ex.intake!.min-base.intake!.min).toBeCloseTo(637.5/7);expect(ex.weeks).toBe(20);
  expect(ex.exerciseApplicable).toBe(true);expect(ex.nutritionApplicable).toBe(true);
  expect(planInteractively(body,{exerciseEnabled:false,exerciseMinutes:300}).intake).toEqual(base.intake);
 });
 it('ignores all legacy manual outputs and reverse modes without changing inputs',()=>{
  const snapshot=structuredClone(body),expected=planInteractively(body,{exerciseEnabled:true});
  for(const dailyIntake of [null,0,-20,5000]){
   const result=planInteractively(body,{exerciseEnabled:true,plannerMode:'intake',dailyIntake,exerciseCustom:true,exerciseCalories:100000,keepExerciseCustom:true});
   expect(result).toEqual(expected);expect(body).toEqual(snapshot);expect(result.weeks).toBe(20);
  }
 });
 it('counts explicit zero exercise minutes as a calculated zero',()=>{
  const p=planInteractively(body,{exerciseEnabled:true,exerciseMinutes:0});expect(p.exerciseKcal).toBe(0);expect(p.exerciseApplicable).toBe(true);expect(p.intake).toEqual(planInteractively(body).intake);
 });
 it('retains blanks without feeding calculated outputs back into inputs',()=>{
  expect(planInteractively({...body,targetWeight:null}).intake).toBeNull();expect(planInteractively({...body,duration:null},{plannerMode:'intake',dailyIntake:2000}).intake).toBeNull();
  expect(planInteractively({...body,duration:null}).weeks).toBeNull();
 });
 it('does not clamp out-of-horizon durations or unsafe mathematical intake',()=>{
  const p=planInteractively({...body,duration:5500});expect(p.weeks).toBe(5500);expect(p.intake).not.toBeNull();expect(p.nutritionApplicable).toBe(true);
  const fast=planInteractively({...body,duration:1});expect(fast.intake!.min).toBeLessThan(0);expect(fast.nutritionApplicable).toBe(false);
 });
 it('preserves kg/lb/jin and weeks/months semantics',()=>{
  const p=planInteractively(body,{exerciseEnabled:true});
  for(const weightUnit of ['kg','lb','jin'] as const){const x=planInteractively({...body,weightUnit,currentWeight:weightFromKg(85,weightUnit),targetWeight:weightFromKg(80,weightUnit),duration:durationFromWeeks(20,'months'),durationUnit:'months'},{exerciseEnabled:true});expect(x.intake!.min).toBeCloseTo(p.intake!.min);expect(x.exerciseKcal).toBeCloseTo(p.exerciseKcal!)}
 });
 it('keeps BMR and maintenance informational for restricted adults, never a prescription',()=>{
  const p=planInteractively({...body,excluded:true},{exerciseEnabled:true});expect(p.energy).not.toBeNull();expect(p.intake).toBeNull();expect(p.nutritionApplicable).toBe(false);expect(p.exerciseApplicable).toBe(false);
  const minor=planInteractively({...body,age:17},{exerciseEnabled:true});expect(minor.intake).toBeNull();expect(minor.nutritionApplicable).toBe(false);expect(minor.exerciseApplicable).toBe(false);
 });
 it('keeps health warnings informational while rejecting nonpositive intake',()=>{
  const low=planInteractively({...body,targetWeight:50},{exerciseEnabled:true});expect(low.assessment.reasons).toContain('targetUnderweight');expect(low.nutritionApplicable).toBe(true);
  expect(planInteractively({...body,duration:.1},{exerciseEnabled:true}).nutritionApplicable).toBe(false);
  expect(planInteractively(body,{exerciseEnabled:true,exerciseMinutes:6000}).nutritionApplicable).toBe(true);
 });
 it('handles unknown coefficients as ranges; blocks missing exercise inputs',()=>{
  const p=planInteractively({...body,sex:''});expect(p.intake!.max).toBeGreaterThan(p.intake!.min);expect(p.nutritionApplicable).toBe(false);
  for(const exerciseMinutes of [null,-1,10081]){const x=planInteractively(body,{exerciseEnabled:true,exerciseMinutes});expect(x.exerciseValid).toBe(false);expect(x.nutritionApplicable).toBe(false);expect(x.exerciseApplicable).toBe(false)}
  expect(estimateExerciseCalories(null,150)).toBeNull();expect(validPlannerSettings({dailyIntake:Infinity})).toBe(false);
 });
});
