import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { todayProgress, progressPercent } from "./today-progress";
import { stamp, type FoodLog } from "./domain";
import type { Activity } from "./db";
import type { Goal } from "./goals";
const date = "2026-10-17";
const goal: Goal = {
  ...stamp(),
  startDate: "2026-01-01",
  endDate: null,
  calorieMin: 1500,
  calorieMax: 1800,
  exerciseMinutes: 30,
  exerciseKcal: 200,
};
const food = (calories: number | null): FoodLog => ({
  ...stamp(),
  date,
  name: "Test",
  category: "uncategorized",
  source: "quick",
  sourceId: null,
  quantity: 1,
  unit: "entry",
  nutrition: { calories, protein: null, fat: null, carbs: null },
  lines: [],
  cookingNote: "",
});
const activity = (minutes: number, kcal: number | null): Activity => ({
  ...stamp(),
  date,
  type: "other",
  name: "Test",
  duration: minutes,
  distance: null,
  caloriesBurned: kcal,
  notes: "",
});
describe("Today progress presentation data", () => {
  it("does not invent zero for empty or unknown-only records", () => {
    const empty = todayProgress([goal], date, [], []);
    expect(empty.intake).toBeNull();
    expect(empty.minutes).toBeNull();
    expect(empty.burned).toBeNull();
    expect(empty.foodPercent).toBeNull();
    expect(empty.foodCount).toBe(0);
    const unknown = todayProgress(
      [goal],
      date,
      [food(null)],
      [activity(20, null)],
    );
    expect(unknown.foodCount).toBe(1);
    expect(unknown.intake).toBeNull();
    expect(unknown.burnedPercent).toBeNull();
  });
  it.each([
    [500, "below", 100 / 3],
    [1600, "within", 100],
    [2000, "above", 100],
  ] as const)(
    "shows the recorded %s kcal with status %s and caps the food bar",
    (kcal, status, percent) => {
      const p = todayProgress([goal], date, [food(kcal)], []);
      expect(p.foodStatus).toBe(status);
      expect(p.foodPercent).toBeCloseTo(percent);
    },
  );
  it("keeps known partial records and each exercise metric separate", () => {
    const p = todayProgress(
      [goal],
      date,
      [food(700), food(null)],
      [activity(15, null), activity(20, 80)],
    );
    expect(p.intake).toBe(700);
    expect(p.minutes).toBe(35);
    expect(p.minutesPercent).toBe(100);
    expect(p.burned).toBe(80);
    expect(p.burnedPercent).toBe(40);
    expect(p.foodPercent).toBeCloseTo((700 / 1500) * 100);
  });
  it("has no remaining-target calculation when no target applies", () => {
    const p = todayProgress([], date, [food(700)], [activity(15, 50)]);
    expect(p.intake).toBe(700);
    expect(p.foodStatus).toBeNull();
    expect(p.foodPercent).toBeNull();
    expect(p.minutesPercent).toBeNull();
    expect(p.burnedPercent).toBeNull();
  });
  it("uses the local date and excludes deleted and other-date records", () => {
    const p = todayProgress(
      [goal],
      date,
      [
        food(600),
        { ...food(900), date: "2026-10-16" },
        { ...food(800), deletedAt: date },
      ],
      [{ ...activity(80, 500), date: "2026-10-16" }],
    );
    expect(p.intake).toBe(600);
    expect(p.foodCount).toBe(1);
    expect(p.activityCount).toBe(0);
  });
  it("handles zero-valued targets without division by zero", () => {
    expect(progressPercent(0, 0)).toBe(100);
    expect(progressPercent(null, 0)).toBeNull();
    expect(progressPercent(25, null)).toBeNull();
  });
});
