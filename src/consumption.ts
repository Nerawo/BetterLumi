import { scaleNutrition, type Nutrition } from "./domain";
export function historicalConsumptionPercent(percent: number | undefined) {
  return percent ?? 100;
}
export function consumedNutrition(base: Nutrition, percent = 100) {
  if (!Number.isFinite(percent) || percent < 0)
    throw Error("Invalid consumption percentage");
  return scaleNutrition(base, percent / 100);
}
