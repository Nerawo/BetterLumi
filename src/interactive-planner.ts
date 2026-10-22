import {bmi,durationInWeeks,estimatedEnergy,maxDurationWeeks,weightInKg,type EstimateRange} from './calculator-model';
import {assessGoalPlan,type PlanAssessmentInput} from './goal-plan-assessment';

export interface PlannerSettings {
 /** Legacy draft metadata is accepted for backup compatibility, never evaluated. */
 plannerMode?:'duration'|'intake';dailyIntake?:number|null;
 exerciseEnabled?:boolean;exerciseMinutes?:number|null;exerciseCalories?:number|null;
 exerciseCustom?:boolean;keepExerciseCustom?:boolean;
}
export const plannerDefaults={exerciseEnabled:false,exerciseMinutes:150} as const;
/** 4 MET moderate exercise minus the 1 MET resting energy already in baseline.
 * Only additional sessions outside the selected activity level belong here. */
export function estimateExerciseCalories(kg:number|null,minutes:number|null){
 return kg!==null&&Number.isFinite(kg)&&kg>=30&&kg<=350&&minutes!==null&&Number.isFinite(minutes)&&minutes>=0&&minutes<=10080?3*kg*minutes/60:null;
}
export function validPlannerSettings(x:PlannerSettings){
 return (x.plannerMode===undefined||['duration','intake'].includes(x.plannerMode))&&
  (['dailyIntake','exerciseMinutes','exerciseCalories'] as const).every(k=>x[k]===undefined||x[k]===null||typeof x[k]==='number'&&Number.isFinite(x[k]))&&
  (['exerciseEnabled','exerciseCustom','keepExerciseCustom'] as const).every(k=>x[k]===undefined||typeof x[k]==='boolean');
}
/** One-way pure derivation. Only body data, target, duration and exercise
 * minutes control results; legacy output overrides are intentionally inert. */
export function planInteractively(input:PlanAssessmentInput,settings:PlannerSettings={}){
 const s={...plannerDefaults,...settings},kg=input.currentWeight===null?null:weightInKg(input.currentWeight,input.weightUnit);
 const minutes=s.exerciseMinutes,estimated=estimateExerciseCalories(kg,minutes);
 const exerciseValid=!s.exerciseEnabled||estimated!==null;
 const exerciseKcal=s.exerciseEnabled&&exerciseValid?estimated!:0,extra=exerciseKcal/7;
 const bodyValid=input.age!==null&&Number.isInteger(input.age)&&input.age>=18&&input.age<=120&&input.heightCm!==null&&Number.isFinite(input.heightCm)&&input.heightCm>=100&&input.heightCm<=250&&kg!==null&&Number.isFinite(kg)&&kg>=30&&kg<=350;
 const energy=bodyValid?estimatedEnergy(input.age!,input.heightCm!,kg!,input.sex,input.activity):null;
 const target=input.targetWeight===null?null:weightInKg(input.targetWeight,input.weightUnit);
 const change=target!==null&&Number.isFinite(target)&&target>=30&&target<=350&&kg!==null?target-kg:null;
 const weeks=input.duration===null?null:durationInWeeks(input.duration,input.durationUnit);
 let intake:EstimateRange|null=null;
 if(energy&&exerciseValid&&!input.excluded&&change!==null&&weeks!==null&&Number.isFinite(weeks)&&weeks>0){
  const adjustment=change/weeks*1100+extra;
  intake={min:energy.maintenance.min+adjustment,max:energy.maintenance.max+adjustment};
 }
 if(intake&&(!Number.isFinite(intake.min)||!Number.isFinite(intake.max)))intake=null;
 const assessment=assessGoalPlan(input,extra);
 const targetKcal=intake&&input.sex?Math.round(intake.min):null;
 const inHorizon=weeks!==null&&weeks>0&&weeks<=maxDurationWeeks+1e-8;
 // Screen the exact rounded number which will be saved too, never silently clamp.
 const withinFloor=targetKcal!==null&&targetKcal>0&&assessment.intakeFloor!==null&&targetKcal>=assessment.intakeFloor;
 const nutritionApplicable=!!(exerciseValid&&inHorizon&&assessment.withinPlanningRange&&input.sex&&withinFloor);
 const maintenance=assessment.maintenanceTarget;
 // Reuse the existing screened baseline estimate, without extra exercise or the requested deficit.
 const conservativeTarget=assessment.canEstimate&&input.sex&&!input.excluded&&maintenance!==null&&Number.isFinite(maintenance)&&assessment.intakeFloor!==null&&maintenance>=assessment.intakeFloor?maintenance:null;
 const exerciseApplicable=!!(bodyValid&&!input.excluded&&s.exerciseEnabled&&exerciseValid);
 return {energy,intake,targetKcal,weeks,changeKg:change,weeklyChangeKg:change!==null&&weeks!==null&&weeks>0?change/weeks:null,targetBmi:target!==null&&input.heightCm?bmi(target,input.heightCm):null,assessment,exerciseKcal:s.exerciseEnabled&&exerciseValid?exerciseKcal:null,exerciseMinutes:s.exerciseEnabled?minutes:null,exerciseValid,nutritionApplicable,exerciseApplicable,bodyValid,conservativeTarget};
}
