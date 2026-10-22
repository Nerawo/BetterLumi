import {assessGoalPlan,type PlanAssessmentInput,type PlanReason,type PlanAssessment} from './goal-plan-assessment';
import {durationFromWeeks,maxDurationWeeks,weightFromKg,type EstimateRange} from './calculator-model';

export interface PlanSuggestion {
 range:EstimateRange|null;
 reason:PlanReason|'maintenanceGoal'|'phasedPlan';
 /** Safe direction of display rounding: longer time / less weight loss. */
 adopt:number|null;
}
const roundUp=(value:number)=>Math.ceil((value-1e-9)*10)/10;
const priority:PlanReason[]=['minor','excluded','invalidBody','missingBody','underweight','targetUnderweight','invalidTarget','invalidDuration','energyUnreliable','energyMargin','intake','deficit','pace','gainPace','sexNeeded','cautionIntake','cautionDeficit','cautionPace','olderAdult','normalBmi'];
export const primaryPlanReason=(reasons:PlanReason[])=>priority.find(reason=>reasons.includes(reason))??'energyMargin';

/** The other field is deliberately absent. Invalid or cleared duration cannot
 * change the target's timeline, and the target cannot change duration advice. */
export function suggestTargetTimeline(input:PlanAssessmentInput,additionalDailyExercise=0):PlanSuggestion|null {
 if(input.targetWeight===null)return null;
 const a=assessGoalPlan({...input,duration:null},additionalDailyExercise);
 if(a.targetBmi!==null&&a.currentBmi===a.targetBmi)return {range:{min:0,max:0},reason:'maintenanceGoal',adopt:null};
 if(a.referenceWeeks&&a.referenceWeeks.min>maxDurationWeeks)return {range:null,reason:'phasedPlan',adopt:null};
 const range=a.referenceWeeks&&{min:roundUp(durationFromWeeks(a.referenceWeeks.min,input.durationUnit)),max:roundUp(durationFromWeeks(a.referenceWeeks.max,input.durationUnit))};
 const adopt=a.referenceWeeks&&a.referenceWeeks.min<=maxDurationWeeks?range!.min:null;
 // Rounding must not create an input beyond the supported planning horizon.
 return {range,reason:primaryPlanReason(a.reasons),adopt:adopt!==null&&adopt<=durationFromWeeks(maxDurationWeeks,input.durationUnit)?adopt:null};
}
export function suggestWeightForDuration(input:PlanAssessmentInput,additionalDailyExercise=0):PlanSuggestion|null {
 if(input.duration===null)return null;
 const a=assessGoalPlan({...input,targetWeight:null},additionalDailyExercise);
 const range=a.reachableWeightKg&&{min:roundUp(weightFromKg(a.reachableWeightKg.min,input.weightUnit)),max:roundUp(weightFromKg(a.reachableWeightKg.max,input.weightUnit))};
 return {range,reason:primaryPlanReason(a.reasons),adopt:range?.min??null};
}

/** Presentation data only: numeric evidence comes from the exact assessment used to save. */
export function planReasonMessage(reason:PlanReason,a:PlanAssessment):{key:string;values:Record<string,number>}{
 const message=(key:string,values:Record<string,number>)=>({key,values});
 if(reason==='energyUnreliable'&&a.energy){
  if(a.energyIssue==='baselineBelowReference'&&a.minimumIntake!==null)return message('planEvidence_lowBaseline',{energy:a.energy.maintenance.min,limit:a.minimumIntake});
  if(a.energyIssue==='additionalExercise'&&a.additionalDailyExercise!==null)return message('planEvidence_extraExercise',{exercise:a.additionalDailyExercise,limit:a.energy.maintenance.min*.25});
 }
 if(reason==='intake'&&a.requestedIntake&&!Number.isFinite(a.requestedIntake.min))return message('planEvidence_nonfiniteIntake',{});
 if(reason==='intake'&&a.requestedIntake&&a.intakeFloor!==null&&a.deficitFraction!==null)return message(a.intakeBoundarySource==='minimum'?'planEvidence_intakeMinimum':'planEvidence_intakeRelative',{intake:a.requestedIntake.min,limit:a.intakeFloor,percent:a.deficitFraction*100});
 if(reason==='cautionIntake'&&a.requestedIntake&&a.cautionFloor!==null&&a.cautionFraction!==null)return message('planEvidence_cautionIntake',{intake:a.requestedIntake.min,limit:a.cautionFloor,percent:a.cautionFraction*100});
 if((reason==='deficit'||reason==='cautionDeficit')&&a.dailyDeficit!==null){const limit=reason==='deficit'?a.deficitLimit:a.cautionDeficitLimit;if(limit!==null)return message('planEvidence_'+reason,{deficit:a.dailyDeficit,limit})}
 if((reason==='pace'||reason==='cautionPace')&&a.weeklyChangeKg!==null&&a.weeklyPercent!==null){const limit=reason==='pace'?a.weeklyLossLimit:a.cautionWeeklyLossLimit;if(limit!==null)return message('planEvidence_'+reason,{rate:Math.abs(a.weeklyChangeKg),percent:Math.abs(a.weeklyPercent),limit})}
 if(reason==='targetUnderweight'&&a.targetBmi!==null)return message('planEvidence_targetUnderweight',{bmi:a.targetBmi});
 if(reason==='underweight'&&a.currentBmi!==null)return message('planEvidence_underweight',{bmi:a.currentBmi});
 if(reason==='normalBmi'&&a.currentBmi!==null)return message('planEvidence_normalBmi',{bmi:a.currentBmi});
 return {key:'planReason_'+reason,values:{}};
}
