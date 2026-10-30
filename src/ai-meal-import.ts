import {db,stamp} from './db';
import {foodLogs,nutrientKeys,type FoodLog} from './domain';
import {validLocalDate} from './routing';
import {aiMealTypes} from './ai-meal-model';
import {createAIMealDraft,validateAIMealDraft,type AIMealDraft} from './ai-meal-state';
import {AI_MEAL_RECEIPT_PREFIX,aiMealDraftKey,createAIMealSnapshot} from './ai-meal-storage';
export type AIImportIssueCode='empty'|'date'|'type'|'amount'|'unit'|'weight'|'nutrition'|'name'|'portion'|'split'|'draft'|'parse';
export interface AIImportIssue {path:string|null;code:AIImportIssueCode;name:string}
export interface AIImportReceipt {version:1;importId:string;draftId:string;request:string;createdAt:string;latestDate:string;records:{id:string;date:string;category:string}[]}
export class AIImportError extends Error {
 constructor(readonly code:'invalid'|'duplicate'|'conflict',readonly paths:string[]=[]){super(code);this.name='AIImportError'}
}
/** Checks final effective rows only: split-history parents and suggestions are never imported. */
export function aiMealImportIssues(draft:AIMealDraft):AIImportIssue[]{
 const issues:AIImportIssue[]=[],add=(code:AIImportIssueCode,path:string|null=null,name='')=>issues.push({code,path,name});
 if(!draft.rows.length)add('empty');if(draft.parseError)add('parse');
 for(const row of draft.rows){const i=row.item,p=i.path,n=i.name;
  if(!i.name.trim())add('name',p,n);
  if(!i.date||!validLocalDate(i.date))add('date',p,n);
  if(i.mealType!==null&&!aiMealTypes.includes(i.mealType))add('type',p,n);
  if(typeof i.amount!=='number'||!Number.isFinite(i.amount)||i.amount<=0)add('amount',p,n);
  if(typeof i.unit!=='string'||!i.unit.trim())add('unit',p,n);
  if(i.weightG!==null&&(typeof i.weightG!=='number'||!Number.isFinite(i.weightG)||i.weightG<=0))add('weight',p,n);
  if(nutrientKeys.some(k=>i.nutrition[k]!==null&&(typeof i.nutrition[k]!=='number'||!Number.isFinite(i.nutrition[k])||i.nutrition[k]!<0)))add('nutrition',p,n);
  if(row.status!=='ready')add('portion',p,n);
 }
 for(const parent of Object.keys(draft.splits??{}))if(!draft.rows.some(r=>r.splitParent===parent)||draft.rows.some(r=>r.item.path===parent))add('split',null,draft.splits![parent].item.name);
 try{validateAIMealDraft(draft)}catch{if(!issues.length)add('draft')}
 return issues;
}
const nameKey=(s:string)=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function possibleAIMealDuplicates(draft:AIMealDraft,existing:FoodLog[]):string[]{
 return draft.rows.filter(({item})=>existing.some(log=>!log.deletedAt&&log.date===item.date&&log.category===(item.mealType??'uncategorized')&&nameKey(log.name)===nameKey(item.name))).map(r=>r.item.path);
}
function requestFor(draft:AIMealDraft){return JSON.stringify(draft.rows.map(({item:i})=>[i.name,i.date,i.mealType,i.amount,i.unit,i.weightG,i.consumedFraction,i.nutrition.calories,i.nutrition.protein,i.nutrition.carbs,i.nutrition.fat,i.estimated,i.notes]))}
function readReceipt(value:string,id:string):AIImportReceipt {
 const r=JSON.parse(value) as AIImportReceipt;
 if(!r||r.version!==1||r.importId!==id||typeof r.draftId!=='string'||typeof r.request!=='string'||!validLocalDate(r.latestDate)||typeof r.createdAt!=='string'||!Array.isArray(r.records)||!r.records.length||r.records.some(x=>typeof x.id!=='string'||!x.id.startsWith('ai-meal:'+id+':')||!validLocalDate(x.date)||!['uncategorized',...aiMealTypes].includes(x.category as typeof aiMealTypes[number]))||new Set(r.records.map(x=>x.id)).size!==r.records.length||r.records.map(x=>x.date).sort().at(-1)!==r.latestDate)throw new AIImportError('conflict');return r;
}
export async function hasAIMealImportReceipt(id:string|undefined):Promise<boolean>{if(!id)return false;const row=await db.settings.get(AI_MEAL_RECEIPT_PREFIX+id);if(!row)return false;readReceipt(row.value,id);return true}
/** All identities and detached snapshots are prepared before entering Dexie's minimal transaction.
 * The canonical request also works on LAN HTTP without relying on crypto.subtle.
 */
export async function importAIMeals(value:AIMealDraft,language:'zh'|'en',allowDuplicates=false):Promise<{receipt:AIImportReceipt;nextDraft:AIMealDraft;replayed:boolean}>{
 if(aiMealImportIssues(value).length)throw new AIImportError('invalid');
 const draft=validateAIMealDraft(value);if(!draft.importId)throw new AIImportError('conflict');
 const importId=draft.importId,request=requestFor(draft),key=aiMealDraftKey(draft.id),receiptKey=AI_MEAL_RECEIPT_PREFIX+importId;
 const records=draft.rows.map((row,index)=>createAIMealSnapshot(row.item,language,{...stamp(),id:'ai-meal:'+importId+':'+index}));
 const nextDraft={...createAIMealDraft('',draft.id),revision:draft.revision+1};
 const receipt:AIImportReceipt={version:1,importId,draftId:draft.id,request,createdAt:new Date().toISOString(),latestDate:records.map(r=>r.date).sort().at(-1)!,records:records.map(({id,date,category})=>({id,date,category}))};
 return db.transaction('rw',[foodLogs,db.settings],async()=>{
  const committed=await db.settings.get(receiptKey);
  if(committed){const old=readReceipt(committed.value,importId);if(old.version!==1||old.importId!==importId||old.draftId!==draft.id||old.request!==request)throw new AIImportError('conflict');const current=await db.settings.get(key);if(!current)throw new AIImportError('conflict');return {receipt:old,nextDraft:validateAIMealDraft(JSON.parse(current.value)),replayed:true}}
  const stored=await db.settings.get(key);
  if(!stored||JSON.stringify(validateAIMealDraft(JSON.parse(stored.value)))!==JSON.stringify(draft))throw new AIImportError('conflict');
  const existing=await foodLogs.where('date').anyOf([...new Set(records.map(r=>r.date))]).toArray(),duplicates=possibleAIMealDuplicates(draft,existing);
  if(duplicates.length&&!allowDuplicates)throw new AIImportError('duplicate',duplicates);
  await foodLogs.bulkAdd(records); // add, never put: an unexpected identity collision aborts the entire transaction.
  await db.settings.add({key:receiptKey,value:JSON.stringify(receipt)});
  await db.settings.put({key,value:JSON.stringify(nextDraft)});
  return {receipt,nextDraft,replayed:false};
 });
}
