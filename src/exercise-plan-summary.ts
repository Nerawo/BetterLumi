import type {Activity,ExercisePlan} from './db';
import {measurement,validMeasure} from './aggregation';
import {occurrenceId} from './exercise-schedule';
/** Display-only totals: linked actuals never fall back to estimates for missing fields. */
export function exercisePlanSummary(plans:ExercisePlan[],date:string,activities:Activity[],isCompleted:(key:string)=>boolean){
 const actuals=new Map<string,Activity>();
 for(const row of activities)if(!row.deletedAt&&row.date===date&&row.planOccurrenceId&&!actuals.has(row.planOccurrenceId))actuals.set(row.planOccurrenceId,row);
 const seen=new Set<string>();
 const values=plans.flatMap(plan=>plan.exercises.flatMap(item=>{
  const key=occurrenceId(plan.id,date,item.id);if(seen.has(key))return [];seen.add(key);
  const actual=actuals.get(key),requiresActual=!!actual||isCompleted(key);
  return [{duration:actual?actual.duration:requiresActual?null:item.duration,calories:actual?actual.caloriesBurned:requiresActual?null:item.estimatedCalories,requiresActual}];
 }));
 return {minutes:measurement(values.map(v=>v.duration)),burned:measurement(values.map(v=>v.calories)),partial:values.some(v=>v.requiresActual&&(!validMeasure(v.duration)||!validMeasure(v.calories))),hasEstimates:values.some(v=>!v.requiresActual&&validMeasure(v.calories))};
}
