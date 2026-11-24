import {stamp} from './db';
import {scaleNutrition,type RecipeLine} from './domain';
import {zeroNutrition} from './line-nutrition';
import type {FoodBatch} from './food-storage-model';

/** A template quantity is always grams or a fraction of the ORIGINAL composition. */
export function storedRecipeLine(batch:FoodBatch,previous?:RecipeLine):RecipeLine {
 const basis=batch.mode==='weight'?'g':'original-fraction';
 const quantity=previous?.quantityBasis===basis?previous.quantity:batch.mode==='weight'?Math.min(100,batch.remainingQuantity):Math.min(1,batch.remainingQuantity);
 return {source:'batch',lineId:previous?.lineId??stamp().id,ingredientId:batch.id,sourceBatchId:batch.id,name:batch.name,quantityBasis:basis,quantity,unit:basis==='g'?'g':'fraction',nutrition:quantity===0?zeroNutrition():scaleNutrition(batch.totalNutrition,quantity*(basis==='g'?batch.fractionPerUnit:1)),...(quantity===0?{zeroQuantityReference:{quantity:1,nutrition:scaleNutrition(batch.totalNutrition,basis==='g'?batch.fractionPerUnit:1)}}:{})};
}
