import type {Table} from 'dexie';
import {db, stamp, localDate, type LumiDB, type RecordBase} from './db';
import {scaleNutrition, sumNutrition, type FoodLog, type Nutrition, type Recipe, type RecipeLine} from './domain';
import {recipeServingLines} from './recipe-nutrition';
import {
  FoodStorageError, storageNutritionEqual, positive, finiteNonnegative, validFoodBatch, validBatchIngredient,
  validStorageNutrition, validStorageTransaction, type FoodBatch, type BatchIngredient,
  type StorageTransaction, type StorageTransactionKind, type InventoryMovement,
} from './food-storage-model';

export type InventoryPortion = {unit: 'g' | 'percent'; quantity: number};
export type BatchIngredientInput = {source: 'pantry'; line: RecipeLine} | {source: 'batch'; batchId: string; portion: InventoryPortion};
export interface MakeBatchInput {
  operationId: string; id: string; name: string; preparedOn: string; notes?: string;
  sourceRecipeId?: string | null; ingredients: BatchIngredientInput[]; cookedYieldGrams: number;
}
export interface StorageMealInput {
  operationId: string; mealId: string; batchId: string; portion: InventoryPortion;
  date: string; category: FoodLog['category']; notes?: string; expectedRevision?: number;
}
export interface LeftoversInput {
  operationId: string; meal: FoodLog; saveLeftovers: boolean; batchId?: string;
  /** Weight of the COMPLETE prepared portion, never inferred from ingredient weights. */
  cookedWeightGrams?: number;
}
function fail(code: FoodStorageError['code'], message: string, batchId?: string): never {throw new FoodStorageError(code, message, batchId)}
const changed = <T extends RecordBase>(row: T): T => ({...row, updatedAt: new Date().toISOString(), revision: row.revision + 1});
const same = (a: number, b: number) => Math.abs(a - b) <= Number.EPSILON * 32 * Math.max(1, Math.abs(a), Math.abs(b));
function canonical(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) fail('INVALID', 'Non-finite operation input');
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  if (value === undefined) return 'null';
  const serialized = JSON.stringify(value);
  if (serialized === undefined) fail('INVALID', 'Unsupported operation input');
  return serialized;
}
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0,10) === v;
function validateMealFields(date: string, category: string) {
  if (!validDate(date) || !['uncategorized','breakfast','lunch','dinner','snack'].includes(category)) fail('INVALID', 'Invalid meal date/category');
}
export function batchRemainingNutrition(batch: FoodBatch): Nutrition {
  return scaleNutrition(batch.totalNutrition, batch.remainingQuantity * batch.fractionPerUnit);
}
/** A detached editable copy; saving it never modifies the recipe template. */
export function copyRecipeForBatch(recipe: Recipe, servings = recipe.servings ?? 1): BatchIngredientInput[] {
  if (!positive(servings)) fail('INVALID', 'Invalid recipe servings');
  return structuredClone(recipeServingLines(recipe, servings)).map(line => ({source: 'pantry', line}));
}

export function batchHasInventoryActivity(batch: FoodBatch, history: StorageTransaction[]) {
  return history.filter(t => t.batchIds.includes(batch.id)).some(t => !((t.kind === 'create' || t.kind === 'leftovers') && t.targetBatchId === batch.id || ['metadata','archive','restore'].includes(t.kind) || t.kind === 'edit-origin' && t.mealId === batch.originMealId && t.reason === 'sync'));
}
export function canCancelBatch(batch: FoodBatch, history: StorageTransaction[]) {
  return !['canceled','discarded'].includes(batch.archiveReason ?? '') && !(batch.everUsed && !batch.originMealId) && !batchHasInventoryActivity(batch, history);
}
export function batchInventoryProgress(batch: FoodBatch, history: StorageTransaction[]) {
  const creation = history.find(t => t.targetBatchId === batch.id && ['create','leftovers'].includes(t.kind));
  const original = creation?.movements.find(m => m.batchId === batch.id)?.fractionDelta ?? (batch.originMealId ? 1 - batch.initialConsumedFraction : 1);
  // A synchronized origin is an explicit correction of the initially stored quantity.
  const start = batch.originMealId ? 1 - batch.initialConsumedFraction : original;
  return start > 0 ? batch.remainingQuantity * batch.fractionPerUnit / start : 0;
}

