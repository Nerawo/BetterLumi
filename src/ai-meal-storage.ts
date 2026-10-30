import {db} from './db';
import {newId} from './ids';
import {createAIMealDraft,validateAIMealDraft,type AIMealDraft} from './ai-meal-state';
import {stamp,type RecordBase} from './db';
import type {FoodLog} from './domain';
import {validLocalDate} from './routing';
import {aiMealTypes,type ParsedAIMealItem} from './ai-meal-model';
import {validateAIMealNutrition} from './ai-meal-parser';
/** Detached Quick Entry snapshot: actual nutrition is already consumed; fractions are descriptive only. */
export function createAIMealSnapshot(item:ParsedAIMealItem,language:'zh'|'en',identity:RecordBase=stamp()):FoodLog {
 if(!item.date||!validLocalDate(item.date)||item.mealType!==null&&!aiMealTypes.includes(item.mealType))throw Error('Resolve a valid meal date and supported meal type before saving');
 if(!item.name.trim())throw Error('Food name is required');
 if(typeof item.unit!=='string'||typeof item.estimated!=='boolean'||item.notes!==null&&typeof item.notes!=='string')throw Error('Invalid meal details');
 for(const value of [item.amount,item.weightG])if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<=0))throw Error('Resolve zero or invalid consumed amounts before saving');
 if(item.consumedFraction!==null&&(typeof item.consumedFraction!=='number'||!Number.isFinite(item.consumedFraction)||item.consumedFraction<0||item.consumedFraction>1))throw Error('Invalid consumed fraction');
 const nutrition=validateAIMealNutrition(item.nutrition),details:string[]=[];
 if(item.amount!==null)details.push(item.unit.trim()?String(item.amount)+' '+item.unit.trim():(language==='zh'?'数量 ':'Amount: ')+String(item.amount)+(language==='zh'?'（单位未提供）':' (unit not supplied)'));
 if(item.weightG!==null&&!(item.unit==='g'&&item.amount===item.weightG))details.push(String(item.weightG)+' g');
 if(item.consumedFraction!==null)details.push((language==='zh'?'原份量的 ':'Of original serving: ')+new Intl.NumberFormat(language,{maximumFractionDigits:4}).format(item.consumedFraction*100)+'%');
 const notes=[details.join(' · '),item.notes?.trim()].filter(Boolean).join('\n');
 return {...structuredClone(identity),date:item.date,category:item.mealType??'uncategorized',name:item.name.trim(),source:'quick',sourceId:null,quantity:1,unit:'entry',nutrition:{...nutrition},baseNutrition:{...nutrition},consumptionPercent:100,estimated:item.estimated,lines:[],cookingNote:notes};
}

// Drafts and import receipts use additive, string-valued settings in Backup 10.
export const AI_MEAL_RECEIPT_PREFIX='aiMealImport:v1:';
export const aiMealDraftKey=(id:string)=>draftKey(id);
export const AI_MEAL_DRAFT_PREFIX='aiMealDraft:v1:';
function draftKey(id:string){if(!id||id.length>100)throw Error('Invalid draft ID');return AI_MEAL_DRAFT_PREFIX+id}
export async function loadAIMealDraft(id:string):Promise<AIMealDraft|null> {
 const stored=await db.settings.get(draftKey(id));if(!stored)return null;
 const draft=validateAIMealDraft(JSON.parse(stored.value));if(draft.id!==id)throw Error('Stored draft identity mismatch');return draft;
}
/** Optimistic revision check is inside the write transaction, preventing stale tabs from overwriting drafts. */
export async function saveAIMealDraft(value:AIMealDraft):Promise<AIMealDraft> {
 const draft=validateAIMealDraft(value),key=draftKey(draft.id);
 return db.transaction('rw',db.settings,async()=>{
  if(draft.importId&&await db.settings.get(AI_MEAL_RECEIPT_PREFIX+draft.importId))throw Error('Draft was already imported');
  const previous=await db.settings.get(key);
  if(previous){const stored=validateAIMealDraft(JSON.parse(previous.value));if(stored.id!==draft.id||stored.revision!==draft.revision||(stored.importId!==undefined&&stored.importId!==draft.importId))throw Error('Draft changed in another session; reload before saving')}
  else if(draft.revision!==0)throw Error('Draft was removed; reload before saving');
  const saved={...draft,importId:draft.importId??newId(),revision:draft.revision+1};await db.settings.put({key,value:JSON.stringify(saved)});return saved;
 });
}

/** Explicit discard fences stale autosaves without deleting receipts, unrelated drafts, or historical meals. */
export async function discardAIMealDraft(value:AIMealDraft):Promise<void>{
 const draft=validateAIMealDraft(value),key=draftKey(draft.id);
 await db.transaction('rw',db.settings,async()=>{
  const previous=await db.settings.get(key);if(!previous){if(draft.revision!==0)throw Error('Draft was removed');return}
  const stored=validateAIMealDraft(JSON.parse(previous.value));
  if(stored.id!==draft.id||stored.revision!==draft.revision||stored.importId!==draft.importId)throw Error('Draft changed before discard');
  await db.settings.put({key,value:JSON.stringify({...createAIMealDraft('',draft.id),revision:draft.revision+1})});
 });
}
