import {assessGoalPlan,type PlanAssessment} from './goal-plan-assessment';
import {theoreticalGoalMath,type CalculatorInput,type CalculatorActivity,type EstimateRange} from './calculator-model';
export {activityMultipliers,bmi,weightInKg,weightFromKg,durationInWeeks,durationFromWeeks,maxDurationWeeks} from './calculator-model';
export type {CalculatorInput,CalculatorActivity,CalculatorWeightUnit,EstimateRange} from './calculator-model';
export type CalculatorTarget='plan'|'maintenance';
export type CalculatorWarning='excluded'|'underweight'|'fast'|'normalLoss'|'lowIntake'|'sexNeeded'|'largeAdjustment';
export interface CalculatorResult {
 currentBmi:number;targetBmi:number;changeKg:number;weeklyChangeKg:number;weeks:number;
 bmr:EstimateRange;maintenance:EstimateRange;
 /** Visibility is independent of approval. Only planTarget can be applied. */
 theoretical:EstimateRange;assessment:PlanAssessment;
 planTarget:number|null;maintenanceTarget:number|null;weeklyMinutes:number;warnings:CalculatorWarning[];
}
const weeklyMinutes:Record<CalculatorActivity,number>={sedentary:150,light:150,moderate:225,very:300};
export function calculateHealthGoal(input:CalculatorInput):CalculatorResult {
 const math=theoreticalGoalMath(input),assessment=assessGoalPlan(input);
 const warningMap:Partial<Record<PlanAssessment['reasons'][number],CalculatorWarning>>={targetUnderweight:'underweight',pace:'fast',gainPace:'fast',normalBmi:'normalLoss',intake:'lowIntake',sexNeeded:'sexNeeded',deficit:'largeAdjustment'};
 const warnings=[...new Set(assessment.reasons.map(reason=>warningMap[reason]).filter((value):value is CalculatorWarning=>!!value))];
 return {...math,assessment,planTarget:assessment.planTarget,maintenanceTarget:assessment.maintenanceTarget,weeklyMinutes:weeklyMinutes[input.activity],warnings};
}
export function calculatorTarget(result:CalculatorResult,kind:CalculatorTarget){
 if(!['plan','maintenance'].includes(kind))throw Error('Invalid calculator target');
 return kind==='plan'?result.planTarget:result.maintenanceTarget;
}
