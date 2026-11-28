import {lineNutrition,validZeroReference} from './line-nutrition';
import type {RecordBase} from './db';
import type {FoodLog, Nutrition, RecipeLine} from './domain';

export type InventoryMode = 'weight' | 'ratio' | 'servings';
export type ArchiveReason = 'exhausted' | 'manual' | 'discarded' | 'canceled' | null;
export interface StockBasis {ingredientId:string;perGram:Nutrition}
export interface HistoricalAllocationBasis extends StockBasis {
  lineId: string;
  batchId: string;
  unit: 'g';
  transactionId: string;
}
export function historicalBasisForLine(meal:FoodLog|undefined,line:RecipeLine) {
  return line.source==='batch' ? meal?.historicalAllocationBases?.find(b=>b.lineId===line.lineId&&b.batchId===line.sourceBatchId) : undefined;
}
export function allocationNutrition(value:Nutrition):Record<keyof Nutrition,number> {
  return {calories:value.calories??0,protein:value.protein??0,carbs:value.carbs??0,fat:value.fat??0};
}
export function basisLineNutrition(basis:StockBasis,grams:number):Nutrition {
  return Object.fromEntries(nutritionFields.map(k=>[k,basis.perGram[k]===null?null:basis.perGram[k]!*grams])) as Nutrition;
}
export interface BatchIngredient extends RecipeLine {
  stockBasis?:StockBasis;
  source: 'pantry' | 'batch';
  sourceBatchId?: string;
  /** Fraction of the source batch's ORIGINAL nutrition, not its current remainder. */
  sourceFraction?: number;
}
export interface FoodBatch extends RecordBase {
  stock?:{kind:'pantry-ingredient';ingredientId:string;unit:'g'};
  name: string;
  sourceRecipeId: string | null;
  preparedOn: string;
  notes: string;
  ingredients: BatchIngredient[];
  totalNutrition: Nutrition;
  totalServings?: number;
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
export function originalBatchPercentage(batch:FoodBatch, history:StorageTransaction[]) {
  return batch.mode==='ratio' && history.some(t=>t.kind==='create' && t.targetBatchId===batch.id);
}
export function percentageFraction(percent:number, availableFraction:number, ofOriginal:boolean) {
  return (ofOriginal ? 1 : availableFraction) * (percent / 100);
}
export interface StorageConsumption {
  stockBasis?:StockBasis;
  batchId: string;
  originalFraction: number;
  transactionId: string;
}
export interface RecipeAllocation extends StorageConsumption {
  lineId: string;
  quantity: number;
  unit: 'g' | 'fraction' | 'serving';
  nutrition: Nutrition;
}
export interface InventoryMovement {
  batchRevision?: number;
  batchId: string;
  mode: InventoryMode;
  before: number;
  after: number;
  fractionPerUnit: number;
  /** Signed change in original-batch nutrition fraction. */
  fractionDelta: number;
}
export type StorageTransactionKind = 'create' | 'leftovers' | 'meal' | 'delete-meal' | 'repartition' | 'correct-formula' | 'adjust' | 'convert' | 'archive' | 'restore' | 'discard' | 'metadata' | 'edit-origin' | 'cancel-batch';
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
  constructor(public code: 'INVALID' | 'UNIT_REVIEW' | 'NOT_FOUND' | 'OVERDRAW' | 'ARCHIVED' | 'LOCKED' | 'CONFLICT', message: string, public batchId?: string) {
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
  return !!l && id(l.ingredientId) && text(l.name) && (l.lineId===undefined||id(l.lineId)) && (l.groupId===undefined||id(l.groupId)) && finiteNonnegative(l.quantity) && (l.zeroQuantityReference===undefined||validZeroReference(l.zeroQuantityReference)) && id(l.unit) && l.unit.length <= 40 && validStorageNutrition(l.nutrition) &&
    (l.source === 'pantry' ? l.stockBasis===undefined && l.sourceBatchId === undefined && l.sourceFraction === undefined : l.source === 'batch' && id(l.sourceBatchId) && l.ingredientId === l.sourceBatchId && (l.quantity===0?l.sourceFraction===0:positive(l.sourceFraction)));
}
export function validFoodBatch(v: unknown): v is FoodBatch {
  const b = v as FoodBatch;
  return !!b && (b.stock===undefined||(b.stock?.kind==='pantry-ingredient'&&id(b.stock.ingredientId)&&b.stock.unit==='g'&&b.mode==='weight')) && record(b) && id(b.name) && (b.sourceRecipeId === null || id(b.sourceRecipeId)) && date(b.preparedOn) && text(b.notes) && Array.isArray(b.ingredients) && b.ingredients.length > 0 && b.ingredients.every(validBatchIngredient) &&
    validStorageNutrition(b.totalNutrition) && (b.originalCookedYield === null || positive(b.originalCookedYield)) && ['weight', 'ratio', 'servings'].includes(b.mode) &&
    (b.mode === 'servings' ? positive(b.totalServings) && b.originalCookedYield === null && b.originMealId === null && b.initialConsumedFraction === 0 && storageClose(b.totalServings * b.fractionPerUnit, 1) : b.totalServings === undefined) &&
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
  return !!t && record(t) && ['create', 'leftovers', 'meal', 'delete-meal', 'repartition', 'correct-formula', 'adjust', 'convert', 'archive', 'restore', 'discard', 'metadata', 'edit-origin', 'cancel-batch'].includes(t.kind) && id(t.request) &&
    Array.isArray(t.batchIds) && t.batchIds.every(id) && new Set(t.batchIds).size === t.batchIds.length && (t.mealId === null || id(t.mealId)) && (t.targetBatchId === null || id(t.targetBatchId)) && text(t.reason) &&
    Array.isArray(t.movements) && t.movements.every(m => !!m && id(m.batchId) && t.batchIds.includes(m.batchId) && ['weight', 'ratio', 'servings'].includes(m.mode) && finiteNonnegative(m.before) && finiteNonnegative(m.after) && positive(m.fractionPerUnit) && typeof m.fractionDelta === 'number' && Number.isFinite(m.fractionDelta) && (t.kind === 'repartition' ? m.mode === 'servings' && m.fractionDelta === 0 : storageClose(m.fractionDelta, (m.after - m.before) * m.fractionPerUnit)));
}
function validateServingLedger(batch: FoodBatch, history: StorageTransaction[], creation: StorageTransaction, meals:Map<string,FoodLog>, batches:Map<string,FoodBatch>) {
  const invalid = () => { throw new FoodStorageError('INVALID', 'Serving inventory differs from its transaction history'); };
  const entries = history.flatMap(tx => tx.movements.filter(m => m.batchId === batch.id).map(m => ({tx,m})))
    .sort((a,b) => (a.m.batchRevision ?? 0) - (b.m.batchRevision ?? 0));
  const allocated = new Map<string,number>();
  let balance = 0, factor = 0, revision = 0, untouched = true;
  if (!entries.length || entries[0].tx !== creation || creation.kind !== 'create') invalid();
  for (const {tx,m} of entries) {
    if (m.mode !== 'servings' || !Number.isSafeInteger(m.batchRevision) || m.batchRevision! <= revision || m.batchRevision! > batch.revision || !storageClose(m.before,balance)) invalid();
    if (revision === 0 || tx.kind === 'repartition') {
      const input=JSON.parse(tx.request).input;
      if ((revision === 0 ? input.id!==batch.id || input.mode!=='servings' : input.batchId!==batch.id || input.expectedRevision!==m.batchRevision!-1) || !positive(input.totalServings) || !storageClose(input.totalServings,m.after)) invalid();
      if (!untouched || tx.targetBatchId !== batch.id || !storageClose(m.after*m.fractionPerUnit,1)) invalid();
      factor = m.fractionPerUnit;
    } else {
      if (!storageClose(m.fractionPerUnit/factor,1)) invalid();
      if (!['adjust','meal','delete-meal','create','leftovers','discard','cancel-batch'].includes(tx.kind)) invalid();
      if (tx.kind === 'adjust') {
        const input=JSON.parse(tx.request).input;
        if(!tx.reason.trim() || tx.targetBatchId!==batch.id || input.batchId!==batch.id || input.reason!==tx.reason || !finiteNonnegative(input.quantity) || !storageClose(input.quantity,m.after)) invalid();
      }
      if (tx.kind==='meal'||tx.kind==='delete-meal') {
        if(!tx.mealId || !meals.has(tx.mealId)) invalid();
        const outstanding=(allocated.get(tx.mealId!)??0)-m.fractionDelta;
        if(outstanding<0&&!storageClose(outstanding,0))invalid();
        allocated.set(tx.mealId!,outstanding);
      }
      if(tx.kind==='cancel-batch' && tx.targetBatchId!==batch.id){
        const child=batches.get(tx.targetBatchId??'');
        if(!child || !child.ingredients.some(line=>line.sourceBatchId===batch.id && storageClose(line.sourceFraction!,m.fractionDelta)))invalid();
      }
      if(tx.kind==='cancel-batch' && tx.targetBatchId===batch.id && m.after!==0)invalid();
      if (tx.kind==='delete-meal' && m.after<m.before) invalid();
      if ((tx.kind==='meal'||tx.kind==='create'||tx.kind==='leftovers') && m.after<m.before && !batch.everUsed) invalid();
      if (['create','leftovers','discard'].includes(tx.kind) && m.after > m.before) invalid();
      untouched = false;
    }
    balance = m.after; revision = m.batchRevision!;
  }
  for(const meal of meals.values()){
    const direct=meal.storageConsumption?.batchId===batch.id?meal.storageConsumption.originalFraction:0;
    const recipe=(meal.recipeAllocations??[]).reduce((n,a)=>n+(a.batchId===batch.id?a.originalFraction:0),0);
    if(!storageClose(allocated.get(meal.id)??0,meal.deletedAt?0:direct+recipe))invalid();
  }
  if (!storageClose(factor/batch.fractionPerUnit,1) || !storageClose(balance,batch.remainingQuantity)) invalid();
}

/** Validate links before ANY restore writes; historical/tombstoned rows are retained. */
export function validateStorageBackup(tables: Record<string, unknown[]>) {
  const batches = tables.foodBatches as FoodBatch[];
  const transactions = tables.inventoryTransactions as StorageTransaction[];
  if (!Array.isArray(batches) || !Array.isArray(transactions) || !batches.every(validFoodBatch) || !transactions.every(validStorageTransaction)) throw new FoodStorageError('INVALID', 'Invalid Food Storage backup');
  const byId = new Map(batches.map(b => [b.id, b]));
  const txById = new Map(transactions.map(t => [t.id, t]));
  const meals = new Map((tables.foodLogs as FoodLog[]).map(m => [m.id, m]));
  function consumptionNutrition(source:FoodBatch,fraction:number,basis?:StockBasis):Nutrition {
    if(!basis)return Object.fromEntries(nutritionFields.map(k=>[k,source.totalNutrition[k]===null?null:source.totalNutrition[k]!*fraction])) as Nutrition;
    if(!source.stock||basis.ingredientId!==source.stock.ingredientId||!validStorageNutrition(basis.perGram))throw new FoodStorageError('INVALID','Invalid frozen stock basis');
    const grams=fraction/source.fractionPerUnit;
    return Object.fromEntries(nutritionFields.map(k=>[k,basis.perGram[k]===null?null:basis.perGram[k]!*grams])) as Nutrition;
  }
  for (const b of batches) {
    if(b.stock&&!(tables.ingredients as {id:string}[]).some(i=>i.id===b.stock!.ingredientId))throw new FoodStorageError('INVALID','Missing stock ingredient');
    const sum = Object.fromEntries(nutritionFields.map(k => [k, b.ingredients.some(l => lineNutrition(l)[k] === null) ? null : b.ingredients.reduce((sum, l) => sum + lineNutrition(l)[k]!, 0)])) as Nutrition;
    if (!validStorageNutrition(sum) || !storageNutritionEqual(sum, b.totalNutrition)) throw new FoodStorageError('INVALID', 'Batch composition does not match frozen ingredient snapshots');
    const creation = transactions.filter(t => t.targetBatchId === b.id && (t.kind === 'create' || t.kind === 'leftovers'));
    if (creation.length !== 1) throw new FoodStorageError('INVALID', 'Missing or duplicate batch creation history');
    if (b.mode==='ratio' && originalBatchPercentage(b,creation) && (b.originMealId!==null || creation[0].mealId!==null || creation[0].movements.filter(m=>m.batchId===b.id&&m.mode==='ratio'&&m.before===0&&m.after===1&&m.fractionDelta===1).length!==1)) throw new FoodStorageError('INVALID','Ratio creation source mismatch');
    if (b.mode === 'servings') validateServingLedger(b, transactions, creation[0], meals, byId);
    for (const l of b.ingredients) if (l.source === 'batch') {
      const source = byId.get(l.sourceBatchId!);
      if (source?.mode==='servings' && !((l.unit==='serving' && storageClose(l.quantity*source.fractionPerUnit,l.sourceFraction!)) || (l.unit==='fraction' && storageClose(l.quantity,l.sourceFraction!))))throw new FoodStorageError('INVALID','Serving source quantity differs from its original fraction');
      if (!source || source.id === b.id || (l.quantity>0&&!source.everUsed) || l.quantity>0&&!storageNutritionEqual(l.nutrition, consumptionNutrition(source,l.sourceFraction!,l.stockBasis))) throw new FoodStorageError('INVALID', 'Invalid source batch link/snapshot');
    }
    if (b.originMealId !== null && (meals.get(b.originMealId)?.leftoverBatchId !== b.id || !meals.get(b.originMealId)!.leftoverInventoryUnchanged && !(meals.get(b.originMealId)!.deletedAt && b.initialConsumedFraction===0 && b.ingredients.some(l=>l.source==='batch') && transactions.some(t=>t.kind==='delete-meal'&&t.mealId===b.originMealId&&t.targetBatchId===b.id)) && !storageClose((meals.get(b.originMealId)!.consumptionPercent ?? 100) / 100, b.initialConsumedFraction))) throw new FoodStorageError('INVALID', 'Invalid leftover origin link');
  }
  const validateRecipeReferences=(lines:RecipeLine[])=>{
    const ids=new Set<string>();
    for(const line of lines)if(line.source==='batch'){
      if(!id(line.lineId)||ids.has(line.lineId)||!byId.has(line.sourceBatchId!)||byId.get(line.sourceBatchId!)?.mode==='servings'&&line.quantityBasis!=='original-fraction'||line.ingredientId!==line.sourceBatchId||!finiteNonnegative(line.quantity)||!validStorageNutrition(line.nutrition)||!((line.quantityBasis==='g'&&line.unit==='g')||(line.quantityBasis==='original-fraction'&&line.unit==='fraction')))throw new FoodStorageError('INVALID','Invalid stored-food recipe reference');
      ids.add(line.lineId);
    }
  };
  for(const r of (tables.recipeCards??[]) as {lines:RecipeLine[]}[]){
    validateRecipeReferences(r.lines??[]);
    for(const line of r.lines??[])if(line.source==='batch'){
      const b=byId.get(line.sourceBatchId!);
      if(b?.mode==='servings'&&!b.everUsed)throw new FoodStorageError('INVALID','Referenced serving portions are not locked');
    }
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
  for (const t of transactions) {
    if (t.kind==='repartition' && (!t.targetBatchId || byId.get(t.targetBatchId)?.mode!=='servings' || t.movements.length!==1 || t.movements[0].batchId!==t.targetBatchId))throw new FoodStorageError('INVALID','Invalid repartition transaction');
    if(t.movements.some(m=>m.mode==='servings'&&byId.get(m.batchId)?.mode!=='servings'))throw new FoodStorageError('INVALID','Serving movement source mismatch');
  }
  for (const t of transactions) if (t.batchIds.some(id => !byId.has(id)) || t.targetBatchId !== null && !byId.has(t.targetBatchId) || t.mealId !== null && !meals.has(t.mealId)) throw new FoodStorageError('INVALID', 'Orphan inventory transaction');
  for (const m of meals.values()) {
    validateRecipeReferences(m.lines);
    if(m.historicalAllocationBases!==undefined){
      if(m.source!=='recipe'||m.leftoverBatchId||m.storageConsumption||!Array.isArray(m.recipeAllocations)||!Array.isArray(m.historicalAllocationBases)||!m.historicalAllocationBases.length)
        throw new FoodStorageError('INVALID','Invalid historical allocation basis owner');
      const seen=new Set<string>();
      for(const basis of m.historicalAllocationBases){
        const line=m.lines.find(l=>l.lineId===basis?.lineId),batch=byId.get(basis?.batchId),receipt=txById.get(basis?.transactionId);
        if(!basis||!id(basis.lineId)||seen.has(basis.lineId)||basis.unit!=='g'||batch?.stock?.kind!=='pantry-ingredient'||basis.ingredientId!==batch.stock.ingredientId||
          !line||line.source!=='batch'||line.sourceBatchId!==batch.id||!batch.everUsed||receipt?.kind!=='meal'||receipt.mealId!==m.id||!receipt.batchIds.includes(batch.id)||
          !validStorageNutrition(basis.perGram)||!nutritionFields.every(k=>finiteNonnegative(basis.perGram[k])))
          throw new FoodStorageError('INVALID','Invalid historical raw stock allocation basis');
        const grams=line.unit==='g'?line.quantity:line.quantity/batch.fractionPerUnit;
        const allocation=m.recipeAllocations.find(a=>a.lineId===line.lineId);
        if((line.quantity>0&&!storageNutritionEqual(line.nutrition,basisLineNutrition(basis,grams)))||
          (allocation&&(!allocation.stockBasis||!storageNutritionEqual(allocation.stockBasis.perGram,basis.perGram))))
          throw new FoodStorageError('INVALID','Historical allocation basis differs from meal line');
        seen.add(basis.lineId);
      }
    }
    if(m.source==='recipe'&&m.lines.some(l=>l.quantity===0)){
      const base=Object.fromEntries(nutritionFields.map(k=>[k,m.lines.some(l=>lineNutrition(l)[k]===null)?null:m.lines.reduce((sum,l)=>sum+lineNutrition(l)[k]!,0)])) as Nutrition,portion=(m.consumptionPercent??100)/100;
      const consumed=Object.fromEntries(nutritionFields.map(k=>[k,base[k]===null?null:base[k]!*portion])) as Nutrition;
      if(!finiteNonnegative(portion)||portion>1||m.baseNutrition!==undefined&&!storageNutritionEqual(base,m.baseNutrition)||!storageNutritionEqual(consumed,m.nutrition))throw new FoodStorageError('INVALID','Zero ingredient meal snapshot mismatch');
    }
    if(m.lines.some(l=>l.source==='batch')&&!m.leftoverBatchId&&m.recipeAllocations===undefined)throw new FoodStorageError('INVALID','Missing recipe inventory allocations');
    if(m.recipeAllocations!==undefined){
      if(m.leftoverBatchId)throw new FoodStorageError('INVALID','Preparation origins cannot also be direct allocations');
      if(m.source!=='recipe'||m.storageConsumption||!Array.isArray(m.recipeAllocations))throw new FoodStorageError('INVALID','Invalid recipe inventory allocations');
      const ids=new Set<string>();
      for(const a of m.recipeAllocations){const source=byId.get(a.batchId),receipt=txById.get(a.transactionId),line=m.lines.find(l=>l.lineId===a.lineId);
        if(!validStorageConsumption(a)||!positive(a.quantity)||!['g','fraction','serving'].includes(a.unit)||(a.unit==='serving')!==(source?.mode==='servings')||!validStorageNutrition(a.nutrition)||ids.has(a.lineId)||!line||line.source!=='batch'||line.sourceBatchId!==a.batchId||!source?.everUsed||receipt?.kind!=='meal'||receipt.mealId!==m.id||!receipt.batchIds.includes(a.batchId)||!storageNutritionEqual(a.nutrition,consumptionNutrition(source,a.originalFraction,a.stockBasis)))throw new FoodStorageError('INVALID','Invalid recipe allocation link or snapshot');
        if(!storageClose(a.originalFraction,a.quantity*(a.unit==='fraction'?1:source.fractionPerUnit))||!storageClose(a.originalFraction,line.quantity*(line.quantityBasis==='g'?source.fractionPerUnit:1)*(m.consumptionPercent??100)/100)||!storageNutritionEqual(a.nutrition,Object.fromEntries(nutritionFields.map(k=>[k,line.nutrition[k]===null?null:line.nutrition[k]!*(m.consumptionPercent??100)/100])) as Nutrition))throw new FoodStorageError('INVALID','Allocation differs from recipe line');
        ids.add(a.lineId);
      }
      const portion=(m.consumptionPercent??100)/100;
      if(!finiteNonnegative(portion)||portion>1||!m.baseNutrition||!storageNutritionEqual(m.baseNutrition,Object.fromEntries(nutritionFields.map(k=>[k,m.lines.some(l=>lineNutrition(l)[k]===null)?null:m.lines.reduce((sum,l)=>sum+lineNutrition(l)[k]!,0)])) as Nutrition))throw new FoodStorageError('INVALID','Invalid recipe portion snapshot');
      if(!storageNutritionEqual(m.nutrition,Object.fromEntries(nutritionFields.map(k=>[k,m.lines.some(l=>lineNutrition(l)[k]===null)?null:m.lines.reduce((sum,l)=>sum+lineNutrition(l)[k]!,0)*portion])) as Nutrition)||m.lines.some(l=>l.source==='batch'&&l.quantity>0&&portion>0&&!ids.has(l.lineId!)))throw new FoodStorageError('INVALID','Recipe allocations do not cover the consumed snapshot');
    }
    if (m.storageConsumption !== undefined) {
      const c = m.storageConsumption;
      const consumedBatch=byId.get(c.batchId);
      if(consumedBatch?.mode==='servings' && (m.unit!=='serving'||!positive(m.quantity)||!storageClose(m.quantity*consumedBatch.fractionPerUnit,c.originalFraction)))throw new FoodStorageError('INVALID','Invalid serving meal snapshot');
      if(c.stockBasis){
        const line=m.lines[0],source=byId.get(c.batchId);
        if(!source||m.lines.length!==1||line?.ingredientId!==c.stockBasis.ingredientId||line.unit!=='g'||!storageClose(line.quantity,c.originalFraction/source.fractionPerUnit)||!storageNutritionEqual(line.nutrition,m.nutrition))throw new FoodStorageError('INVALID','Invalid concrete stock meal snapshot');
      }
      if (!validStorageConsumption(c) || !byId.get(c.batchId)?.everUsed || txById.get(c.transactionId)?.kind !== 'meal' || txById.get(c.transactionId)?.mealId !== m.id || !txById.get(c.transactionId)?.batchIds.includes(c.batchId) || !storageNutritionEqual(m.nutrition, consumptionNutrition(byId.get(c.batchId)!,c.originalFraction,c.stockBasis))) throw new FoodStorageError('INVALID', 'Invalid meal inventory link');
    }
    if (m.leftoverInventoryUnchanged !== undefined && (m.leftoverInventoryUnchanged !== true || !m.leftoverBatchId || !transactions.some(t => (t.kind === 'edit-origin'||t.kind==='delete-meal'&&!!m.deletedAt) && t.mealId === m.id && t.targetBatchId === m.leftoverBatchId && JSON.parse(t.request).input?.strategy === 'meal-only'))) throw new FoodStorageError('INVALID', 'Unconfirmed leftover inventory correction');
    if (m.leftoverBatchId !== undefined && (!id(m.leftoverBatchId) || byId.get(m.leftoverBatchId)?.originMealId !== m.id || m.storageConsumption !== undefined)) throw new FoodStorageError('INVALID', 'Invalid initial leftover meal');
  }
}
