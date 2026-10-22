import {rangeStatus} from "./goals";
import {progressPercent} from "./today-progress";
import type {NutritionGoal,DailyNutrientGoal} from "./goal-model";
import type {measurement} from "./aggregation";
import type {weeklyStatistics} from "./weekly-goals";
export type NutrientMeasurement=ReturnType<typeof measurement>;
export type WeeklyNutrient=ReturnType<typeof weeklyStatistics>["nutrients"]["calories"];
function presentation(config:NutritionGoal,value:number|null,complete:boolean,weekly=false){
 const enabled=config.mode!=="off"&&(config.min!==null||config.max!==null);
 const status=enabled&&(weekly||complete)?rangeStatus(value,config.min,config.max):null;
 const percent=enabled?progressPercent(value,config.min??config.max):null;
 return {enabled,isWeekly:weekly,value,complete,status,percent,ringPercent:config.min===null?null:percent,upperOnly:config.min===null&&config.max!==null,achieved:enabled&&complete&&status==="within"};
}
export function dailyNutrientGoalDisplay(config:DailyNutrientGoal,daily:NutrientMeasurement){return presentation(config,daily.value,daily.complete)}
/** All enabled nutrients use the same valid-day average and completeness rules. */
export function nutrientGoalDisplay(config:NutritionGoal,daily:NutrientMeasurement,weekly:WeeklyNutrient){
 if(config.mode!=="weekly")return presentation(config,daily.value,daily.complete);
 const display=presentation(config,weekly.average,weekly.days===7,true);
 return {...display,achieved:display.enabled&&weekly.achieved};
}
export const calorieGoalDisplay=nutrientGoalDisplay;
