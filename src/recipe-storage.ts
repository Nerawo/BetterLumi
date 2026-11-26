import {stamp} from './db';
import {scaleNutrition,type FoodLog,type RecipeLine} from './domain';
import {zeroNutrition} from './line-nutrition';
import {historicalBasisForLine,storageNutritionEqual,type FoodBatch} from './food-storage-model';

/** A template quantity is always grams or a fraction of the ORIGINAL composition. */
export function storedRecipeLine(batch:FoodBatch,previous?:RecipeLine):RecipeLine {
 const basis=batch.mode==='weight'?'g':'original-fraction';
 const quantity=previous?.quantityBasis===basis?previous.quantity:batch.mode==='weight'?Math.min(100,batch.remainingQuantity):Math.min(1,batch.remainingQuantity);
 return {source:'batch',lineId:previous?.lineId??stamp().id,ingredientId:batch.id,sourceBatchId:batch.id,name:batch.name,quantityBasis:basis,quantity,unit:basis==='g'?'g':'fraction',nutrition:quantity===0?zeroNutrition():scaleNutrition(batch.totalNutrition,quantity*(basis==='g'?batch.fractionPerUnit:1)),...(quantity===0?{zeroQuantityReference:{quantity:1,nutrition:scaleNutrition(batch.totalNutrition,basis==='g'?batch.fractionPerUnit:1)}}:{})};
}

/** A zero-consumption meal has no allocation against which to freeze a later first debit. */
export function needsFirstAllocationReview(initial:FoodLog|undefined,line:RecipeLine,batch:FoodBatch|undefined,percent:number){
 if(!initial||initial.source!=='recipe'||initial.leftoverBatchId||initial.consumptionPercent!==0||initial.recipeAllocations?.length||
    percent<=0||line.source!=='batch'||line.quantity<=0||!batch||historicalBasisForLine(initial,line)||line.sourceBatchId!==batch.id)return false;
 const original=initial.lines.find(l=>l.lineId===line.lineId&&l.sourceBatchId===batch.id);
 if(!original)return false;
 const factor=batch.fractionPerUnit;
 const changed=(l:RecipeLine)=>!storageNutritionEqual(l.nutrition,scaleNutrition(batch.totalNutrition,l.quantity*(l.quantityBasis==='g'?factor:1)));
 return changed(original)&&changed(line);
}
