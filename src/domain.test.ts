import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, it, expect, afterEach } from "vitest";
import {
  db,
  stamp,
  recipes,
  foodLogs,
  plans,
  weights,
  ingredientNutrition,
  sumNutrition,
  scaleNutrition,
  toKg,
  displayWeight,
  exportAll,
  restoreAll,
  type PantryItem,
} from "./domain";
import { LumiDB } from "./db";
const ingredient = (): PantryItem => ({
  ...stamp(),
  name: "Example oats",
  nameZh: "示例燕麦",
  brand: "Example only",
  basis: "serving",
  servingGrams: 40,
  calories: 150,
  protein: 5,
  carbs: 27,
  fat: null,
  photo: "data:image/png;base64,AA==",
});
afterEach(async () => {
  for (const table of db.tables) await table.clear();
});
describe("Olive vertical slice", () => {
  it("preserves missing nutrition and refuses ambiguous unit conversion", () => {
    const i = ingredient();
    expect(ingredientNutrition(i, 80, "g")).toEqual({
      calories: 300,
      protein: 10,
      carbs: 54,
      fat: null,
    });
    expect(
      ingredientNutrition({ ...i, servingGrams: null }, 80, "g").calories,
    ).toBeNull();
    expect(
      ingredientNutrition({ ...i, servingGrams: null }, 2, "serving").calories,
    ).toBe(300);
    expect(
      sumNutrition([
        ingredientNutrition(i, 1, "serving"),
        { calories: 10, protein: null, carbs: 1, fat: 1 },
      ]).protein,
    ).toBeNull();
  });
  it("keeps recipe changes and cooking notes isolated to a food log snapshot", async () => {
    const i = ingredient();
    await db.ingredients.put(i);
    const line = {
      ingredientId: i.id,
      name: i.name,
      quantity: 40,
      unit: "g" as const,
      nutrition: ingredientNutrition(i, 40, "g"),
    };
    const recipe = {
      ...stamp(),
      name: "Example bowl",
      servings: 2,
      lines: [line],
      instructions: "Mix",
      stickyNote: "Original note",
    };
    await recipes.put(recipe);
    const oneTime = structuredClone(recipe.lines);
    oneTime[0].quantity = 80;
    oneTime[0].nutrition = scaleNutrition(line.nutrition, 2);
    await foodLogs.put({
      ...stamp(),
      date: "2026-10-17",
      category: "breakfast",
      name: recipe.name,
      source: "recipe",
      sourceId: recipe.id,
      quantity: 1,
      unit: "serving",
      nutrition: sumNutrition(oneTime.map((l) => l.nutrition)),
      lines: oneTime,
      cookingNote: "Only this cooking session",
    });
    expect((await recipes.get(recipe.id))?.lines[0].quantity).toBe(40);
    expect((await recipes.get(recipe.id))?.stickyNote).toBe("Original note");
    expect((await foodLogs.toArray())[0].nutrition.calories).toBe(300);
  });
  it("stores plans separately, converts weight units without changing kg, and backs up photos", async () => {
    const i = ingredient();
    await db.ingredients.put(i);
    await plans.put({
      ...stamp(),
      date: "2026-11-01",
      kind: "meal",
      title: "Example plan",
      notes: "",
    });
    expect(await foodLogs.count()).toBe(0);
    const w = { ...stamp(), date: "2026-10-17", kg: toKg(154.323583526, "lb") };
    await weights.put(w);
    expect(w.kg).toBeCloseTo(70, 6);
    expect(displayWeight(w.kg, "lb")).toBeCloseTo(154.32358, 4);
    const backup = await exportAll();
    expect(Object.keys(backup.tables)).toHaveLength(18);
    await db.ingredients.clear();
    await restoreAll(JSON.parse(JSON.stringify(backup)));
    expect(((await db.ingredients.get(i.id)) as PantryItem)?.photo).toBe(
      i.photo,
    );
    expect((await weights.get(w.id))?.kg).toBe(w.kg);
    expect(await plans.count()).toBe(1);
  });
  it("rejects malformed v2 backups without clearing existing records", async () => {
    const i = ingredient();
    await db.ingredients.put(i);
    const data = await exportAll();
    data.tables.weights = [{ ...stamp(), date: "2026-10-17", kg: -1 }];
    await expect(restoreAll(data)).rejects.toThrow("Invalid weight");
    expect(await db.ingredients.get(i.id)).toBeDefined();
  });
  it("upgrades version 1 in place without losing ingredient records", async () => {
    const name = "migration-" + crypto.randomUUID();
    const old = new Dexie(name);
    old.version(1).stores({
      ingredients: "id,name,nameZh,updatedAt,deletedAt",
      activities: "id,date,updatedAt,deletedAt",
      supplements: "id,updatedAt,deletedAt",
      checks: "id,[supplementId+date],date,updatedAt",
      settings: "key",
      recipes: "id,updatedAt,deletedAt",
      meals: "id,date,updatedAt,deletedAt",
      images: "id,updatedAt,deletedAt",
    });
    const i = ingredient();
    await old.table("ingredients").put(i);
    old.close();
    const updated = new LumiDB(name);
    await updated.open();
    expect(await updated.ingredients.get(i.id)).toEqual(i);
    expect(updated.tables.map((t) => t.name)).toContain("weights");
    await updated.delete();
  });
});
