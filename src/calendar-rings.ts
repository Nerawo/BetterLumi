import { todayProgress, progressPercent } from "./today-progress";
import type { Goal } from "./goals";
import type { FoodLog } from "./domain";
import type { Activity } from "./db";
export type RingState =
  "none" | "neutral" | "unknown" | "below" | "within" | "above";
export interface Ring {
  state: RingState;
  percent: number | null;
  dashed: boolean;
}
const usable = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
export function calendarRings(
  goals: Goal[],
  date: string,
  logs: FoodLog[],
  activities: Activity[],
) {
  const p = todayProgress(goals, date, logs, activities);
  const records = activities.filter((a) => !a.deletedAt && a.date === date);
  const food: Ring = !p.foodCount
    ? { state: "none", percent: null, dashed: false }
    : p.intake === null || !p.daily.nutrients.calories.complete
      ? { state: "unknown", percent: null, dashed: true }
      : p.foodStatus === null
        ? { state: "neutral", percent: 100, dashed: false }
        : { state: p.foodStatus, percent: p.foodPercent, dashed: false };
  let exercise: Ring = { state: "none", percent: null, dashed: false };
  if (p.activityCount) {
    const configured = p.minutesTarget !== null || p.burnedTarget !== null;
    const missing =
      (p.minutesTarget !== null && records.some((a) => !usable(a.duration))) ||
      (p.burnedTarget !== null &&
        records.some((a) => !usable(a.caloriesBurned)));
    if (!configured)
      exercise = { state: "neutral", percent: 100, dashed: false };
    else if (missing)
      exercise = { state: "unknown", percent: null, dashed: true };
    else {
      const percents: number[] = [];
      if (p.minutesTarget !== null)
        percents.push(progressPercent(p.minutes, p.minutesTarget) ?? 0);
      if (p.burnedTarget !== null)
        percents.push(progressPercent(p.burned, p.burnedTarget) ?? 0);
      const percent = Math.min(...percents);
      exercise = {
        state: percent >= 100 ? "within" : "below",
        percent,
        dashed: false,
      };
    }
  }
  return { ...p, food, exercise };
}
