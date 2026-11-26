import {db,ingredientNutrition,scaleNutrition,type RecipeLine,type PantryItem} from './domain';
import type {FoodBatch} from './food-storage-model';
/** Detached display basis. Frozen batch composition stays in IndexedDB. */
export function stockView(batch:FoodBatch,items:PantryItem[]):FoodBatch{
 if(batch.stock?.kind!=='pantry-ingredient')return batch;
 const item=items.find(i=>i.id===batch.stock!.ingredientId&&!i.deletedAt);
 return {...batch,totalNutrition:item?ingredientNutrition(item,1/batch.fractionPerUnit,'g'):{calories:null,protein:null,carbs:null,fat:null}};
}
export async function stockViews(){
 const batches=await db.foodBatches.toArray();
 if(!batches.some(b=>b.stock))return batches;
 const items=await db.ingredients.toArray();
 return batches.map(b=>stockView(b,items));
}

/** Only explicit raw-stock links acquire a new display basis. */
export function liveStockLines(lines:RecipeLine[],views:FoodBatch[]){
 const live=new Map(views.filter(batch=>batch.stock?.kind==='pantry-ingredient').map(batch=>[batch.id,batch]));
 return lines.map(line=>{
  const batch=line.source==='batch'&&line.sourceBatchId?live.get(line.sourceBatchId):undefined;
  if(!batch)return line;
  const perUnit=line.quantityBasis==='g'?batch.fractionPerUnit:1;
  return {...line,nutrition:scaleNutrition(batch.totalNutrition,line.quantity*perUnit),...(line.quantity===0?{zeroQuantityReference:{quantity:1,nutrition:scaleNutrition(batch.totalNutrition,perUnit)}}:{})};
 });
}
