import {storageTables, validateStorageBackup, type StorageConsumption} from "./food-storage-model";
export const BACKUP_VERSION = 10;
import {validMeasuredAt} from './weight-time';
import {normalizeIngredientNutrition} from './ingredient-nutrition';
import {parseToleranceEvents} from './goal-tolerance-model';
import {reconcileIngredientTags} from "./ingredient-tag-data";
import {validConsumptionUnit} from "./consumption-units";
import {validGoalConfig} from "./goal-model";
import type { Table } from "dexie";
import { validLocalDate } from "./routing";
import { validExercisePlan, validExerciseOccurrence } from "./exercise-schedule";
import { db, stamp, type RecordBase, type Ingredient, localDate } from "./db";
export { db, stamp, localDate };
import { nutritionReference } from "./db";
export type PantryItem = Ingredient & {
  photo?: string;
  labelPhoto?: string;
  aliases?: string[];
  nutritionSource?: "manual" | "package-label-ocr";
  labelRecognition?: {
    text: string;
    confidence: number;
    language: string;
    reviewedAt: string;
    appliedFields?: Nutrient[];
  };
};
export type Nutrient = "calories" | "protein" | "carbs" | "fat";
export const nutrientKeys: Nutrient[] = ["calories", "protein", "carbs", "fat"];
export type Nutrition = Record<Nutrient, number | null>;
export const unknownNutrition = (): Nutrition => ({
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
});
export interface RecipeLine {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  nutrition: Nutrition;
}
export interface Recipe extends RecordBase {
  name: string;
  servings: number;
  lines: RecipeLine[];
  instructions: string;
  stickyNote: string;
  photo?: string;
  category?: string;
  categoryIds?: string[];
}
export interface FoodLog extends RecordBase {
  photo?: string;
  date: string;
  category: string;
  name: string;
  source: "quick" | "recipe" | "pantry";
  sourceId: string | null;
  quantity: number;
  unit: string;
  nutrition: Nutrition;
  lines: RecipeLine[];
  cookingNote: string;
  estimated?: boolean;
  consumptionPercent?: number;
  baseNutrition?: Nutrition;
  /** Inventory consumption and initial-leftover linkage deliberately have different semantics. */
  storageConsumption?: StorageConsumption;
  leftoverBatchId?: string;
  /** Explicit origin-meal correction that deliberately leaves downstream stock untouched. */
  leftoverInventoryUnchanged?: true;
}
export interface Plan extends RecordBase {
  completed?: boolean;
  date: string;
  kind: "meal" | "activity" | "supplement";
  title: string;
  notes: string;
}
export interface Weight extends RecordBase {
  date: string;
  /** UTC/offset measurement instant; absent only on legacy date-only records. */
  measuredAt?: string;
  kg: number;
  notes?: string;
}
export const recipes = db.table<Recipe>("recipeCards");
export const foodLogs = db.table<FoodLog>("foodLogs");
export const plans = db.table<Plan>("plans");
export const weights = db.table<Weight>("weights");
export function ingredientNutrition(
  i: PantryItem,
  quantity: number,
  unit: string,
): Nutrition {
  const nutrition=normalizeIngredientNutrition(i);
  const conversion = i.consumptionUnit;
  if (validConsumptionUnit(conversion) && unit === conversion.name) {
    quantity = quantity * conversion.amount / conversion.quantity;
    unit = conversion.unit;
  }
  const ref = nutritionReference(i);
  const base = i.basis === "100g" ? ref.amount : i.servingGrams;
  const baseUnit = i.basis === "100g" ? ref.unit : (i.servingUnit ?? "g");
  let factor: number | null = null;
  if (Number.isFinite(quantity) && quantity >= 0) {
    if (unit === "serving" && i.basis === "serving") factor = quantity;
    else if (base != null && Number.isFinite(base) && base > 0) {
      if (unit === baseUnit) factor = quantity / base;
      else if (unit === "serving" && (i.servingUnit ?? "g") === baseUnit && i.servingGrams != null && i.servingGrams > 0) factor = quantity * i.servingGrams / base;
    }
  }
  return Object.fromEntries(
    nutrientKeys.map((k) => [
      k,
      factor === null || nutrition[k] === null ? null : nutrition[k] * factor,
    ]),
  ) as Nutrition;
}
export function sumNutrition(values: Nutrition[]): Nutrition {
  return Object.fromEntries(
    nutrientKeys.map((k) => [
      k,
      !values.length || values.some((v) => v[k] === null)
        ? null
        : values.reduce((s, v) => s + (v[k] ?? 0), 0),
    ]),
  ) as Nutrition;
}
export function scaleNutrition(value: Nutrition, factor: number): Nutrition {
  return Object.fromEntries(
    nutrientKeys.map((k) => [k, value[k] === null ? null : value[k] * factor]),
  ) as Nutrition;
}
export const toKg = (n: number, unit: string) =>
  unit === "lb" ? n / 2.2046226218 : n;
