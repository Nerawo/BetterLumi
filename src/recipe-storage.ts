import {stamp} from './db';
import {scaleNutrition,type RecipeLine} from './domain';
import type {FoodBatch} from './food-storage-model';

/** A template quantity is always grams or a fraction of the ORIGINAL composition. */
export function storedRecipeLine(batch:FoodBatch,previous?:RecipeLine):RecipeLine {
 const basis=batch.mode==='weight'?'g':'original-fraction';
 const quantity=previous?.quantityBasis===basis?previous.quantity:batch.mode==='weight'?Math.min(100,batch.remainingQuantity):Math.min(1,batch.remainingQuantity);
 return {source:'batch',lineId:previous?.lineId??stamp().id,ingredientId:batch.id,sourceBatchId:batch.id,name:batch.name,quantityBasis:basis,quantity,unit:basis==='g'?'g':'fraction',nutrition:scaleNutrition(batch.totalNutrition,quantity*(basis==='g'?batch.fractionPerUnit:1))};
}
