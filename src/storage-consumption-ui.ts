import {percentageFraction,type FoodBatch,type StorageTransaction} from './food-storage-model';

/** All positions on the inventory track are measured in the batch's inventory units. */
export function consumptionView(batch:FoodBatch,available:number,amount:string,ofOriginal=false,frozenQuantity?:number){
 const original=batch.mode==='weight'?(batch.originalCookedYield??1/batch.fractionPerUnit):(batch.totalServings??1);
 const input=amount.trim()===''?NaN:Number(amount);
 const selected=frozenQuantity??(batch.mode==='ratio'?percentageFraction(input,available,ofOriginal):input);
 const valid=Number.isFinite(selected)&&selected>=0&&selected<=available;
 const axis=Math.max(original,available),shown=valid?selected:0;
 return {original,axis,selected,valid,percent:selected/original*100,overflow:Math.max(0,available-original),selectedWidth:shown/axis*100,availableWidth:(available-shown)/axis*100,unavailableWidth:Math.max(0,axis-available)/axis*100};
}
export const gramDisplay=(amount:string)=>amount.trim()===''?'':Number.isFinite(Number(amount))?String(Math.round(Number(amount)*10)/10):amount;
/** Normalize a new selection without ever rounding the available inventory upward. */
export const newConsumptionGrams=(value:number,available:number)=>Math.min(Math.round(value*10)/10,Math.floor(available*10)/10);
export function sliderAmount(batch:FoodBatch,available:number,value:number,ofOriginal=false){
 const selected=Math.max(0,Math.min(available,value));
 return String(batch.mode==='weight'?newConsumptionGrams(selected,available):batch.mode==='servings'?selected:ofOriginal?selected*100:available>0?selected/available*100:0);
}
/** Only original new-meal receipts count. Editing, deletion and failed writes never replace memory. */
export function lastConsumedGrams(batchId:string,history:StorageTransaction[]):number|undefined{
 const candidates=history.filter(tx=>!tx.deletedAt&&tx.kind==='meal'&&tx.targetBatchId===batchId).flatMap(tx=>{
  try{const input=JSON.parse(tx.request).input;
   if(input.batchId!==batchId||input.expectedRevision!==undefined||input.portion?.unit!=='g'||typeof input.portion.quantity!=='number'||!Number.isFinite(input.portion.quantity)||input.portion.quantity<=0)return [];
   return [{id:tx.id,date:tx.createdAt,quantity:input.portion.quantity}];
  }catch{return []}
 }).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const latest=candidates[0];
 // Old receipts have no sequence number. Do not guess between conflicting same-time amounts.
 if(latest&&candidates.some(c=>c.date===latest.date&&c.quantity!==latest.quantity))return undefined;
 return latest?.quantity;
}
export const consumptionMemoryKey=(batchId:string)=>'storage:last-consumption:'+batchId;
export function rememberedGrams(value:unknown):number|undefined {let parsed=value;try{if(typeof value==='string')parsed=JSON.parse(value)}catch{return undefined}const v=parsed as {version?:number;grams?:unknown}|null;return v?.version===1&&typeof v.grams==='number'&&Number.isFinite(v.grams)&&v.grams>0?v.grams:undefined}
export function initialConsumptionAmount(batch:FoodBatch,available:number,ownFraction:number|undefined,history:StorageTransaction[],memory?:unknown,savedGrams?:number,receipt?:{transactionId:string;mealId:string},ofOriginal=false){
 if(ownFraction!==undefined){
   if(batch.mode!=='ratio')return String(savedGrams??ownFraction/batch.fractionPerUnit);
   if(ofOriginal)return String(ownFraction*100);
   const transaction=history.find(t=>t.id===receipt?.transactionId&&t.mealId===receipt?.mealId&&t.kind==='meal'&&t.targetBatchId===batch.id);
   try {
     const input=JSON.parse(transaction?.request??'').input;
     if(input.batchId===batch.id&&input.mealId===receipt?.mealId&&input.portion?.unit==='percent'&&Number.isFinite(input.portion.quantity)&&input.portion.quantity>0&&input.portion.quantity<=100)return String(input.portion.quantity);
   }catch { /* Legacy receipts can be opaque. */ }
   return '';
 }
 return String(batch.mode==='weight'?newConsumptionGrams(rememberedGrams(memory)??lastConsumedGrams(batch.id,history)??100,available):batch.mode==='servings'?Math.min(1,available):ofOriginal?Math.min(100,available*100):100);
}
