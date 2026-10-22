import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { calendarRings } from "./calendar-rings";
import {
  stamp,
  ingredientNutrition,
  type FoodLog,
  type PantryItem,
} from "./domain";
import type { Activity } from "./db";
import type { Goal } from "./goals";
import {
  matchesIngredient,
  ingredientAliases,
  splitAliases,
} from "./pantry-names";
import { consumedNutrition } from "./consumption";
const date = "2026-10-17";
const goal: Goal = {
  ...stamp(),
  startDate: "2026-01-01",
  endDate: null,
  calorieMin: 1000,
  calorieMax: 1200,
  exerciseMinutes: 30,
  exerciseKcal: 300,
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
  nutrition: { calories, protein: null, carbs: null, fat: null },
  lines: [],
  cookingNote: "",
});
const exercise = (duration: number, kcal: number | null): Activity => ({
  ...stamp(),
  date,
  type: "other",
  duration,
  caloriesBurned: kcal,
  distance: null,
  notes: "",
});
describe("independent calendar rings", () => {
  it.each([
    [60, "below", 6],
    [1100, "within", 100],
    [1350, "above", 100],
  ] as const)(
    "food %s kcal makes %s outer ring at %s percent",
    (kcal, state, percent) => {
      expect(calendarRings([goal], date, [food(kcal)], []).food).toEqual({
        state,
        percent,
        dashed: false,
      });
    },
  );
  it("never lets a large duration hide a missing required burned-calorie metric", () => {
    const r = calendarRings([goal], date, [], [exercise(300, null)]);
    expect(r.exercise).toEqual({
      state: "unknown",
      percent: null,
      dashed: true,
    });
    expect(r.minutesPercent).toBe(100);
    expect(r.burned).toBeNull();
  });
  it("uses a single duration goal and the lower fraction of two configured goals", () => {
    expect(
      calendarRings(
        [{ ...goal, exerciseKcal: null }],
        date,
        [],
        [exercise(20, null)],
      ).exercise.percent,
    ).toBeCloseTo(200 / 3);
    expect(
      calendarRings([goal], date, [], [exercise(40, 150)]).exercise,
    ).toEqual({ state: "below", percent: 50, dashed: false });
    expect(
      calendarRings([goal], date, [], [exercise(40, 350)]).exercise,
    ).toEqual({ state: "within", percent: 100, dashed: false });
  });
  it("renders food/exercise independently, no active ring for no records and neutral for no goals", () => {
    const r = calendarRings([goal], date, [food(60)], [exercise(40, 350)]);
    expect(r.food.state).toBe("below");
    expect(r.exercise.state).toBe("within");
    expect(calendarRings([goal], date, [], []).food.state).toBe("none");
    expect(
      calendarRings([], date, [food(60)], [exercise(40, null)]).exercise.state,
    ).toBe("neutral");
    expect(calendarRings([], date, [food(60)], []).food.state).toBe("neutral");
    expect(calendarRings([goal], date, [food(null)], []).food.state).toBe(
      "unknown",
    );
  });
  it("uses the effective dated goal and excludes deleted records", () => {
    expect(
      calendarRings(
        [{ ...goal, startDate: "2026-11-01" }],
        date,
        [food(60)],
        [],
      ).food.state,
    ).toBe("neutral");
    expect(
      calendarRings([goal], date, [{ ...food(60), deletedAt: date }], []).food
        .state,
    ).toBe("none");
  });
});
describe("aliases, unchanged nutrition units and percentages", () => {
  const salmon: PantryItem = {
    ...stamp(),
    name: "Salmon",
    nameZh: "三文鱼、鲑鱼",
    brand: "",
    basis: "100g",
    servingGrams: null,
    calories: 200,
    protein: 20,
    carbs: null,
    fat: 10,
    photo: "data:image/png;base64,AA==",
  };
  it("matches every legacy Chinese name and primary name case-insensitively", () => {
    for (const q of ["Salmon", "salMON", "三文鱼", "鲑鱼"])
      expect(matchesIngredient(salmon, q)).toBe(true);
    expect(
      ingredientAliases({ ...salmon, aliases: ["red fish", "鲑鱼"] }),
    ).toEqual(["red fish", "鲑鱼", "三文鱼"]);
    expect(splitAliases("a,b，c、d")).toEqual(["a", "b", "c", "d"]);
  });
  it("keeps per-100g and per-serving values distinct and refuses an unknown conversion", () => {
    expect(ingredientNutrition(salmon, 50, "g").calories).toBe(100);
    expect(ingredientNutrition(salmon, 1, "serving").calories).toBeNull();
    expect(
      ingredientNutrition(
        { ...salmon, basis: "serving", servingGrams: 50 },
        100,
        "g",
      ).calories,
    ).toBe(400);
    expect(
      ingredientNutrition({ ...salmon, basis: "serving" }, 100, "g").calories,
    ).toBeNull();
  });
  it("does not cap food consumption at 100% or fabricate unknown nutrients", () => {
    expect(
      consumedNutrition(
        { calories: 60, protein: null, carbs: 10, fat: 2 },
        150,
      ),
    ).toEqual({ calories: 90, protein: null, carbs: 15, fat: 3 });
    expect(
      consumedNutrition(
        { calories: 120, protein: null, carbs: null, fat: null },
        50,
      ).calories,
    ).toBe(60);
  });
});