export const displayWeight = (kg: number, unit: string) =>
  unit === "lb" ? kg * 2.2046226218 : kg;
export const round = (n: number | null) =>
  n === null ? "—" : Number(n.toFixed(1)).toString();
export async function softDelete<T extends RecordBase>(
  table: Table<T>,
  id: string,
) {
  const row = await table.get(id);
  if (row && table.name === 'foodLogs' && ('storageConsumption' in row || 'leftoverBatchId' in row)) {
    if (row.deletedAt) return;
    const {FoodStorage} = await import('./food-storage');
    await new FoodStorage(table.db as typeof db).deleteMeal({operationId: 'delete-storage-meal:' + row.id + ':' + row.revision, mealId: row.id, expectedRevision: row.revision});
    return;
  }
  if (row)
    await table.put({
      ...row,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: row.revision + 1,
    });
}
export async function exportAll() {
  const tables: Record<string, unknown[]> = {};
  await db.transaction("r", db.tables, async () => {
    for (const table of db.tables) tables[table.name] = await table.toArray();
  });
  return {
    app: "BetterLumi",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}
export async function restoreAll(data: unknown) {
  const x = structuredClone(data) as any;
  if (
    x?.app !== "BetterLumi" ||
    ![2, 3, 4, 5, 6, 7, 8, 9, BACKUP_VERSION].includes(x.version) ||
    !x.tables ||
    typeof x.tables !== "object"
  )
    throw Error("Invalid backup");
  if(x.version<10) {
    if (storageTables.some(name => x.tables[name] !== undefined && (!Array.isArray(x.tables[name]) || x.tables[name].length > 0)) ||
        Array.isArray(x.tables.foodLogs) && x.tables.foodLogs.some((m:any) => m?.storageConsumption !== undefined || m?.leftoverBatchId !== undefined || m?.leftoverInventoryUnchanged !== undefined)) throw Error('Food Storage requires backup version 10');
    for (const name of storageTables) x.tables[name] = [];
  }
  if(x.version<8&&Array.isArray(x.tables.goals)&&x.tables.goals.some((goal:any)=>goal.scope!==undefined))throw Error('Scoped goals require backup version 8');
  if(x.version<9&&Array.isArray(x.tables.goals)&&x.tables.goals.some((goal:any)=>goal.scope==='exercise'))throw Error('Exercise scoped goals require backup version 9');
  if (x.version === 2) {
    x.tables.recipeNotes ??= [];
    x.tables.goals ??= [];
  }
  if (x.version < 4) x.tables.recipeCategories ??= [];
  if (x.version < 5) { x.tables.exercisePlans ??= []; x.tables.exerciseOccurrences ??= []; }
  if(x.version<6)x.tables.ingredientTags??=[];
  for (const table of db.tables) {
    const rows = x.tables[table.name];
    if (!Array.isArray(rows)) throw Error("Missing table");
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row !== "object") throw Error("Invalid row");
      const id = table.name === "settings" ? row.key : row.id;
      if (typeof id !== "string" || !id || ids.has(id))
        throw Error("Invalid ID");
      ids.add(id);
      if (table.name === "settings") {
        if (typeof row.value !== "string") throw Error("Invalid preference");
        if(row.key==="goalTolerances")parseToleranceEvents(row.value);
        continue;
      }
      if (
        typeof row.createdAt !== "string" ||
        typeof row.updatedAt !== "string" ||
        !Number.isInteger(row.revision) ||
        row.revision < 1 ||
        !(row.deletedAt === null || typeof row.deletedAt === "string")
      )
        throw Error("Invalid metadata");
      if (
        ["foodLogs", "plans", "weights", "activities", "checks", "exerciseOccurrences"].includes(
          table.name,
        ) &&
        !validLocalDate(row.date)
      )
        throw Error("Invalid date");
      if (table.name === "exercisePlans" && !validExercisePlan(row)) throw Error("Invalid exercise plan");
      if (table.name === "exerciseOccurrences" && !validExerciseOccurrence(row)) throw Error("Invalid exercise occurrence");
      if (table.name === "weights" && (!Number.isFinite(row.kg) || row.kg <= 0 || row.measuredAt!==undefined&&!validMeasuredAt(row.measuredAt)))
        throw Error("Invalid weight");
      if (
        table.name === "plans" &&
        (!["meal", "activity", "supplement"].includes(row.kind) ||
          typeof row.title !== "string" ||
          typeof row.notes !== "string")
      )
        throw Error("Invalid plan");
      if (
        table.name === "recipeCategories" &&
        (typeof row.name !== "string" || !row.name.trim())
      )
        throw Error("Invalid category");
      if (
        table.name === "recipeCards" &&
        row.categoryIds !== undefined &&
        (!Array.isArray(row.categoryIds) ||
          row.categoryIds.some((id: unknown) => typeof id !== "string"))
      )
        throw Error("Invalid category assignments");
      if (
        table.name === "recipeCards" &&
        (!row.name ||
          (row.servings !== undefined && (!Number.isFinite(row.servings) || row.servings <= 0)) ||
          !validLines(row.lines) ||
          typeof row.stickyNote !== "string" ||
          typeof row.instructions !== "string")
      )
        throw Error("Invalid recipe");
      if (
        table.name === "images" &&
        row.kind === "cover" &&
        (typeof row.original !== "string" ||
          !row.original.startsWith("data:image/") ||
          typeof row.name !== "string" ||
          !Number.isFinite(row.width) ||
          row.width <= 0 ||
          !Number.isFinite(row.height) ||
          row.height <= 0 ||
          !row.crop ||
          !Number.isFinite(row.crop.zoom) ||
          row.crop.zoom < 1 ||
          row.crop.zoom > 6 ||
          !Number.isFinite(row.crop.x) ||
          row.crop.x < 0 ||
          row.crop.x > 1 ||
          !Number.isFinite(row.crop.y) ||
          row.crop.y < 0 ||
          row.crop.y > 1)
      )
        throw Error("Invalid cover image");
      if (
        table.name === "foodLogs" &&
        row.photo !== undefined &&
        typeof row.photo !== "string"
      )
        throw Error("Invalid meal photo");
      if (
        table.name === "foodLogs" &&
        (typeof row.name !== "string" ||
          !["quick", "recipe", "pantry"].includes(row.source) ||
          !["uncategorized", "breakfast", "lunch", "dinner", "snack"].includes(
            row.category,
          ) ||
          !validNutrition(row.nutrition) ||
          !validLines(row.lines) ||
          !Number.isFinite(row.quantity) ||
          row.quantity <= 0 ||
          typeof row.cookingNote !== "string")
      )
        throw Error("Invalid meal");
      if (
        table.name === "foodLogs" &&
        (!(
          row.consumptionPercent === undefined ||
          (typeof row.consumptionPercent === "number" &&
            Number.isFinite(row.consumptionPercent) &&
            row.consumptionPercent >= 0)
        ) ||
          !(
            row.baseNutrition === undefined || validNutrition(row.baseNutrition)
          ))
      )
        throw Error("Invalid consumption");
      if (
        table.name === "ingredients" &&
        (!row.name ||
          !["100g", "serving"].includes(row.basis) ||
          !(row.referenceAmount === undefined || (Number.isFinite(row.referenceAmount) && row.referenceAmount > 0)) ||
          !(row.referenceUnit === undefined || ["g", "mL"].includes(row.referenceUnit)) ||
          !(row.servingUnit === undefined || ["g", "mL"].includes(row.servingUnit)) ||
          !(row.consumptionUnit == null || validConsumptionUnit(row.consumptionUnit)) ||
          !validNutrition(row) ||
          !(
            row.servingGrams === null ||
            (Number.isFinite(row.servingGrams) && row.servingGrams > 0)
          ) ||
          !["nameZh", "brand"].every((k) => typeof row[k] === "string") ||
          !["photo", "labelPhoto"].every(
            (k) =>
              row[k] === undefined ||
              row[k] === "" ||
              (typeof row[k] === "string" &&
                /^data:image\/(png|jpeg|webp);base64,/.test(row[k])),
          ))
      )
        throw Error("Invalid ingredient");
      if (
        table.name === "ingredients" &&
        (!(
          row.aliases === undefined ||
          (Array.isArray(row.aliases) &&
            row.aliases.every((s: unknown) => typeof s === "string"))
        ) ||
          !(
            row.nutritionSource === undefined ||
            ["manual", "package-label-ocr"].includes(row.nutritionSource)
          ) ||
          !(
            row.labelRecognition === undefined ||
            (typeof row.labelRecognition.text === "string" &&
              Number.isFinite(row.labelRecognition.confidence) &&
              row.labelRecognition.confidence >= 0 &&
              row.labelRecognition.confidence <= 100 &&
              typeof row.labelRecognition.language === "string" &&
              typeof row.labelRecognition.reviewedAt === "string")
          ))
      )
        throw Error("Invalid ingredient metadata");
      if (
        table.name === "activities" &&
        (!["walking", "swimming", "badminton", "other"].includes(row.type) ||
          !(row.duration===null||(Number.isFinite(row.duration)&&row.duration>=0)) ||
          !(
            row.distance === null ||
            (Number.isFinite(row.distance) && row.distance >= 0)
          ) ||
          typeof row.notes !== "string")
      )
        throw Error("Invalid activity");
      if (
        table.name === "supplements" &&
        (!row.name ||
          !Number.isFinite(row.dosage) ||
          row.dosage <= 0 ||
          typeof row.unit !== "string" ||
          !["daily", "weekdays", "custom"].includes(row.schedule) ||
          (row.schedule === "custom" &&
            (!Array.isArray(row.days) ||
              !row.days.length ||
              !row.days.every(
                (d: unknown) =>
                  Number.isInteger(d) && Number(d) >= 0 && Number(d) <= 6,
              ))))
      )
        throw Error("Invalid supplement");
      if (
        table.name === "checks" &&
        (!["taken", "skipped", "unconfirmed"].includes(row.status) ||
          typeof row.supplementId !== "string" ||
          row.id !== `${row.supplementId}:${row.date}`)
      )
        throw Error("Invalid checklist");
      if (
        table.name === "recipeNotes" &&
        (typeof row.recipeId !== "string" || typeof row.text !== "string" ||
          row.origin !== undefined && !["recipe", "meal"].includes(row.origin) ||
          row.mealId !== undefined && (typeof row.mealId !== "string" || !row.mealId.trim()) ||
          row.mealDate !== undefined && !validLocalDate(row.mealDate))
      )
        throw Error("Invalid recipe note");
      if (
        table.name === "goals" &&
        (!validLocalDate(row.startDate) ||
          !(
            row.endDate === null ||
            (validLocalDate(row.endDate) && row.endDate >= row.startDate)
          ) ||
          ![
            "calorieMin",
            "calorieMax",
            "exerciseMinutes",
            "exerciseKcal",
          ].every(
            (k) =>
              row[k] === null ||
              (typeof row[k] === "number" &&
                Number.isFinite(row[k]) &&
                row[k] >= 0),
          ) ||
          (row.calorieMin !== null &&
            row.calorieMax !== null &&
            row.calorieMin > row.calorieMax))
      )
        throw Error("Invalid goal");
      if(table.name==="goals"){
        if(!validGoalConfig(row))throw Error("Invalid goal configuration");

      }
      if(table.name==="activities"&&(!(row.planOccurrenceId==null||typeof row.planOccurrenceId==="string")||![row.planGenerated,row.planEdited].every(v=>v===undefined||typeof v==="boolean")))throw Error("Invalid activity association");
      if (
        table.name === "activities" &&
        (!(
          row.caloriesBurned == null ||
          (typeof row.caloriesBurned === "number" &&
            Number.isFinite(row.caloriesBurned) &&
            row.caloriesBurned >= 0)
        ) ||
          ![row.trainingTags ?? [], row.bodyParts ?? []].every(
            (v) => Array.isArray(v) && v.every((k) => typeof k === "string"),
          ) ||
          !(row.name === undefined || typeof row.name === "string"))
      )
        throw Error("Invalid activity fields");
      if (
        table.name === "weights" &&
        !(row.notes === undefined || typeof row.notes === "string")
      )
        throw Error("Invalid weight notes");
    }
  }
  validateStorageBackup(x.tables);
  reconcileIngredientTags(x.tables);
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      await table.bulkPut(x.tables[table.name]);
    }
  });
}
function validNutrition(n: any) {
  return (
    n &&
    nutrientKeys.every(
      (k) =>
        n[k] === null ||
        (typeof n[k] === "number" && Number.isFinite(n[k]) && n[k] >= 0),
    )
  );
}
function validLines(lines: any) {
  return (
    Array.isArray(lines) &&
    lines.every(
      (l) =>
        typeof l.ingredientId === "string" &&
        typeof l.name === "string" &&
        Number.isFinite(l.quantity) &&
        l.quantity > 0 &&
        typeof l.unit === "string" && l.unit.trim().length > 0 && l.unit.length <= 40 &&
        validNutrition(l.nutrition),
    )
  );
}
