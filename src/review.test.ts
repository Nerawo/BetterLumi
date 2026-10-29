import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, it, expect } from "vitest";
import { db, stamp, recipes, exportAll, restoreAll } from "./domain";
import { LumiDB } from "./db";
import {
  categories,
  saveCategory,
  deleteCategory,
  filterRecipes,
} from "./categories";
afterEach(async () => {
  for (const table of db.tables) await table.clear();
});
it("categories persist and filter together with search; deletion only removes assignments", async () => {
  await saveCategory("早餐");
  await saveCategory("Quick");
  const [a, b] = await categories.toArray();
  await expect(saveCategory(a.name.toUpperCase())).rejects.toThrow("Duplicate");
  const r = {
    ...stamp(),
    name: "Oat bowl",
    servings: 1,
    lines: [],
    instructions: "Mix",
    stickyNote: "Keep",
    photo: "data:image/png;base64,AA==",
    categoryIds: [a.id, b.id],
  };
  await recipes.put(r);
  expect(filterRecipes([r], "oat", a.id)).toHaveLength(1);
  expect(filterRecipes([r], "soup", a.id)).toHaveLength(0);
  await saveCategory("Renamed", a);
  expect((await categories.get(a.id))?.name).toBe("Renamed");
  const backup = await exportAll();
  await restoreAll(backup);
  expect((await recipes.get(r.id))?.categoryIds).toEqual([a.id, b.id]);
  await deleteCategory(a);
  expect(await recipes.get(r.id)).toEqual({
    ...r,
    categoryIds: [b.id],
    revision: 2,
    updatedAt: expect.any(String),
  });
  expect((await categories.get(a.id))?.deletedAt).toBeTruthy();
});
it("v3 upgrades every table in place and maps legacy category labels without losing photos or notes", async () => {
  await db.open();
  const name = "v3-preserve-" + crypto.randomUUID();
  const old = new Dexie(name);
  // Exact cumulative v1-v3 schema from db.ts; never infer historical stores
  // from the current database, which also contains later feature stores.
  old.version(3).stores({
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
    recipeNotes: "id,recipeId,updatedAt,deletedAt",
    goals: "id,startDate,endDate,updatedAt,deletedAt",
  });
  const rows = new Map();
  for (const t of old.tables) {
    const row =
      t.name === "settings"
        ? { key: "language", value: "en" }
        : {
            ...stamp(),
            name: "Preserved",
            photo: "data:image/png;base64,KEEP",
            notes: "Keep note",
            ...(t.name === "recipeCards" ? { category: "Breakfast" } : {}),
          };
    rows.set(t.name, row);
    await t.put(row);
  }
  old.close();
  const upgraded = new LumiDB(name);
  await upgraded.open();
  try {
    for (const [table, row] of rows) {
      const actual = await upgraded.table(table).get(row.id ?? row.key);
      if (table === "recipeCards") {
        expect(actual).toMatchObject(row);
        expect(actual.categoryIds).toEqual(["legacy-category:breakfast"]);
      } else expect(actual).toEqual(row);
    }
    expect(await upgraded.table("recipeCategories").count()).toBe(1);
    expect(upgraded.verno).toBe(7);
    for (const table of ["exercisePlans", "exerciseOccurrences", "ingredientTags", "foodBatches", "inventoryTransactions"]) {
      expect(await upgraded.table(table).count(), table).toBe(0);
    }
  } finally {
    await upgraded.delete();
  }
});
it("v3 backups restore with an empty category store and retain legacy fields", async () => {
  const backup = await exportAll();
  backup.version = 3;
  delete backup.tables.recipeCategories;
  await restoreAll(backup);
  expect(await categories.count()).toBe(0);
});
