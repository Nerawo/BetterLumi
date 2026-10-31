import type {FoodBatch,StorageTransaction} from './food-storage-model';

/** View coordinates only. Ratio input retains its existing percent-of-available semantics. */
export function consumptionView(batch:FoodBatch,available:number,amount:string){
 const original=batch.mode==='weight'?(batch.originalCookedYield??1/batch.fractionPerUnit):1;
 const input=amount.trim()===''?NaN:Number(amount);
 const selected=batch.mode==='weight'?input:available*input/100;
 const valid=Number.isFinite(selected)&&selected>=0&&selected<=available;
 const axis=Math.max(original,available),shown=valid?selected:0;
 return {original,axis,selected,valid,percent:selected/original*100,overflow:Math.max(0,available-original),selectedWidth:shown/axis*100,availableWidth:(available-shown)/axis*100,unavailableWidth:Math.max(0,axis-available)/axis*100};
}
export function sliderAmount(batch:FoodBatch,available:number,value:number){
 const selected=Math.max(0,Math.min(available,value));
 return String(batch.mode==='weight'?selected:available>0?selected/available*100:0);
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
export function initialConsumptionAmount(batch:FoodBatch,available:number,ownFraction:number|undefined,history:StorageTransaction[],memory?:unknown,savedGrams?:number){
 if(ownFraction!==undefined)return String(batch.mode==='weight'?(savedGrams??ownFraction/batch.fractionPerUnit):available>0?ownFraction/(available*batch.fractionPerUnit)*100:0);
 return String(batch.mode==='weight'?Math.min(rememberedGrams(memory)??lastConsumedGrams(batch.id,history)??100,available):100);
}
