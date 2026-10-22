import type {Activity} from "./db";
import type {FoodLog,Nutrition} from "./domain";
export const nutritionMetrics=["calories","protein","carbs","fat"] as const;
export type NutritionMetric=typeof nutritionMetrics[number];
export const validMeasure=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>=0;
export function measurement(values:unknown[]) {
 const recorded=values.filter(validMeasure);
 return {value:recorded.length?recorded.reduce((a,b)=>a+b,0):null,complete:values.length>0&&recorded.length===values.length,known:recorded.length,missing:values.length-recorded.length};
}
/** Every UI and goal evaluation shares these date-local, ID-deduplicated totals. */
export function dailyAggregation(date:string,logs:FoodLog[],activities:Activity[]) {
 const unique=<T extends {id:string;date:string;deletedAt:string|null}>(rows:T[])=>[...new Map(rows.filter(row=>!row.deletedAt&&row.date===date).map(row=>[row.id,row])).values()];
 const food=unique(logs),exercise=unique(activities);
 const nutrients=Object.fromEntries(nutritionMetrics.map(key=>[key,measurement(food.map(row=>row.nutrition[key]))])) as Record<NutritionMetric,ReturnType<typeof measurement>>;
 return {food,exercise,foodCount:food.length,activityCount:exercise.length,nutrients,nutrition:Object.fromEntries(nutritionMetrics.map(key=>[key,nutrients[key].value])) as Nutrition,minutes:measurement(exercise.map(row=>row.duration)),burned:measurement(exercise.map(row=>row.caloriesBurned))};
}
