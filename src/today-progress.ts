import {exerciseGoalsEnabled,nutritionGoals} from "./goal-model";
import { goalStatus, type Goal } from "./goals";
import type { FoodLog } from "./domain";
import type { Activity } from "./db";
export function progressPercent(value: number | null, target: number | null) {
  if (value === null || target === null) return null;
  if (target === 0) return 100;
  return Math.min(100, Math.max(0, (value / target) * 100));
}
export function todayProgress(
  goals: Goal[],
  date: string,
  logs: FoodLog[],
  activities: Activity[],
) {
  const data = goalStatus(goals, date, logs, activities);
  const {foodCount,activityCount}=data.daily;
  const calorie=nutritionGoals(data.goal).calories;
  const calorieMin=calorie.mode==="daily"?calorie.min:null,calorieMax=calorie.mode==="daily"?calorie.max:null;
  const isDaily=exerciseGoalsEnabled(data.goal)&&(data.goal?.exerciseMode??"daily")==="daily";
  const minutesTarget=isDaily?data.goal?.exerciseMinutes??null:null,burnedTarget=isDaily?data.goal?.exerciseKcal??null:null;
  return {
    ...data,
    foodCount,
    activityCount,
    calorieMin,
    calorieMax,
    minutesTarget,
    burnedTarget,
    foodPercent: progressPercent(data.intake, calorieMin ?? calorieMax),
    minutesPercent: progressPercent(data.minutes, minutesTarget),
    burnedPercent: progressPercent(data.burned, burnedTarget),
  };
}