/** All public mutations are atomic and require a stable caller-generated retry key. */
export class FoodStorage {
  readonly batches: Table<FoodBatch>;
  readonly transactions: Table<StorageTransaction>;
  readonly meals: Table<FoodLog>;
  constructor(readonly database: LumiDB = db) {
    this.batches = database.table('foodBatches');
    this.transactions = database.table('inventoryTransactions');
    this.meals = database.table('foodLogs');
  }
  private async run(operationId: string, kind: StorageTransactionKind, input: unknown, apply: (tx: StorageTransaction) => Promise<void>) {
    if (typeof operationId !== 'string' || !operationId.trim()) fail('INVALID', 'A stable operation ID is required');
    const request = canonical({kind, input});
    return this.database.transaction('rw', [this.batches, this.transactions, this.meals], async () => {
      const previous = await this.transactions.get(operationId);
      if (previous) {
        if (previous.request !== request || previous.kind !== kind) fail('CONFLICT', 'Operation ID already used for a different request');
        return previous;
      }
      const transaction: StorageTransaction = {...stamp(), id: operationId, kind, request, batchIds: [], mealId: null, targetBatchId: null, movements: [], reason: ''};
      await apply(transaction);
      transaction.batchIds = [...new Set(transaction.batchIds)];
      if (!validStorageTransaction(transaction)) fail('INVALID', 'Invalid inventory transaction');
      await this.transactions.add(transaction);
      return transaction;
    });
  }
  private async batch(id: string) {
    const b = await this.batches.get(id);
    if (!b || b.deletedAt) return fail('NOT_FOUND', 'Batch not found', id);
    if (!validFoodBatch(b)) return fail('INVALID', 'Invalid stored batch', id);
    return b;
  }
  private async putBatch(b: FoodBatch) {
    if (!validFoodBatch(b)) fail('INVALID', 'Invalid batch or non-finite nutrition');
    await this.batches.put(b);
  }
  private portion(b: FoodBatch, p: InventoryPortion) {
    if (!p || !positive(p.quantity)) return fail('INVALID', 'Consumption must be finite and positive', b.id);
    if (b.mode === 'weight' && p.unit === 'g') return p.quantity;
    if (b.mode === 'ratio' && p.unit === 'percent' && p.quantity <= 100) return p.quantity === 100 ? b.remainingQuantity : b.remainingQuantity * p.quantity / 100;
    return fail('INVALID', 'Unsupported inventory unit or percentage', b.id);
  }
  private async move(b: FoodBatch, delta: number, tx: StorageTransaction, consuming = false) {
    if (b.archiveReason === 'canceled') fail('CONFLICT', 'Canceled preparations cannot change inventory', b.id);
    if (consuming && b.archived) fail('ARCHIVED', 'Restore archived inventory before consuming it', b.id);
    if (!Number.isFinite(delta)) fail('INVALID', 'Non-finite inventory change', b.id);
    const before = b.remainingQuantity;
    let after = before + delta;
    if (after < 0 && !same(after, 0)) fail('OVERDRAW', 'Insufficient inventory', b.id);
    if (after < 0) after = 0;
    const m: InventoryMovement = {batchId: b.id, mode: b.mode, before, after, fractionPerUnit: b.fractionPerUnit, fractionDelta: (after - before) * b.fractionPerUnit};
    tx.movements.push(m); tx.batchIds.push(b.id);
    b = changed({...b, remainingQuantity: after, everUsed: b.everUsed || consuming});
    if (after === 0 && !b.archived) {b.archived = true; b.archiveReason = 'exhausted'}
    else if (after > 0 && b.archiveReason === 'exhausted') {b.archived = false; b.archiveReason = null}
    await this.putBatch(b);
    return b;
  }
  private async ingredients(inputs: BatchIngredientInput[], tx: StorageTransaction, targetId: string): Promise<BatchIngredient[]> {
    if (!Array.isArray(inputs) || !inputs.length) return fail('INVALID', 'A batch requires ingredient snapshots');
    const lines: BatchIngredient[] = [];
    for (const input of inputs) {
      if (input.source === 'pantry') {
        // Do not retain accidental extra fields from a UI draft or a mutable ingredient record.
        const {ingredientId, name, quantity, unit, nutrition} = input.line;
        const line: BatchIngredient = {source: 'pantry', ingredientId, name, quantity, unit, nutrition: structuredClone(nutrition)};
        if (!validBatchIngredient(line)) fail('INVALID', 'Invalid Pantry ingredient snapshot');
        lines.push(line);
      } else if (input.source === 'batch') {
        if (input.batchId === targetId) fail('CONFLICT', 'A batch cannot contain itself', targetId);
        const source = await this.batch(input.batchId);
        const quantity = this.portion(source, input.portion), fraction = quantity * source.fractionPerUnit;
        const line: BatchIngredient = {source: 'batch', ingredientId: source.id, sourceBatchId: source.id, sourceFraction: fraction, name: source.name, quantity, unit: source.mode === 'weight' ? 'g' : 'fraction', nutrition: scaleNutrition(source.totalNutrition, fraction)};
        if (!validBatchIngredient(line)) fail('INVALID', 'Invalid source batch snapshot');
        await this.move(source, -quantity, tx, true); lines.push(line);
      } else fail('INVALID', 'Only Pantry and Food Storage ingredients are supported');
    }
    return lines;
  }
  async makeBatch(input: MakeBatchInput) {
    input = structuredClone(input);
    return this.run(input.operationId, 'create', input, async tx => {
      if (!input.id?.trim() || !positive(input.cookedYieldGrams)) fail('INVALID', 'A positive measured cooked yield and batch ID are required');
      if (await this.batches.get(input.id)) fail('CONFLICT', 'Batch ID already exists', input.id);
      const ingredients = await this.ingredients(input.ingredients, tx, input.id);
      const batch: FoodBatch = {...stamp(), id: input.id, name: input.name, sourceRecipeId: input.sourceRecipeId ?? null, preparedOn: input.preparedOn, notes: input.notes ?? '', ingredients,
        totalNutrition: sumNutrition(ingredients.map(l => l.nutrition)), originalCookedYield: input.cookedYieldGrams, mode: 'weight', remainingQuantity: input.cookedYieldGrams, fractionPerUnit: 1 / input.cookedYieldGrams,
        everUsed: false, archived: false, archiveReason: null, originMealId: null, initialConsumedFraction: 0};
      await this.putBatch(batch); tx.targetBatchId = batch.id; tx.batchIds.push(batch.id);
      tx.movements.push({batchId: batch.id, mode: 'weight', before: 0, after: batch.remainingQuantity, fractionPerUnit: batch.fractionPerUnit, fractionDelta: 1});
    });
  }
  async saveMealWithLeftovers(input: LeftoversInput) {
    input = structuredClone(input);
    return this.run(input.operationId, 'leftovers', input, async tx => {
      const meal = structuredClone(input.meal);
      validateMealFields(meal.date, meal.category);
      if (!meal.id?.trim() || !meal.name?.trim() || meal.source !== 'recipe' || meal.deletedAt || !positive(meal.quantity) || !meal.unit?.trim() || typeof meal.cookingNote !== 'string' || typeof input.saveLeftovers !== 'boolean' || meal.storageConsumption || meal.leftoverBatchId) fail('INVALID', 'Invalid initial recipe meal');
      if (await this.meals.get(meal.id)) fail('CONFLICT', 'Initial meal already exists; reconcile leftovers explicitly before editing');
      const percent = meal.consumptionPercent ?? 100;
      if (!finiteNonnegative(percent) || percent > 100 || !validStorageNutrition(meal.baseNutrition) || !Array.isArray(meal.lines) || !meal.lines.length) fail('INVALID', 'A complete portion snapshot and valid percentage are required');
      const lines: BatchIngredient[] = meal.lines.map(l => ({...structuredClone(l), source: 'pantry'}));
      if (!lines.every(validBatchIngredient)) fail('INVALID', 'Invalid complete portion ingredients');
      if (!storageNutritionEqual(sumNutrition(lines.map(l => l.nutrition)), meal.baseNutrition!)) fail('INVALID', 'Complete portion nutrition does not match ingredient snapshots');
      meal.nutrition = scaleNutrition(meal.baseNutrition!, percent / 100);
      if (!validStorageNutrition(meal.nutrition)) fail('INVALID', 'Invalid consumed nutrition');
      if (input.saveLeftovers) {
        if (percent >= 100 || !input.batchId?.trim()) fail('INVALID', 'Leftovers require an explicit batch ID and less than 100% consumption');
        if (input.cookedWeightGrams !== undefined && !positive(input.cookedWeightGrams)) fail('INVALID', 'Cooked weight must be positive when provided');
        if (await this.batches.get(input.batchId!)) fail('CONFLICT', 'Leftover batch already exists');
        const fraction = 1 - percent / 100, weight = input.cookedWeightGrams ?? null;
        const b: FoodBatch = {...stamp(), id: input.batchId!, name: meal.name, sourceRecipeId: meal.sourceId, preparedOn: localDate(), notes: meal.cookingNote, ingredients: lines,
          totalNutrition: structuredClone(meal.baseNutrition!), originalCookedYield: weight, mode: weight === null ? 'ratio' : 'weight', remainingQuantity: weight === null ? fraction : weight * fraction,
          fractionPerUnit: weight === null ? 1 : 1 / weight, everUsed: true, archived: false, archiveReason: null, originMealId: meal.id, initialConsumedFraction: percent / 100};
        await this.putBatch(b); meal.leftoverBatchId = b.id; tx.batchIds.push(b.id); tx.targetBatchId = b.id;
        tx.movements.push({batchId: b.id, mode: b.mode, before: 0, after: b.remainingQuantity, fractionPerUnit: b.fractionPerUnit, fractionDelta: fraction});
      }
      await this.meals.add(meal); tx.mealId = meal.id;
    });
  }
  async saveMeal(input: StorageMealInput) {
    input = structuredClone(input);
    return this.run(input.operationId, 'meal', input, async tx => {
      validateMealFields(input.date, input.category);
      if (!input.mealId?.trim() || input.notes !== undefined && typeof input.notes !== 'string') fail('INVALID', 'Invalid meal');
      const old = await this.meals.get(input.mealId);
      if (old && (old.deletedAt || !old.storageConsumption || input.expectedRevision !== old.revision)) fail('CONFLICT', 'Meal changed, deleted, or not a storage consumption');
      if (!old && input.expectedRevision !== undefined) fail('CONFLICT', 'Meal no longer exists');
      let batch = await this.batch(input.batchId);
      // While editing, the meal's own allocation is available again. Other meals/manual corrections stay intact.
      const available = old?.storageConsumption?.batchId === batch.id && batch.mode === 'ratio'
        ? {...batch, remainingQuantity: batch.remainingQuantity + old.storageConsumption.originalFraction / batch.fractionPerUnit} : batch;
      const quantity = this.portion(available, input.portion), fraction = quantity * batch.fractionPerUnit;
      if (!positive(fraction)) fail('INVALID', 'Consumption fraction must be positive');
      if (old?.storageConsumption?.batchId === batch.id) {
        const oldQuantity = old.storageConsumption.originalFraction / batch.fractionPerUnit;
        const difference = quantity - oldQuantity;
        batch = await this.move(batch, -difference, tx, difference > 0);
      } else {
        if (old?.storageConsumption) {
          const previous = await this.batch(old.storageConsumption.batchId);
          await this.move(previous, old.storageConsumption.originalFraction / previous.fractionPerUnit, tx);
        }
        batch = await this.move(batch, -quantity, tx, true);
      }
      const nutrition = scaleNutrition(batch.totalNutrition, fraction);
      if (!validStorageNutrition(nutrition)) fail('INVALID', 'Invalid meal nutrition');
      const meal: FoodLog = {...(old ? changed(old) : {...stamp(), id: input.mealId}), date: input.date, category: input.category, name: batch.name,
        source: 'quick', sourceId: null, quantity, unit: batch.mode === 'weight' ? 'g' : 'fraction', nutrition, baseNutrition: structuredClone(nutrition), consumptionPercent: 100,
        lines: [], cookingNote: input.notes ?? old?.cookingNote ?? '', storageConsumption: {batchId: batch.id, originalFraction: fraction, transactionId: tx.id}};
      await this.meals.put(meal); tx.mealId = meal.id; tx.targetBatchId = batch.id;
    });
  }
  async deleteMeal(input: {operationId: string; mealId: string; expectedRevision: number}) {
    input = structuredClone(input);
    return this.run(input.operationId, 'delete-meal', input, async tx => {
      const meal = await this.meals.get(input.mealId);
      if (!meal || meal.deletedAt || meal.revision !== input.expectedRevision) fail('CONFLICT', 'Meal changed or was deleted');
      if (!meal.storageConsumption && !meal.leftoverBatchId) fail('INVALID', 'Not a Food Storage linked meal');
      if (meal.storageConsumption) {
        const b = await this.batch(meal.storageConsumption.batchId);
        await this.move(b, meal.storageConsumption.originalFraction / b.fractionPerUnit, tx);
      }
      // An origin meal did not deduct from leftover inventory. Deleting it returns NOTHING.
      await this.meals.put({...changed(meal), deletedAt: new Date().toISOString()}); tx.mealId = meal.id;
      if (meal.leftoverBatchId) {tx.batchIds.push(meal.leftoverBatchId); tx.targetBatchId = meal.leftoverBatchId}
    });
  }
  async correctFormula(input: {operationId: string; batchId: string; expectedRevision: number; ingredients: BatchIngredient[]; cookedYieldGrams: number}) {
    input = structuredClone(input);
    return this.run(input.operationId, 'correct-formula', input, async tx => {
      const b = await this.batch(input.batchId);
      if (b.revision !== input.expectedRevision) fail('CONFLICT', 'Batch changed', b.id);
      if (b.everUsed) fail('LOCKED', 'Batch formula is permanently locked after first use/reference', b.id);
      // Returning already-processed source food has no safe cancellation semantics in Phase 1.
      if (b.originMealId || b.archived || b.remainingQuantity !== b.originalCookedYield) fail('CONFLICT', 'Formula correction requires untouched inventory', b.id);
      if (!Array.isArray(input.ingredients) || !input.ingredients.length || !input.ingredients.every(validBatchIngredient)) fail('INVALID', 'Invalid formula snapshots');
      const sources = (lines: BatchIngredient[]) => lines.filter(l => l.source === 'batch').map(canonical).sort();
      if (canonical(sources(b.ingredients)) !== canonical(sources(input.ingredients))) fail('CONFLICT', 'Processed source allocations cannot be reversed or replaced by a formula correction', b.id);
      if (!positive(input.cookedYieldGrams)) fail('INVALID', 'A positive cooked yield is required');
      const ingredients = structuredClone(input.ingredients);
      const next = changed({...b, ingredients, totalNutrition: sumNutrition(ingredients.map(l => l.nutrition)), originalCookedYield: input.cookedYieldGrams, remainingQuantity: input.cookedYieldGrams, fractionPerUnit: 1 / input.cookedYieldGrams});
      await this.putBatch(next); tx.targetBatchId = b.id; tx.batchIds.push(b.id);
      tx.reason = 'Unused formula correction; old snapshots retained in the operation request';
    });
  }
  async adjustRemaining(input: {operationId: string; batchId: string; expectedRevision: number; quantity: number; reason: string}) {
    input = structuredClone(input);
    return this.run(input.operationId, 'adjust', input, async tx => {
      const b = await this.batch(input.batchId);
      if (b.revision !== input.expectedRevision) fail('CONFLICT', 'Batch changed', b.id);
      if (!finiteNonnegative(input.quantity) || !input.reason?.trim()) fail('INVALID', 'A finite balance and adjustment reason are required');
      await this.move(b, input.quantity - b.remainingQuantity, tx); tx.reason = input.reason; tx.targetBatchId = b.id;
    });
  }
  async convertToWeight(input: {operationId: string; batchId: string; expectedRevision: number; remainingGrams: number}) {
    input = structuredClone(input);
    return this.run(input.operationId, 'convert', input, async tx => {
      const b = await this.batch(input.batchId);
      if (b.revision !== input.expectedRevision) fail('CONFLICT', 'Batch changed', b.id);
      if (b.mode !== 'ratio' || !positive(b.remainingQuantity) || !positive(input.remainingGrams)) fail('INVALID', 'Conversion requires positive remaining ratio inventory and measured grams');
      const factor = b.remainingQuantity * b.fractionPerUnit / input.remainingGrams;
      await this.putBatch(changed({...b, mode: 'weight', remainingQuantity: input.remainingGrams, fractionPerUnit: factor}));
      tx.batchIds.push(b.id); tx.targetBatchId = b.id;
      tx.movements.push({batchId: b.id, mode: 'ratio', before: b.remainingQuantity, after: b.remainingQuantity, fractionPerUnit: b.fractionPerUnit, fractionDelta: 0});
      tx.reason = 'Measured remaining weight: ' + input.remainingGrams + ' g; original cooked yield and historical meals unchanged';
    });
  }
  async setArchive(input: {operationId: string; batchId: string; expectedRevision: number; action: 'archive' | 'restore' | 'discard'}) {
    input = structuredClone(input);
    const kind = input.action;
    if (!['archive','restore','discard'].includes(kind)) fail('INVALID', 'Invalid archive action');
    return this.run(input.operationId, kind, input, async tx => {
      let b = await this.batch(input.batchId);
      if (b.revision !== input.expectedRevision) fail('CONFLICT', 'Batch changed', b.id);
      if (b.archiveReason === 'canceled') fail('CONFLICT', 'Canceled preparations cannot be restored or discarded', b.id);
      if (kind === 'discard') b = await this.move(b, -b.remainingQuantity, tx);
      if (kind === 'restore' && b.remainingQuantity === 0) fail('INVALID', 'Correct the remaining quantity before restoring an empty batch');
      b = changed({...b, archived: kind !== 'restore', archiveReason: kind === 'restore' ? null : kind === 'discard' ? 'discarded' : 'manual'});
      await this.putBatch(b); tx.batchIds.push(b.id); tx.targetBatchId = b.id;
    });
  }
  /** Only creation and harmless name/archive changes may precede synchronization/cancellation. */
  private async untouched(b: FoodBatch) {
    const history = await this.transactions.where('batchIds').equals(b.id).toArray();
    return !batchHasInventoryActivity(b, history);
  }
  async editLeftoverOrigin(input: {operationId: string; meal: FoodLog; expectedMealRevision: number; expectedBatchRevision: number; strategy: 'sync' | 'meal-only'}) {
    input = structuredClone(input);
    return this.run(input.operationId, 'edit-origin', input, async tx => {
      const old = await this.meals.get(input.meal.id);
      if (!old || old.deletedAt || !old.leftoverBatchId || old.revision !== input.expectedMealRevision) fail('CONFLICT', 'Origin meal changed');
      const b = await this.batch(old.leftoverBatchId);
      if (b.revision !== input.expectedBatchRevision) fail('CONFLICT', 'Leftover batch changed', b.id);
      if (!['sync','meal-only'].includes(input.strategy)) fail('INVALID', 'Invalid correction strategy');
      const meal = {...old, ...structuredClone(input.meal), id: old.id, createdAt: old.createdAt, updatedAt: new Date().toISOString(), revision: old.revision + 1, deletedAt: null, leftoverBatchId: b.id};
      validateMealFields(meal.date, meal.category);
      const percent = meal.consumptionPercent ?? 100;
      if (meal.source !== 'recipe' || meal.storageConsumption || !meal.name.trim() || !positive(meal.quantity) || !finiteNonnegative(percent) || percent > 100 || !validStorageNutrition(meal.baseNutrition) || !Array.isArray(meal.lines) || !meal.lines.length) fail('INVALID', 'Invalid origin meal correction');
      const ingredients: BatchIngredient[] = meal.lines.map(l => ({...structuredClone(l), source:'pantry'}));
      if (!ingredients.every(validBatchIngredient) || !storageNutritionEqual(sumNutrition(ingredients.map(l => l.nutrition)), meal.baseNutrition!)) fail('INVALID', 'Invalid complete prepared portion');
      meal.nutrition = scaleNutrition(meal.baseNutrition!, percent / 100);
      if (input.strategy === 'sync') {
        if (!await this.untouched(b) || b.archiveReason === 'canceled' || b.archiveReason === 'discarded') fail('CONFLICT', 'Leftover inventory has downstream activity; explicit meal-only correction is required', b.id);
        const remaining = b.mode === 'weight' ? b.originalCookedYield! * (1 - percent / 100) : 1 - percent / 100;
        const next: FoodBatch = changed({...b, sourceRecipeId:meal.sourceId, ingredients, totalNutrition:structuredClone(meal.baseNutrition!), initialConsumedFraction:percent / 100, remainingQuantity:remaining});
        if (remaining === 0 && !next.archived) {next.archived=true;next.archiveReason='exhausted'}
        else if (remaining > 0 && next.archiveReason==='exhausted') {next.archived=false;next.archiveReason=null}
        await this.putBatch(next);
        tx.movements.push({batchId:b.id, mode:b.mode, before:b.remainingQuantity, after:remaining, fractionPerUnit:b.fractionPerUnit, fractionDelta:(remaining-b.remainingQuantity)*b.fractionPerUnit});
        delete meal.leftoverInventoryUnchanged;
      } else {
        // Explicit user decision: changing the meal is NOT permission to rewrite derived food.
        meal.leftoverInventoryUnchanged = true;
      }
      await this.meals.put(meal);tx.mealId=meal.id;tx.targetBatchId=b.id;tx.batchIds.push(b.id);tx.reason=input.strategy;
    });
  }
  async cancelBatch(input: {operationId: string; batchId: string; expectedRevision: number}) {
    input = structuredClone(input);
    return this.run(input.operationId, 'cancel-batch', input, async tx => {
      let b = await this.batch(input.batchId);
      if (b.revision !== input.expectedRevision) fail('CONFLICT', 'Batch changed', b.id);
      if (b.archiveReason === 'canceled' || b.archiveReason === 'discarded' || b.everUsed && !b.originMealId || !await this.untouched(b)) fail('CONFLICT', 'Only an unused, unadjusted, unconverted preparation can be canceled', b.id);
      for (const line of b.ingredients) if (line.source === 'batch') {
        const source = await this.batch(line.sourceBatchId!);
        await this.move(source, line.sourceFraction! / source.fractionPerUnit, tx);
      }
      b = await this.move(b, -b.remainingQuantity, tx);
      await this.putBatch(changed({...b,archived:true,archiveReason:'canceled'}));
      tx.batchIds.push(b.id);tx.targetBatchId=b.id;tx.reason='Explicit cancellation; processed source allocations returned once';
    });
  }
  async updateMetadata(input: {operationId: string; batchId: string; expectedRevision: number; name: string; notes: string}) {
    input = structuredClone(input);
    return this.run(input.operationId, 'metadata', input, async tx => {
      const b = await this.batch(input.batchId);
      if (b.revision !== input.expectedRevision) fail('CONFLICT', 'Batch changed', b.id);
      await this.putBatch(changed({...b, name: input.name, notes: input.notes})); tx.batchIds.push(b.id); tx.targetBatchId = b.id;
    });
  }
}
