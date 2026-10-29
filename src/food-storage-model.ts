import type {RecordBase} from './db';
import type {FoodLog, Nutrition, RecipeLine} from './domain';

export type InventoryMode = 'weight' | 'ratio';
export type ArchiveReason = 'exhausted' | 'manual' | 'discarded' | 'canceled' | null;
export interface BatchIngredient extends RecipeLine {
  source: 'pantry' | 'batch';
  sourceBatchId?: string;
  /** Fraction of the source batch's ORIGINAL nutrition, not its current remainder. */
  sourceFraction?: number;
}
export interface FoodBatch extends RecordBase {
  name: string;
  sourceRecipeId: string | null;
  preparedOn: string;
  notes: string;
  ingredients: BatchIngredient[];
  totalNutrition: Nutrition;
  originalCookedYield: number | null;
  mode: InventoryMode;
  remainingQuantity: number;
  /** Frozen-composition fraction represented by one current inventory unit. */
  fractionPerUnit: number;
  everUsed: boolean;
  archived: boolean;
  archiveReason: ArchiveReason;
  originMealId: string | null;
  initialConsumedFraction: number;
}
export interface StorageConsumption {
  batchId: string;
  originalFraction: number;
  transactionId: string;
}
export interface InventoryMovement {
  batchId: string;
  mode: InventoryMode;
  before: number;
  after: number;
  fractionPerUnit: number;
  /** Signed change in original-batch nutrition fraction. */
  fractionDelta: number;
}
export type StorageTransactionKind = 'create' | 'leftovers' | 'meal' | 'delete-meal' | 'correct-formula' | 'adjust' | 'convert' | 'archive' | 'restore' | 'discard' | 'metadata' | 'edit-origin' | 'cancel-batch';
export interface StorageTransaction extends RecordBase {
  kind: StorageTransactionKind;
  /** Canonical request fingerprint detects accidental reuse of an operation ID. */
  request: string;
  batchIds: string[];
  mealId: string | null;
  targetBatchId: string | null;
  movements: InventoryMovement[];
  reason: string;
}
export class FoodStorageError extends Error {
  constructor(public code: 'INVALID' | 'NOT_FOUND' | 'OVERDRAW' | 'ARCHIVED' | 'LOCKED' | 'CONFLICT', message: string, public batchId?: string) {
    super(message); this.name = 'FoodStorageError';
  }
}
export const storageTables = ['foodBatches', 'inventoryTransactions'] as const;
export const nutritionFields = ['calories', 'protein', 'carbs', 'fat'] as const;
export const finiteNonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export const positive = (n: unknown): n is number => finiteNonnegative(n) && n > 0;
const text = (v: unknown): v is string => typeof v === 'string';
const id = (v: unknown): v is string => text(v) && !!v.trim();
const date = (v: unknown): v is string => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
export function validStorageNutrition(v: unknown): v is Nutrition {
  return !!v && typeof v === 'object' && nutritionFields.every(k => (v as Nutrition)[k] === null || finiteNonnegative((v as Nutrition)[k]));
}
export const storageClose = (a: number, b: number) => Math.abs(a - b) <= Number.EPSILON * 32 * Math.max(1, Math.abs(a), Math.abs(b));
export function storageNutritionEqual(a: Nutrition, b: Nutrition) {
  return nutritionFields.every(k => a[k] === null || b[k] === null ? a[k] === b[k] : storageClose(a[k]!, b[k]!));
}
function record(v: RecordBase) {
  return id(v.id) && text(v.createdAt) && Number.isFinite(Date.parse(v.createdAt)) && text(v.updatedAt) && Number.isFinite(Date.parse(v.updatedAt)) && v.deletedAt === null && Number.isInteger(v.revision) && v.revision >= 1;
}
export function validBatchIngredient(v: unknown): v is BatchIngredient {
  const l = v as BatchIngredient;
  return !!l && id(l.ingredientId) && text(l.name) && positive(l.quantity) && id(l.unit) && l.unit.length <= 40 && validStorageNutrition(l.nutrition) &&
    (l.source === 'pantry' ? l.sourceBatchId === undefined && l.sourceFraction === undefined : l.source === 'batch' && id(l.sourceBatchId) && l.ingredientId === l.sourceBatchId && positive(l.sourceFraction));
}
export function validFoodBatch(v: unknown): v is FoodBatch {
  const b = v as FoodBatch;
  return !!b && record(b) && id(b.name) && (b.sourceRecipeId === null || id(b.sourceRecipeId)) && date(b.preparedOn) && text(b.notes) && Array.isArray(b.ingredients) && b.ingredients.length > 0 && b.ingredients.every(validBatchIngredient) &&
    validStorageNutrition(b.totalNutrition) && (b.originalCookedYield === null || positive(b.originalCookedYield)) && ['weight', 'ratio'].includes(b.mode) &&
    (b.mode !== 'ratio' || b.originalCookedYield === null && b.fractionPerUnit === 1) && finiteNonnegative(b.remainingQuantity) && positive(b.fractionPerUnit) &&
    typeof b.everUsed === 'boolean' && typeof b.archived === 'boolean' && [null, 'exhausted', 'manual', 'discarded', 'canceled'].includes(b.archiveReason) && b.archived === (b.archiveReason !== null) && (b.remainingQuantity !== 0 || b.archived) && (b.archiveReason !== 'canceled' || b.remainingQuantity === 0) &&
    (b.archiveReason !== 'exhausted' || b.remainingQuantity === 0) && (b.originMealId === null || id(b.originMealId) && b.everUsed) && finiteNonnegative(b.initialConsumedFraction) && b.initialConsumedFraction <= 1 &&
    Number.isFinite(b.remainingQuantity * b.fractionPerUnit) && nutritionFields.every(k => b.totalNutrition[k] === null || Number.isFinite(b.totalNutrition[k]! * b.remainingQuantity * b.fractionPerUnit));
}
export function validStorageConsumption(v: unknown): v is StorageConsumption {
  const c = v as StorageConsumption;
  return !!c && id(c.batchId) && positive(c.originalFraction) && id(c.transactionId);
}
export function validStorageTransaction(v: unknown): v is StorageTransaction {
  const t = v as StorageTransaction;
  return !!t && record(t) && ['create', 'leftovers', 'meal', 'delete-meal', 'correct-formula', 'adjust', 'convert', 'archive', 'restore', 'discard', 'metadata', 'edit-origin', 'cancel-batch'].includes(t.kind) && id(t.request) &&
    Array.isArray(t.batchIds) && t.batchIds.every(id) && new Set(t.batchIds).size === t.batchIds.length && (t.mealId === null || id(t.mealId)) && (t.targetBatchId === null || id(t.targetBatchId)) && text(t.reason) &&
    Array.isArray(t.movements) && t.movements.every(m => !!m && id(m.batchId) && t.batchIds.includes(m.batchId) && ['weight', 'ratio'].includes(m.mode) && finiteNonnegative(m.before) && finiteNonnegative(m.after) && positive(m.fractionPerUnit) && typeof m.fractionDelta === 'number' && Number.isFinite(m.fractionDelta) && storageClose(m.fractionDelta, (m.after - m.before) * m.fractionPerUnit));
}
/** Validate links before ANY restore writes; historical/tombstoned rows are retained. */
export function validateStorageBackup(tables: Record<string, unknown[]>) {
  const batches = tables.foodBatches as FoodBatch[];
  const transactions = tables.inventoryTransactions as StorageTransaction[];
  if (!Array.isArray(batches) || !Array.isArray(transactions) || !batches.every(validFoodBatch) || !transactions.every(validStorageTransaction)) throw new FoodStorageError('INVALID', 'Invalid Food Storage backup');
  const byId = new Map(batches.map(b => [b.id, b]));
  const txById = new Map(transactions.map(t => [t.id, t]));
  const meals = new Map((tables.foodLogs as FoodLog[]).map(m => [m.id, m]));
  for (const b of batches) {
    const sum = Object.fromEntries(nutritionFields.map(k => [k, b.ingredients.some(l => l.nutrition[k] === null) ? null : b.ingredients.reduce((sum, l) => sum + l.nutrition[k]!, 0)])) as Nutrition;
    if (!validStorageNutrition(sum) || !storageNutritionEqual(sum, b.totalNutrition)) throw new FoodStorageError('INVALID', 'Batch composition does not match frozen ingredient snapshots');
    const creation = transactions.filter(t => t.targetBatchId === b.id && (t.kind === 'create' || t.kind === 'leftovers'));
    if (creation.length !== 1) throw new FoodStorageError('INVALID', 'Missing or duplicate batch creation history');
    for (const l of b.ingredients) if (l.source === 'batch') {
      const source = byId.get(l.sourceBatchId!);
      if (!source || source.id === b.id || !source.everUsed || !storageNutritionEqual(l.nutrition, Object.fromEntries(nutritionFields.map(k => [k, source.totalNutrition[k] === null ? null : source.totalNutrition[k]! * l.sourceFraction!])) as Nutrition)) throw new FoodStorageError('INVALID', 'Invalid source batch link/snapshot');
    }
    if (b.originMealId !== null && (meals.get(b.originMealId)?.leftoverBatchId !== b.id || !meals.get(b.originMealId)!.leftoverInventoryUnchanged && !storageClose((meals.get(b.originMealId)!.consumptionPercent ?? 100) / 100, b.initialConsumedFraction))) throw new FoodStorageError('INVALID', 'Invalid leftover origin link');
  }
  // Source references must be a DAG; prepared food must never recursively become itself.
  const done = new Set<string>(), visiting = new Set<string>();
  const visit = (b: FoodBatch) => {
    if (visiting.has(b.id)) throw new FoodStorageError('INVALID', 'Cyclic batch sources');
    if (done.has(b.id)) return;
    visiting.add(b.id); for (const l of b.ingredients) if (l.source === 'batch') visit(byId.get(l.sourceBatchId!)!);
    visiting.delete(b.id); done.add(b.id);
  };
  batches.forEach(visit);
  for (const t of transactions) if (t.batchIds.some(id => !byId.has(id)) || t.targetBatchId !== null && !byId.has(t.targetBatchId) || t.mealId !== null && !meals.has(t.mealId)) throw new FoodStorageError('INVALID', 'Orphan inventory transaction');
  for (const m of meals.values()) {
    if (m.storageConsumption !== undefined) {
      const c = m.storageConsumption;
      if (!validStorageConsumption(c) || !byId.get(c.batchId)?.everUsed || txById.get(c.transactionId)?.kind !== 'meal' || txById.get(c.transactionId)?.mealId !== m.id || !txById.get(c.transactionId)?.batchIds.includes(c.batchId) || !storageNutritionEqual(m.nutrition, Object.fromEntries(nutritionFields.map(k => [k, byId.get(c.batchId)!.totalNutrition[k] === null ? null : byId.get(c.batchId)!.totalNutrition[k]! * c.originalFraction])) as Nutrition)) throw new FoodStorageError('INVALID', 'Invalid meal inventory link');
    }
    if (m.leftoverInventoryUnchanged !== undefined && (m.leftoverInventoryUnchanged !== true || !m.leftoverBatchId || !transactions.some(t => t.kind === 'edit-origin' && t.mealId === m.id && t.targetBatchId === m.leftoverBatchId && JSON.parse(t.request).input?.strategy === 'meal-only'))) throw new FoodStorageError('INVALID', 'Unconfirmed leftover inventory correction');
    if (m.leftoverBatchId !== undefined && (!id(m.leftoverBatchId) || byId.get(m.leftoverBatchId)?.originMealId !== m.id || m.storageConsumption !== undefined)) throw new FoodStorageError('INVALID', 'Invalid initial leftover meal');
  }
}
