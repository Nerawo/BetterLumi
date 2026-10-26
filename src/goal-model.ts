import {acceptableRange,validTolerances,type GoalTolerances,type NutritionTargets,type ToleranceEvent} from './goal-tolerance-model';
import {validLocalDate} from "./routing";
import type {RecordBase} from "./db";
import {nutritionMetrics,type NutritionMetric,validMeasure} from "./aggregation";
export type NutritionMode="off"|"daily"|"weekly";
export interface NutritionGoal {mode:NutritionMode;min:number|null;max:number|null}
export interface DailyNutrientGoal {mode:"off"|"daily";min:number|null;max:number|null}
export type NutritionGoals=Record<NutritionMetric,NutritionGoal>;
export type GoalSection="nutrition"|"exercise";
/** startDate remains the ordering anchor when unrestricted, never a date restriction. */
export interface GoalPeriod {startDate:string;endDate:string|null;unrestricted?:boolean}
export function periodApplies(period:GoalPeriod,start:string,end=start){return period.unrestricted===true||period.startDate<=end&&(!period.endDate||period.endDate>=start)}
export function goalPeriod(goal:Goal,section:GoalSection):GoalPeriod {return goal[section==="nutrition"?"nutritionPeriod":"exercisePeriod"]??{startDate:goal.startDate,endDate:goal.endDate};}
export interface Goal extends RecordBase {
 /** Additive dated override; legacy versions continue to cover both sections. */
 scope?:'calories'|'exercise';
 /** An additive full-nutrition version never participates in exercise selection. */
 nutritionOnly?:boolean;
 /** Provenance only: never treats an entered professional target as an app recommendation. */
 calorieSource?:'automatic'|'professional';
 nutritionTargets?:NutritionTargets;nutritionTolerances?:GoalTolerances;nutritionToleranceRevision?:string;
 /** Read-only evaluation context; never written to the goal table. */
 evaluationToleranceEvents?:ToleranceEvent[];
 /** Presentation-only exact calorie target when combined with legacy macro ranges. */
 evaluationCalorieTarget?:number|null;
 nutritionPeriod?:GoalPeriod;exercisePeriod?:GoalPeriod;
 nutritionFrequency?:'daily'|'weekly';
 startDate:string;endDate:string|null;calorieMin:number|null;calorieMax:number|null;
 exerciseMinutes:number|null;exerciseKcal:number|null;
 nutritionGoals?:Record<NutritionMetric,NutritionGoal>;exerciseMode?:"daily"|"weekly";exerciseEnabled?:boolean;nutritionEnabled?:boolean;
}
/** Missing flags on historical versions retain the original enabled behavior. */
export function exerciseGoalsEnabled(goal:Goal|null|undefined){return !!goal&&goal.exerciseEnabled!==false;}
export function nutritionGoalsEnabled(goal:Goal|null|undefined){return !!goal&&goal.nutritionEnabled!==false;}
/** Evaluation masks disabled goals; stored settings remain available to editors and backups. */
export function nutritionGoals(goal:Goal|null|undefined):NutritionGoals {
 const configured=configuredNutritionGoals(goal);
 return nutritionGoalsEnabled(goal)?configured:Object.fromEntries(nutritionMetrics.map(key=>[key,{...configured[key],mode:"off"}])) as NutritionGoals;
}
export function configuredNutritionGoals(goal:Goal|null|undefined):NutritionGoals {
 return Object.fromEntries(nutritionMetrics.map(metric=>{
  const configured=goal?.nutritionGoals?.[metric];
  const value=configured??(metric==='calories'?{mode:goal&&(goal.calorieMin!=null||goal.calorieMax!=null)?'daily':'off',min:goal?.calorieMin??null,max:goal?.calorieMax??null}:{mode:'off',min:null,max:null});
  return [metric,goal?.nutritionFrequency&&value.mode!=='off'?{...value,mode:goal.nutritionFrequency}:value];
 })) as NutritionGoals;
}
export function validGoalConfig(value:unknown) {
 const g=value as Goal;if(!g||![g.calorieMin,g.calorieMax,g.exerciseMinutes,g.exerciseKcal].every(v=>v===null||validMeasure(v)))return false;
 if(g.nutritionOnly!==undefined&&typeof g.nutritionOnly!=='boolean')return false;
 if(g.nutritionOnly&&(g.scope!==undefined||g.nutritionEnabled!==true||g.exerciseEnabled!==false||g.exerciseMinutes!==null||g.exerciseKcal!==null))return false;
 if(g.calorieSource!==undefined&&(!['automatic','professional'].includes(g.calorieSource)||g.scope!=='calories'))return false;
 if(g.scope!==undefined&&g.scope!=='calories'&&g.scope!=='exercise')return false;
 if(g.scope==='exercise'&&(g.nutritionEnabled!==false||g.exerciseEnabled!==true||g.exerciseMode!=='weekly'||g.calorieMin!==null||g.calorieMax!==null||g.nutritionTargets!==undefined||g.nutritionGoals!==undefined))return false;
 if(g.scope==='calories'&&(g.nutritionTargets?.calories==null||!g.nutritionTolerances))return false;
 if(g.scope==='calories'&&(g.nutritionEnabled!==true||g.exerciseEnabled!==false||g.exerciseMinutes!==null||g.exerciseKcal!==null||!g.nutritionGoals||g.nutritionGoals.calories.mode==='off'||['protein','carbs','fat'].some(key=>g.nutritionGoals![key as NutritionMetric]?.mode!=='off')))return false;
 if(g.nutritionTargets!==undefined&&(!g.nutritionTargets||!validTolerances(g.nutritionTolerances)||!nutritionMetrics.every(key=>g.nutritionTargets![key]===null||validMeasure(g.nutritionTargets![key]))))return false;
 if(g.nutritionTargets!==undefined){if(!g.nutritionGoals||!nutritionMetrics.every(key=>{const target=g.nutritionTargets![key],config=g.nutritionGoals![key],range=acceptableRange(target,g.nutritionTolerances![key]);return config&&config.min===range.min&&config.max===range.max&&!(g.nutritionEnabled!==false&&config.mode!=='off'&&target===null)}))return false;}
 if(g.nutritionTolerances!==undefined&&!validTolerances(g.nutritionTolerances))return false;
 if(g.nutritionToleranceRevision!==undefined&&typeof g.nutritionToleranceRevision!=='string')return false;
 if(g.calorieMin!==null&&g.calorieMax!==null&&g.calorieMin>g.calorieMax)return false;
 for(const period of [g.nutritionPeriod,g.exercisePeriod])if(period!==undefined&&(!period||!validLocalDate(period.startDate)||!(period.endDate===null||validLocalDate(period.endDate)&&period.endDate>=period.startDate)||!(period.unrestricted===undefined||typeof period.unrestricted==='boolean')||period.unrestricted===true&&period.endDate!==null))return false;
 if(g.nutritionFrequency!==undefined&&!['daily','weekly'].includes(g.nutritionFrequency))return false;
 if(g.nutritionFrequency&&g.nutritionGoals&&nutritionMetrics.some(key=>g.nutritionGoals![key]?.mode!=='off'&&g.nutritionGoals![key]?.mode!==g.nutritionFrequency))return false;
 if(g.nutritionEnabled!==undefined&&typeof g.nutritionEnabled!=="boolean")return false;
 if(g.exerciseEnabled!==undefined&&typeof g.exerciseEnabled!=="boolean")return false;
 if(g.exerciseMode!==undefined&&!["daily","weekly"].includes(g.exerciseMode))return false;
 return g.nutritionGoals===undefined||nutritionMetrics.every(key=>{const n=g.nutritionGoals?.[key];return !!n&&["off","daily","weekly"].includes(n.mode)&&[n.min,n.max].every(v=>v===null||validMeasure(v))&&!(n.min!==null&&n.max!==null&&n.min>n.max)});
}
