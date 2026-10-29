import {parseToleranceEvents} from './goal-tolerance-model';
import {reconcileIngredientTags} from "./ingredient-tag-data";
import { validConsumptionUnit, type ConsumptionUnit } from "./consumption-units";
import {newId} from "./ids";
import Dexie, { type Table } from "dexie";
import type {FoodBatch, StorageTransaction} from "./food-storage-model";
export const SCHEMA_VERSION = 7;
export interface RecordBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
}
export interface Ingredient extends RecordBase {
  name: string;
  nameZh: string;
  brand: string;
  basis: "100g" | "serving";
  servingGrams: number | null;
  /** Optional additive fields: absent means legacy 100 g / gram serving size. */
  tagIds?: string[];
  consumptionUnit?: ConsumptionUnit | null;
  referenceAmount?: number;
  referenceUnit?: "g" | "mL";
  servingUnit?: "g" | "mL";
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}
export interface Activity extends RecordBase {
  calorieSource?: 'automatic' | 'manual';
  exerciseEstimate?: import('./exercise-estimate').ExerciseEstimateSnapshot;
  type: "walking" | "swimming" | "badminton" | "other";
  date: string;
  duration: number | null;
  planOccurrenceId?: string | null;
  planGenerated?: boolean;
  planEdited?: boolean;
  distance: number | null;
  notes: string;
  name?: string;
  trainingTags?: string[];
  bodyParts?: string[];
  caloriesBurned?: number | null;
}
export interface PlannedExercise { trainingTags?: string[]; bodyParts?: string[]; estimatedCalories?: number | null; id: string; name: string; duration: number | null; distance: number | null; notes: string; }
export interface ExercisePlan extends RecordBase {
  name: string; notes: string; enabled: boolean;
  schedule: "daily" | "weekdays" | "custom" | "dates";
  days: number[]; dates: string[]; exercises: PlannedExercise[];
}
export interface ExerciseOccurrence extends RecordBase { planId: string; exerciseId: string; date: string; completed: boolean; activityId?: string | null; }
export interface Supplement extends RecordBase {
  name: string;
  dosage: number;
  unit: string;
  schedule: "daily" | "weekdays" | "custom";
  days?: number[];
}
export interface Check extends RecordBase {
  supplementId: string;
  date: string;
  status: "taken" | "skipped" | "unconfirmed";
}
export interface Setting {
  key: string;
  value: string;
}
// Reserved tables keep future features and media inside the same backup boundary.
export interface FutureRecord extends RecordBase {
  [key: string]: unknown;
}
export class LumiDB extends Dexie {
  ingredients!: Table<Ingredient>;
  activities!: Table<Activity>;
  supplements!: Table<Supplement>;
  checks!: Table<Check>;
  settings!: Table<Setting>;
  recipes!: Table<FutureRecord>;
  meals!: Table<FutureRecord>;
  images!: Table<FutureRecord>;
  foodBatches!: Table<FoodBatch>;
  inventoryTransactions!: Table<StorageTransaction>;
  constructor(name = "BetterLumi") {
    super(name);
    this.version(1).stores({
      ingredients: "id,name,nameZh,updatedAt,deletedAt",
      activities: "id,date,updatedAt,deletedAt",
      supplements: "id,updatedAt,deletedAt",
      checks: "id,[supplementId+date],date,updatedAt",
      settings: "key",
      recipes: "id,updatedAt,deletedAt",
      meals: "id,date,updatedAt,deletedAt",
      images: "id,updatedAt,deletedAt",
    });
    this.version(2).stores({
      recipeCards: "id,name,updatedAt,deletedAt",
      foodLogs: "id,date,updatedAt,deletedAt",
      plans: "id,date,kind,updatedAt,deletedAt",
      weights: "id,date,updatedAt,deletedAt",
    });
    // Additive only: existing tables, IDs, values and language choices stay intact.
    this.version(3)
      .stores({
        recipeNotes: "id,recipeId,updatedAt,deletedAt",
        goals: "id,startDate,endDate,updatedAt,deletedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("supplements")
          .toCollection()
          .modify((s) => {
            if (!Array.isArray(s.days))
              s.days =
                s.schedule === "weekdays"
                  ? [1, 2, 3, 4, 5]
                  : [1, 2, 3, 4, 5, 6, 0];
          });
        await tx
          .table("activities")
          .toCollection()
          .modify((a) => {
            if (!Array.isArray(a.trainingTags)) a.trainingTags = [];
            if (!Array.isArray(a.bodyParts)) a.bodyParts = [];
            if (a.caloriesBurned === undefined) a.caloriesBurned = null;
          });
        await tx
          .table("weights")
          .toCollection()
          .modify((w) => {
            if (w.notes === undefined) w.notes = "";
          });
      });
    this.version(4)
      .stores({ recipeCategories: "id,name,updatedAt,deletedAt" })
      .upgrade(async (tx) => {
        const seen = new Map<string, string>();
        const table = tx.table("recipeCategories");
        for (const recipe of await tx.table("recipeCards").toArray()) {
          const name =
            typeof recipe.category === "string" ? recipe.category.trim() : "";
          if (!name) continue;
          const key = name.toLocaleLowerCase();
          const id =
            seen.get(key) ?? "legacy-category:" + encodeURIComponent(key);
          if (!seen.has(key)) {
            await table.put({ ...stamp(), id, name });
            seen.set(key, id);
          }
          await tx
            .table("recipeCards")
            .update(recipe.id, {
              categoryIds: [...new Set([...(recipe.categoryIds ?? []), id])],
            });
        }
      });
    // Only add stores. Every existing row and image remains untouched.
    this.version(5).stores({
      exercisePlans: "id,updatedAt,deletedAt",
      exerciseOccurrences: "id,planId,date,[planId+date],updatedAt,deletedAt",
    });
    // Additive only: existing records remain untouched.
    this.version(6).stores({ingredientTags:"id,name,updatedAt,deletedAt"});
    // Food Storage is additive: no upgrade callback, reseeding or rewrites of existing rows.
    this.version(SCHEMA_VERSION).stores({
      foodBatches: "id,name,sourceRecipeId,preparedOn,updatedAt,deletedAt",
      inventoryTransactions: "id,*batchIds,mealId,targetBatchId,createdAt",
    });
  }
}
export const db = new LumiDB();
export const stamp = (): RecordBase => {
  const now = new Date().toISOString();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    revision: 1,
  };
};
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function nutritionReference(i: Ingredient) {
  return { amount: i.referenceAmount ?? 100, unit: i.referenceUnit ?? "g" } as const;
}
export function per100g(i: Ingredient) {
  const ref = nutritionReference(i);
  const amount = i.basis === "100g" ? ref.amount : i.servingGrams;
  const unit = i.basis === "100g" ? ref.unit : (i.servingUnit ?? "g");
  if (unit !== "g" || amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  const factor = 100 / amount;
  return {
    ...i,
    calories: i.calories === null ? null : i.calories * factor,
    protein: i.protein === null ? null : i.protein * factor,
    carbs: i.carbs === null ? null : i.carbs * factor,
    fat: i.fat === null ? null : i.fat * factor,
  };
}
export async function remove(table: Table<RecordBase>, row: RecordBase) {
  await table.update(row.id, {
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: row.revision + 1,
  });
}
export const tableNames = [
  "ingredients",
  "ingredientTags",
  "activities",
  "supplements",
  "checks",
  "settings",
  "recipes",
  "meals",
  "images",
] as const;
export async function makeBackup(database = db) {
  const tables: Record<string, unknown[]> = {};
  await database.transaction("r", database.tables, async () => {
    if (await database.foodBatches.count() || await database.inventoryTransactions.count()) throw Error("Food Storage requires the full exportAll backup");
    for (const name of tableNames)
      tables[name] = await database.table(name).toArray();
  });
  return {
    app: "BetterLumi",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string";
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const nullable = (v: unknown) => v === null || number(v);
export function validateBackup(
  value: unknown,
): asserts value is Awaited<ReturnType<typeof makeBackup>> {
  if (
    !obj(value) ||
    value.app !== "BetterLumi" ||
    value.version !== 1 ||
    !obj(value.tables)
  )
    throw Error("Invalid backup");
  for (const name of tableNames) {
    const rows = value.tables[name];
    if(name==="ingredientTags"&&rows===undefined)continue;
    if (!Array.isArray(rows)) throw Error("Missing table");
    const ids = new Set();
    for (const r of rows) {
      if (!obj(r)) throw Error("Invalid row");
      const id = name === "settings" ? r.key : r.id;
      if (!str(id) || !id || ids.has(id)) throw Error("Invalid ID");
      ids.add(id);
      if (name === "settings") {
        if (!str(r.value)) throw Error("Invalid setting");
        if(r.key==="goalTolerances")parseToleranceEvents(r.value as string);
        continue;
      }
      if (
        !str(r.createdAt) ||
        !str(r.updatedAt) ||
        !Number.isFinite(Date.parse(r.createdAt as string)) ||
        !Number.isFinite(Date.parse(r.updatedAt as string)) ||
        !(r.deletedAt === null || str(r.deletedAt)) ||
        !Number.isInteger(r.revision) ||
        Number(r.revision) < 1
      )
        throw Error("Invalid metadata");
      if (
        name === "ingredients" &&
        (!str(r.name) ||
          !r.name ||
          !str(r.nameZh) ||
          !str(r.brand) ||
          !["100g", "serving"].includes(String(r.basis)) ||
          !nullable(r.servingGrams) ||
          r.servingGrams === 0 ||
          !(r.consumptionUnit == null || validConsumptionUnit(r.consumptionUnit)) ||
          !(r.referenceAmount === undefined || (number(r.referenceAmount) && r.referenceAmount !== 0)) ||
          !(r.referenceUnit === undefined || ["g","mL"].includes(String(r.referenceUnit))) ||
          !(r.servingUnit === undefined || ["g","mL"].includes(String(r.servingUnit))) ||
          !["calories", "protein", "carbs", "fat"].every((k) => nullable(r[k])))
      )
        throw Error("Invalid ingredient");
      if (
        name === "activities" &&
        (!["walking", "swimming", "badminton", "other"].includes(
          String(r.type),
        ) ||
          !str(r.date) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
          !number(r.duration) ||
          r.duration === 0 ||
          !nullable(r.distance) ||
          !str(r.notes))
      )
        throw Error("Invalid activity");
      if (
        name === "supplements" &&
        (!str(r.name) ||
          !r.name ||
          !number(r.dosage) ||
          r.dosage === 0 ||
          !str(r.unit) ||
          !["daily", "weekdays"].includes(String(r.schedule)))
      )
        throw Error("Invalid supplement");
      if (
        name === "checks" &&
        (!str(r.supplementId) ||
          !str(r.date) ||
          !["taken", "skipped", "unconfirmed"].includes(String(r.status)) ||
          r.id !== `${r.supplementId}:${r.date}`)
      )
        throw Error("Invalid check");
    }
  }
  const supplements = new Set(
    (value.tables.supplements as Supplement[]).map((s) => s.id),
  );
  for (const c of value.tables.checks as Check[])
    if (!supplements.has(c.supplementId)) throw Error("Orphan check");
}
export async function restoreBackup(value: unknown, database = db) {
  const copy=structuredClone(value);
  validateBackup(copy);
  copy.tables.ingredientTags??=[];
  reconcileIngredientTags(copy.tables);
  await database.transaction("rw", database.tables, async () => {
    if (await database.foodBatches.count() || await database.inventoryTransactions.count()) throw Error("Food Storage requires the full restoreAll backup");
    for (const name of tableNames) {
      await database.table(name).clear();
      await database.table(name).bulkPut(copy.tables[name]);
    }
  });
}
