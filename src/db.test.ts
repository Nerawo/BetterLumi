import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  LumiDB,
  stamp,
  makeBackup,
  restoreBackup,
  per100g,
  type Ingredient,
} from "./db";
const ingredient = (): Ingredient => ({
  ...stamp(),
  name: "Label product",
  nameZh: "",
  brand: "",
  basis: "serving",
  servingGrams: 40,
  calories: 120,
  protein: null,
  carbs: 20,
  fat: 3,
});
describe("nutrition and durable storage", () => {
  it("normalizes known weights while preserving unknown nutrition", () => {
    const i = ingredient();
    expect(per100g(i)?.calories).toBe(300);
    expect(per100g(i)?.protein).toBeNull();
    expect(per100g({ ...i, servingGrams: null })).toBeNull();
  });
  it("persists after reopening and round trips all tables", async () => {
    const name = crypto.randomUUID();
    let source = new LumiDB(name);
    const item = ingredient();
    await source.ingredients.put(item);
    source.close();
    source = new LumiDB(name);
    expect(await source.ingredients.get(item.id)).toEqual(item);
    const backup = await makeBackup(source);
    const target = new LumiDB(crypto.randomUUID());
    await restoreBackup(backup, target);
    expect(await target.ingredients.get(item.id)).toEqual(item);
    expect(Object.keys(backup.tables)).toHaveLength(9);
    await source.delete();
    await target.delete();
  });
  it("rejects malformed restore before modifying existing records", async () => {
    const db = new LumiDB(crypto.randomUUID());
    const item = ingredient();
    await db.ingredients.put(item);
    const backup = await makeBackup(db);
    backup.tables.ingredients = [{ ...item, protein: -5 }];
    await expect(restoreBackup(backup, db)).rejects.toThrow();
    expect(await db.ingredients.get(item.id)).toEqual(item);
    await db.delete();
  });
  it("keeps skipped and unconfirmed separate", async () => {
    const db = new LumiDB(crypto.randomUUID());
    const profile = {
      ...stamp(),
      name: "Example",
      dosage: 1,
      unit: "tablet",
      schedule: "daily" as const,
    };
    await db.supplements.put(profile);
    await db.checks.put({
      ...stamp(),
      id: `${profile.id}:2026-10-17`,
      supplementId: profile.id,
      date: "2026-10-17",
      status: "skipped",
    });
    expect(await db.checks.where("date").equals("2026-10-18").count()).toBe(0);
    const restored = new LumiDB(crypto.randomUUID());
    await restoreBackup(await makeBackup(db), restored);
    expect((await restored.checks.toArray())[0].status).toBe("skipped");
    await db.delete();
    await restored.delete();
  });
});
