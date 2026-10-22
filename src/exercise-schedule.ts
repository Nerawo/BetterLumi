import { localDate, type ExercisePlan, type ExerciseOccurrence } from "./db";
export function shiftDay(date: string, delta: number) { const day = new Date(date + "T12:00:00"); day.setDate(day.getDate() + delta); return localDate(day); }
export function weekDates(date: string) { const day = new Date(date + "T12:00:00").getDay(); const monday = shiftDay(date, -((day + 6) % 7)); return Array.from({length:7},(_,n)=>shiftDay(monday,n)); }
export function scheduledExercise(plan: ExercisePlan, date: string) {
  if (plan.deletedAt || !plan.enabled) return false;
  const weekday = new Date(date + "T12:00:00").getDay();
  return plan.schedule === "daily" || (plan.schedule === "weekdays" && weekday >= 1 && weekday <= 5) || (plan.schedule === "custom" && plan.days.includes(weekday)) || (plan.schedule === "dates" && plan.dates.includes(date));
}
const dateIsValid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && localDate(new Date(value+"T12:00:00")) === value;
export function validExercisePlan(value: unknown): value is ExercisePlan {
  const p = value as ExercisePlan;
  return !!p && typeof p.name === "string" && !!p.name.trim() && typeof p.notes === "string" && typeof p.enabled === "boolean" && ["daily","weekdays","custom","dates"].includes(p.schedule) && Array.isArray(p.days) && p.days.every(n=>Number.isInteger(n)&&n>=0&&n<=6) && Array.isArray(p.dates) && p.dates.every(dateIsValid) && (p.schedule !== "custom" || p.days.length > 0) && (p.schedule !== "dates" || p.dates.length > 0) && Array.isArray(p.exercises) && p.exercises.length > 0 && p.exercises.every(e=>!!e && typeof e === "object") && new Set(p.exercises.map(e=>e.id)).size === p.exercises.length && p.exercises.every(e=>typeof e.id === "string" && !!e.id && typeof e.name === "string" && !!e.name.trim() && typeof e.notes === "string" && (e.trainingTags===undefined||Array.isArray(e.trainingTags)&&e.trainingTags.every(k=>typeof k==="string")) && (e.bodyParts===undefined||Array.isArray(e.bodyParts)&&e.bodyParts.every(k=>typeof k==="string")) && (e.estimatedCalories==null||Number.isFinite(e.estimatedCalories)&&e.estimatedCalories>=0) && (e.duration === null || Number.isFinite(e.duration)&&e.duration>0) && (e.distance===null || Number.isFinite(e.distance)&&e.distance>=0));
}
export function occurrenceId(planId: string, date: string, exerciseId: string) { return `${planId}:${date}:${exerciseId}`; }
export function validExerciseOccurrence(value: unknown): value is ExerciseOccurrence { const o=value as ExerciseOccurrence; return !!o && typeof o.planId === "string" && !!o.planId && typeof o.exerciseId === "string" && !!o.exerciseId && dateIsValid(o.date) && (o.activityId==null||typeof o.activityId==="string") && typeof o.completed === "boolean" && o.id === occurrenceId(o.planId,o.date,o.exerciseId); }
