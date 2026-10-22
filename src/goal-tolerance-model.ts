import {validLocalDate} from './routing';
import {nutritionMetrics,validMeasure,type NutritionMetric} from './aggregation';
import type {Goal} from './goal-model';
export type GoalTolerances=Record<NutritionMetric,number>;
export type NutritionTargets=Record<NutritionMetric,number|null>;
export interface ToleranceEvent {id:string;date:string;at:string;values:GoalTolerances}
export const defaultGoalTolerances:GoalTolerances={calories:50,protein:10,carbs:15,fat:5};
export function validTolerances(value:unknown):value is GoalTolerances{return !!value&&typeof value==='object'&&nutritionMetrics.every(key=>validMeasure((value as GoalTolerances)[key]))}
export function acceptableRange(target:number|null,tolerance:number){return target===null?{min:null,max:null}:{min:Math.max(0,target-tolerance),max:target+tolerance}}
export function derivedTarget(min:number|null,max:number|null){return min===null?max:max===null?min:(min+max)/2}
export function parseToleranceEvents(value:string|undefined):ToleranceEvent[]{
 if(!value)return [];const data=JSON.parse(value);if(data?.version!==1||!Array.isArray(data.events))throw Error('Invalid tolerance settings');
 const ids=new Set<string>();for(const e of data.events){if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||typeof e.date!=='string'||!validLocalDate(e.date)||typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at))||!validTolerances(e.values))throw Error('Invalid tolerance settings');ids.add(e.id)}return data.events;
}
export function currentTolerances(events:ToleranceEvent[]):GoalTolerances{return {...(events.at(-1)?.values??defaultGoalTolerances)}}
/** Snapshots remain the baseline. Only later preference events effective by this date/week apply. */
export function evaluatedTolerances(goal:Goal,date:string):GoalTolerances{
 const baseline=goal.nutritionTolerances??defaultGoalTolerances,events=goal.evaluationToleranceEvents??[],index=events.findIndex(e=>e.id===goal.nutritionToleranceRevision);
 const applicable=events.filter((e,i)=>(index>=0?i>index:e.at>=goal.createdAt)&&e.date<=date&&(!(goal.nutritionPeriod??goal).endDate||e.date<=(goal.nutritionPeriod??goal).endDate!));
 return {...(applicable.at(-1)?.values??baseline)};
}
export function evaluateToleranceGoal(goal:Goal|null,date:string):Goal|null{
 if(!goal?.nutritionTargets||!goal.nutritionTolerances)return goal;
 const values=evaluatedTolerances(goal,date);if(nutritionMetrics.every(key=>values[key]===goal.nutritionTolerances![key]))return goal;
 const configs=goal.nutritionGoals;if(!configs)return goal;
 const nutritionGoals=Object.fromEntries(nutritionMetrics.map(key=>[key,{...configs[key],...acceptableRange(goal.nutritionTargets![key],values[key])}])) as NonNullable<Goal['nutritionGoals']>;
 return {...goal,nutritionGoals,calorieMin:nutritionGoals.calories.mode==='off'?null:nutritionGoals.calories.min,calorieMax:nutritionGoals.calories.mode==='off'?null:nutritionGoals.calories.max};
}
