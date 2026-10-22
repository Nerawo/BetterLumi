import type {Activity} from "./db";
import type {FoodLog} from "./domain";
import {dailyAggregation,measurement,nutritionMetrics,type NutritionMetric} from "./aggregation";
import {resolvedGoal,nutritionGoals,rangeStatus,type Goal} from "./goals";
import {exerciseGoalsEnabled} from "./goal-model";
import {weekDates} from "./exercise-schedule";
/** Resolve one reference for a local Monday–Sunday week, without rewriting any version. */
export function weeklyGoal(goals:Goal[],date:string){
 const dates=weekDates(date);
 return resolvedGoal(goals,dates[0],dates[6]);
}
export function weeklyStatistics(goals:Goal[],date:string,logs:FoodLog[],activities:Activity[]) {
 const dates=weekDates(date),daily=dates.map(day=>dailyAggregation(day,logs,activities));
 const selected=weeklyGoal(goals,date),selectedNutrition=nutritionGoals(selected);
 const nutrient=(key:NutritionMetric)=>{const reference=selectedNutrition[key],compatible=reference.mode==='weekly';const valid=daily.map(value=>value.nutrients[key]).filter(value=>value.complete);const average=valid.length?valid.reduce((sum,value)=>sum+value.value!,0)/valid.length:null;const status=compatible&&valid.length===7?rangeStatus(average,reference.min,reference.max):null;return {...reference,average,days:valid.length,compatible,status,achieved:status==='within'}};
 const nutrients=Object.fromEntries(nutritionMetrics.map(key=>[key,nutrient(key)])) as Record<NutritionMetric,ReturnType<typeof nutrient>>;
 const records=daily.flatMap(value=>value.exercise),minutes=measurement(records.map(a=>a.duration)),burned=measurement(records.map(a=>a.caloriesBurned));
 const enabled=exerciseGoalsEnabled(selected),exerciseCompatible=enabled&&selected?.exerciseMode==="weekly";
 const outcomes=enabled?[selected?.exerciseMinutes==null?null:{value:minutes,target:selected.exerciseMinutes},selected?.exerciseKcal==null?null:{value:burned,target:selected.exerciseKcal}].filter(v=>v!==null):[];
 const exercise={mode:selected?.exerciseMode??"daily",minutes,burned,enabled,minutesTarget:enabled?selected?.exerciseMinutes??null:null,kcalTarget:enabled?selected?.exerciseKcal??null:null,compatible:exerciseCompatible,achieved:exerciseCompatible&&outcomes.length>0&&outcomes.every(v=>v.value.complete&&v.value.value!==null&&v.value.value>=v.target)};
 const achievements=[...nutritionMetrics.filter(key=>nutrients[key].achieved),...(exercise.achieved?["exercise" as const]:[])];
 return {dates,start:dates[0],sunday:dates[6],goal:selected,nutrients,exercise,achievements};
}
