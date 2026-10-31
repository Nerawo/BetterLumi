import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, it, expect, afterEach } from "vitest";
import {
  db,
  stamp,
  foodLogs,
  weights,
  exportAll,
  restoreAll,
  type FoodLog,
} from "./domain";
import { LumiDB, type Activity, type Supplement } from "./db";
import {
  activeGoal,
  goalStatus,
  saveGoalVersion,
  goalTable,
  isScheduled,
  type Goal,
  recipeNotes,
} from "./goals";
import { validLocalDate, parseRoute, shiftMonth } from "./routing";
const goal = (extra: Partial<Goal> = {}): Goal => ({
  ...stamp(),
  startDate: "2026-01-01",
  endDate: null,
  calorieMin: 1500,
  calorieMax: 1800,
  exerciseMinutes: 30,
  exerciseKcal: null,
  ...extra,
});
const food = (calories: number | null, date = "2026-10-17"): FoodLog => ({
  ...stamp(),
  date,
  name: "",
  category: "uncategorized",
  source: "quick",
  sourceId: null,
  quantity: 1,
  unit: "entry",
  nutrition: { calories, protein: null, carbs: null, fat: null },
  lines: [],
  cookingNote: "",
});
const exercise = (duration: number, kcal: number | null = null): Activity => ({
  ...stamp(),
  date: "2026-10-17",
  type: "other",
  name: "Custom movement",
  duration,
  distance: null,
  notes: "",
  caloriesBurned: kcal,
});
afterEach(async () => {
  for (const t of db.tables) await t.clear();
});
describe("logged-only goals and dated versions", () => {
  it.each([
    [null, null],
    [0, "below"],
    [1499, "below"],
    [1500, "within"],
    [1700, "within"],
    [1800, "within"],
    [1801, "above"],
  ] as const)(
    "compares %s logged kcal to the applicable range",
    (calories, status) => {
      expect(
        goalStatus([goal()], "2026-10-17", [food(calories)], []).foodStatus,
      ).toBe(status);
    },
  );
  it("shows no dots for unlogged, goal-free, unknown-only, or out-of-period days", () => {
    expect(goalStatus([goal()], "2026-10-17", [], []).foodStatus).toBeNull();
    expect(
      goalStatus([], "2026-10-17", [food(1700)], [exercise(45)]).exerciseStatus,
    ).toBeNull();
    expect(
      goalStatus(
        [goal({ endDate: "2026-10-16" })],
        "2026-10-17",
        [food(1700)],
        [],
      ).foodStatus,
    ).toBeNull();
  });
  it("does not assume a meal count, and sums usable logged values without turning unknowns into zero", () => {
    for (const count of [1, 2, 5]) {
      const logs = Array.from({ length: count }, () => food(1600 / count));
      const s = goalStatus([goal()], "2026-10-17", [...logs, food(null)], []);
      expect(s.intake).toBe(1600);
      expect(s.foodStatus).toBeNull();
    }
    expect(
      goalStatus([goal()], "2026-10-17", [food(null)], []).intake,
    ).toBeNull();
  });
  it("keeps exercise separate and does not infer missing calories", () => {
    const a = goalStatus(
      [goal()],
      "2026-10-17",
      [food(1700)],
      [exercise(20, 500)],
    );
    expect(a.intake).toBe(1700);
    expect(a.foodStatus).toBe("within");
    expect(a.exerciseStatus).toBe("below");
    expect(
      goalStatus([goal()], "2026-10-17", [], [exercise(30)]).exerciseStatus,
    ).toBe("within");
    expect(
      goalStatus(
        [goal({ exerciseMinutes: null, exerciseKcal: 100 })],
        "2026-10-17",
        [],
        [exercise(60)],
      ).exerciseStatus,
    ).toBeNull();
    expect(
      goalStatus(
        [goal({ exerciseKcal: 100 })],
        "2026-10-17",
        [],
        [exercise(60)],
      ).exerciseStatus,
    ).toBeNull();
  });
  it("retains historical versions and uses the latest save for the same start date", async () => {
    const values = {
      startDate: "2026-01-01",
      endDate: null,
      calorieMin: 1500,
      calorieMax: 1800,
      exerciseMinutes: null,
      exerciseKcal: null,
    };
    await saveGoalVersion(values);
    await saveGoalVersion({
      ...values,
      startDate: "2026-11-01",
      calorieMin: 1600,
      calorieMax: 1900,
    });
    await saveGoalVersion({
      ...values,
      startDate: "2026-11-01",
      calorieMin: 1700,
      calorieMax: 2000,
    });
    const all = await goalTable.toArray();
    expect(all).toHaveLength(3);
    expect(activeGoal(all, "2026-10-17")?.calorieMin).toBe(1500);
    expect(activeGoal(all, "2026-11-03")?.calorieMin).toBe(1700);
  });
});
describe("schedules and routing", () => {
  it("saves independent custom weekday combinations without a missed-dose inference", () => {
    const s: Supplement = {
      ...stamp(),
      name: "Example",
      dosage: 1,
      unit: "tablet",
      schedule: "custom",
      days: [2, 3],
    };
    expect(isScheduled(s, "2026-10-20")).toBe(true);
    expect(isScheduled(s, "2026-10-22")).toBe(false);
    expect(isScheduled({ ...s, days: [4, 5] }, "2026-10-22")).toBe(true);
    expect(s.days).toEqual([2, 3]);
    expect(isScheduled({ ...s, schedule: "weekdays" }, "2026-10-17")).toBe(
      false,
    );
  });
  it("parses deep links and dates, rejects calendar rollovers and clamps month navigation", () => {
    expect(parseRoute("/recipes/abc").recipeId).toBe("abc");
    expect(parseRoute("/weight").page).toBe("weight");
    expect(parseRoute("/journal?date=2026-10-17").selectedDate).toBe(
      "2026-10-17",
    );
    expect(validLocalDate("2026-02-30")).toBe(false);
    expect(validLocalDate("2026-10-17")).toBe(true);
    expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-28");
  });
});
describe("non-destructive migrations and backup continuity", () => {
  it("preserves legacy images plus aliases, reviewed OCR and percentages through backup/restore", async () => {
    const image = "data:image/png;base64,AA==";
    const ingredient = {
      ...stamp(),
      name: "Salmon",
      nameZh: "三文鱼、鲑鱼",
      brand: "",
      basis: "100g" as const,
      servingGrams: null,
      calories: 200,
      protein: 20,
      carbs: null,
      fat: 10,
      photo: image,
      labelPhoto: image,
      aliases: ["三文鱼", "鲑鱼"],
      nutritionSource: "package-label-ocr" as const,
      labelRecognition: {
        text: "Calories 200",
        confidence: 90,
        language: "eng",
        reviewedAt: new Date().toISOString(),
      },
    };
    await db.ingredients.put(ingredient);
    const meal = {
      ...food(90),
      consumptionPercent: 150,
      baseNutrition: { calories: 60, protein: null, carbs: null, fat: null },
    };
    await foodLogs.put(meal);
    await restoreAll(await exportAll());
    expect(await db.ingredients.get(ingredient.id)).toEqual(ingredient);
    expect(await foodLogs.get(meal.id)).toEqual(meal);
  });
  it("upgrades v2 across every existing table without dropping rows, IDs, values or the saved language", async () => {
    const name = "v2-preserve-" + crypto.randomUUID();
    const old = new Dexie(name);
    const schema = {
      ingredients: "id,name,nameZh,updatedAt,deletedAt",
      activities: "id,date,updatedAt,deletedAt",
      supplements: "id,updatedAt,deletedAt",
      checks: "id,[supplementId+date],date,updatedAt",
      settings: "key",
      recipes: "id,updatedAt,deletedAt",
      meals: "id,date,updatedAt,deletedAt",
      images: "id,updatedAt,deletedAt",
      recipeCards: "id,name,updatedAt,deletedAt",
      foodLogs: "id,date,updatedAt,deletedAt",
      plans: "id,date,kind,updatedAt,deletedAt",
      weights: "id,date,updatedAt,deletedAt",
    };
    old.version(2).stores(schema);
    const original: Record<string, any> = {};
    for (const table of Object.keys(schema)) {
      const row =
        table === "settings"
          ? { key: "language", value: "zh" }
          : {
              ...stamp(),
              name: "Preserved " + table,
              date: "2026-10-17",
              schedule: "weekdays",
              kg: 70,
              stickyNote: "Original note",
              type: "swimming",
              duration: 30,
              distance: null,
              notes: "Keep this",
            };
      original[table] = row;
      await old.table(table).put(row);
    }
    old.close();
    const current = new LumiDB(name);
    await current.open();
    for (const [table, row] of Object.entries(original)) {
      const saved = await current
        .table(table)
        .get(table === "settings" ? row.key : row.id);
      expect(saved).toMatchObject(row);
      expect(await current.table(table).count()).toBe(1);
    }
    expect((await current.supplements.toArray())[0].days).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect((await current.activities.toArray())[0].caloriesBurned).toBeNull();
    expect(await current.table("goals").count()).toBe(0);
    await current.delete();
  });
  it("round trips custom fields, goals and multiple notes and accepts an older v2 backup", async () => {
    const a = exercise(45, 250);
    a.trainingTags = ["strength", "anaerobic"];
    a.bodyParts = ["Custom label"];
    await db.activities.put(a);
    await goalTable.put(goal());
    await recipeNotes.put({
      ...stamp(),
      recipeId: "retained-recipe-id",
      text: "Paper note",
    });
    await weights.put({
      ...stamp(),
      date: "2026-10-17",
      kg: 70,
      notes: "Historical note",
    });
    await foodLogs.put(food(null));
    const backup = await exportAll();
    expect(backup.version).toBe(11);
    await restoreAll(backup);
    expect((await db.activities.get(a.id))?.bodyParts).toEqual([
      "Custom label",
    ]);
    expect(await recipeNotes.count()).toBe(1);
    const older = structuredClone(backup);
    older.version = 2;
    delete older.tables.goals;
    delete older.tables.recipeNotes;
    await restoreAll(older);
    expect(await goalTable.count()).toBe(0);
    expect(await db.activities.count()).toBe(1);
  });
});
