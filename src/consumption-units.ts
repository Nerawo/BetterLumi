import type {Ingredient} from './db';
export interface ConsumptionUnit {
  quantity: number;
  name: string;
  amount: number;
  unit: 'g' | 'mL';
}
export function validConsumptionUnit(value: unknown): value is ConsumptionUnit {
  if (!value || typeof value !== 'object') return false;
  const v = value as ConsumptionUnit;
  return typeof v.name === 'string' && v.name.trim() === v.name && v.name.length > 0 && v.name.length <= 40 &&
    !['g','ml','serving'].includes(v.name.toLowerCase()) &&
    Number.isFinite(v.quantity) && v.quantity > 0 && Number.isFinite(v.amount) && v.amount > 0 &&
    ['g','mL'].includes(v.unit) && Number.isFinite(v.amount / v.quantity) && v.amount / v.quantity > 0;
}
export function ingredientBaseUnit(i: Pick<Ingredient,'basis'|'referenceUnit'|'servingUnit'>) {
  return i.basis === 'serving' ? (i.servingUnit ?? 'g') : (i.referenceUnit ?? 'g');
}

/** A manual unit switch chooses a convenient default, not an equivalent amount. */
export function defaultIngredientQuantity(i: Ingredient | undefined, unit: string): number {
  if (unit !== 'g' && unit !== 'mL') return 1;
  if (!i || unit !== ingredientBaseUnit(i)) return 100;
  const amount = i.basis === 'serving' ? i.servingGrams : (i.referenceAmount ?? 100);
  return amount != null && Number.isFinite(amount) && amount > 0 ? amount : 100;
}
