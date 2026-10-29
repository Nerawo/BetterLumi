import {nutrientKeys,scaleNutrition,unknownNutrition,type Nutrition} from './domain';
import {newId} from './ids';
import {AI_MEAL_FORMAT,AI_MEAL_VERSION,type ParsedAIMealItem} from './ai-meal-model';
import {AI_MEAL_LIMITS,parseAIMealResponse,validateAIMealNutrition,aiMealTotals} from './ai-meal-parser';

export interface AIMealBaseline {
 kind:'ai'|'pantry'|'recipe';id:string|null;name:string;
 amount:number|null;unit:string;weightG:number|null;nutrition:Nutrition;estimated:boolean;
}
export interface AIMealDraftRow {
 original:ParsedAIMealItem;item:ParsedAIMealItem;baseline:AIMealBaseline;splitParent?:string;
 overrides:Partial<Nutrition>;scaling:'amount'|'weight';status:'ready'|'unresolved-portion';
}
export interface AIMealDraft {version:1;id:string;revision:number;importId?:string;raw:string;rows:AIMealDraftRow[];parseError:string|null;splits?:Record<string,AIMealDraftRow>}
export type AIMealPortion=Pick<ParsedAIMealItem,'amount'|'unit'|'weightG'>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const numeric=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const positive=(n:unknown):n is number=>numeric(n)&&n>0;
/** Only unambiguous measurement synonyms; never infer density or a serving weight. */
export function canonicalAIMealUnit(unit:string):string {
 const key=unit.normalize('NFKC').trim().toLowerCase();
 if(['g','克','gram','grams'].includes(key))return 'g';
 if(['ml','毫升','milliliter','milliliters','millilitre','millilitres'].includes(key))return 'mL';
 if(['serving','servings','份'].includes(key))return 'serving';
 return key;
}
function parsedItem(item:ParsedAIMealItem):ParsedAIMealItem {
 const {path,...value}=item;
 if(typeof path!=='string'||!/^\$\.meals\.\d+\.items\.\d+(?:\.split\.\d+)?$/.test(path))throw Error('Invalid draft row path');
 const parsed=parseAIMealResponse(JSON.stringify({format:AI_MEAL_FORMAT,version:AI_MEAL_VERSION,meals:[{date:null,mealType:null,items:[value]}]},(_key,value)=>{if(typeof value==='number'&&!Number.isFinite(value))throw Error('Invalid non-finite draft value');return value})).items[0];
 return {...parsed,path};
}
function validateBaseline(b:AIMealBaseline):AIMealBaseline {
 if(!b||!['ai','pantry','recipe'].includes(b.kind)||typeof b.name!=='string'||!b.name.trim()||b.name.length>AI_MEAL_LIMITS.name||typeof b.unit!=='string'||b.unit.length>AI_MEAL_LIMITS.unit||typeof b.estimated!=='boolean'||(b.amount!==null&&!numeric(b.amount))||(b.weightG!==null&&!numeric(b.weightG))||(b.kind==='ai'?b.id!==null:typeof b.id!=='string'||!b.id))throw Error('Invalid draft nutrition baseline');
 return {...structuredClone(b),nutrition:validateAIMealNutrition(b.nutrition)};
}
function baselineFor(item:ParsedAIMealItem):AIMealBaseline {
 return {kind:'ai',id:null,name:item.name,amount:item.amount,unit:item.unit,weightG:item.weightG,nutrition:{...item.nutrition},estimated:item.estimated};
}
function factorFor(b:AIMealBaseline,p:AIMealPortion,scaling:'amount'|'weight'):number|null {
 // Preserve the original consumed snapshot even when its amount is unknown or zero.
 if(b.kind==='ai'&&b.amount===p.amount&&b.unit===p.unit&&b.weightG===p.weightG)return 1;
 if(scaling==='weight')return positive(b.weightG)&&numeric(p.weightG)?p.weightG/b.weightG:null;
 if(positive(b.amount)&&numeric(p.amount)&&b.unit&&canonicalAIMealUnit(b.unit)===canonicalAIMealUnit(p.unit))return p.amount/b.amount;
 const grams=canonicalAIMealUnit(p.unit)==='g'&&numeric(p.amount)?p.amount:p.weightG;
 if(positive(b.weightG)&&numeric(grams))return grams/b.weightG;
 return null;
}
function calculate(row:AIMealDraftRow):AIMealDraftRow {
 const ratio=factorFor(row.baseline,row.item,row.scaling);
 if(ratio!==null&&!numeric(ratio))throw Error('Nutrition scaling overflow');
 const scaled=ratio===null?unknownNutrition():validateAIMealNutrition(scaleNutrition(row.baseline.nutrition,ratio));
 const nutrition=validateAIMealNutrition({...scaled,...row.overrides});
 return {...row,status:ratio===null?'unresolved-portion':'ready',item:{...row.item,nutrition,estimated:row.baseline.estimated||Object.keys(row.overrides).length>0}};
}
export function createAIMealDraftRow(item:ParsedAIMealItem):AIMealDraftRow {
 const original=parsedItem(item);return calculate({original:structuredClone(original),item:structuredClone(original),baseline:baselineFor(original),overrides:{},scaling:'amount',status:'ready'});
}
/** Empty amount buffers remain null. Invalid numeric text is rejected before reaching this boundary. */
export function editAIMealDraftRow(row:AIMealDraftRow,patch:Partial<Pick<ParsedAIMealItem,'name'|'date'|'mealType'|'notes'|'amount'|'unit'|'weightG'>>):AIMealDraftRow {
 const next=structuredClone(row);next.item=parsedItem({...next.item,...patch});
 // Weight is dependent on quantity. Do not retain an old weight after an incompatible edit.
 if('amount' in patch||'unit' in patch){
  next.scaling='amount';
  if(!('weightG' in patch)){
   const b=next.baseline,p=next.item;
   next.item.weightG=canonicalAIMealUnit(p.unit)==='g'?p.amount:positive(b.amount)&&numeric(p.amount)&&numeric(b.weightG)&&canonicalAIMealUnit(p.unit)===canonicalAIMealUnit(b.unit)?b.weightG*p.amount/b.amount:null;
  }
 }else if('weightG' in patch)next.scaling='weight';
 next.item=parsedItem(next.item);
 return calculate(next);
}
export function editAIMealDraftNutrition(row:AIMealDraftRow,patch:Partial<Nutrition>):AIMealDraftRow {
 for(const key of Object.keys(patch))if(!nutrientKeys.includes(key as keyof Nutrition))throw Error('Unknown nutrient');
 const next=structuredClone(row);next.overrides={...next.overrides,...patch};validateAIMealNutrition({...next.item.nutrition,...next.overrides});return calculate(next);
}
/** Source selection is explicit. Matching alone never changes the draft's AI estimate. */
export function selectAIMealDraftSource(row:AIMealDraftRow,source:AIMealBaseline,portion:AIMealPortion,confirmDiscardManual=false):AIMealDraftRow {
 if(Object.keys(row.overrides).length&&!confirmDiscardManual)throw Error('Confirm replacing manual nutrition before changing source');
 const next=structuredClone(row);next.baseline=validateBaseline(source);next.overrides={};next.scaling='amount';next.item=parsedItem({...next.item,...portion});
 const result=calculate(next);if(result.status!=='ready')throw Error('Resolve the consumed amount and source unit explicitly');return result;
}
export function recalculateAIMealDraftRow(row:AIMealDraftRow):AIMealDraftRow {return calculate({...structuredClone(row),overrides:{}})}
export function restoreAIMealEstimate(row:AIMealDraftRow):AIMealDraftRow {return {...createAIMealDraftRow(row.original),...(row.splitParent?{splitParent:row.splitParent}:{})}}
export function createAIMealDraft(raw='',id=newId()):AIMealDraft {return parseAIMealDraft({version:1,id,revision:0,importId:newId(),raw,rows:[],parseError:null})}
/** Explicit parse action; a bad paste retains the last valid, edited preview for recovery. */
export function parseAIMealDraft(draft:AIMealDraft):AIMealDraft {
 const next=structuredClone(draft);if(!next.raw.trim()){next.parseError='Paste the AI response first';return next}
 try{next.rows=parseAIMealResponse(next.raw).items.map(createAIMealDraftRow);next.parseError=null;next.splits={}}catch(error){next.parseError=error instanceof Error?error.message:'Invalid AI response'}return next;
}
export const aiMealDraftTotals=(draft:AIMealDraft)=>aiMealTotals(draft.rows.map(row=>row.item));
/** Unresolved items stay flat, outside complete date/meal groups. No default context is assigned. */
export function groupAIMealDraft(draft:AIMealDraft) {
 const groups=new Map<string,{date:string;mealType:NonNullable<ParsedAIMealItem['mealType']>;rows:AIMealDraftRow[]}>(),unresolved:AIMealDraftRow[]=[];
 for(const row of structuredClone(draft.rows)){const {date,mealType}=row.item;if(!date||!mealType){unresolved.push(row);continue}const key=date+':'+mealType,group=groups.get(key)??{date,mealType,rows:[]};group.rows.push(row);groups.set(key,group)}return {groups:[...groups.values()],unresolved};
}
/** Validate persisted drafts without coercion, deleting bad data, or consulting changing reference records. */
export function validateAIMealDraft(value:unknown):AIMealDraft {
 if(!value||typeof value!=='object')throw Error('Invalid AI meal draft');const d=value as AIMealDraft;
 if(d.version!==1||typeof d.id!=='string'||!d.id||d.id.length>100||!Number.isSafeInteger(d.revision)||d.revision<0||typeof d.raw!=='string'||d.raw.length>AI_MEAL_LIMITS.text||!Array.isArray(d.rows)||d.rows.length>AI_MEAL_LIMITS.items||(d.parseError!==null&&typeof d.parseError!=='string'))throw Error('Invalid AI meal draft');
 if(d.importId!==undefined&&(typeof d.importId!=='string'||!/^[-A-Za-z0-9]{1,100}$/.test(d.importId)))throw Error('Invalid import identity');
 const rows=d.rows.map(row=>{
  const original=parsedItem(row.original),item=parsedItem(row.item),baseline=validateBaseline(row.baseline);
  if(!['amount','weight'].includes(row.scaling)||original.path!==item.path||!row.overrides||typeof row.overrides!=='object'||Array.isArray(row.overrides))throw Error('Invalid draft row');
  for(const key of Object.keys(row.overrides))if(!nutrientKeys.includes(key as keyof Nutrition))throw Error('Invalid nutrient override');
  validateAIMealNutrition({...unknownNutrition(),...row.overrides});
  if(baseline.kind==='ai'&&!same(baseline,baselineFor(original)))throw Error('AI baseline differs from original estimate');
  if(row.splitParent!==undefined&&(typeof row.splitParent!=='string'||!item.path.startsWith(row.splitParent+'.split.')))throw Error('Invalid split parent');
  const calculated=calculate({original,item,baseline,...(row.splitParent?{splitParent:row.splitParent}:{}),overrides:structuredClone(row.overrides),scaling:row.scaling,status:row.status});
  if(row.status!==calculated.status||!nutrientKeys.every(k=>item.nutrition[k]===calculated.item.nutrition[k])||item.estimated!==calculated.item.estimated)throw Error('Draft nutrition differs from its baseline and overrides');return calculated;
 });
 if(new Set(rows.map(row=>row.item.path)).size!==rows.length)throw Error('Duplicate draft row');aiMealTotals(rows.map(row=>row.item));
 const splits:Record<string,AIMealDraftRow>={};
 if(d.splits!==undefined){
  if(!d.splits||typeof d.splits!=='object'||Array.isArray(d.splits)||Object.keys(d.splits).length>AI_MEAL_LIMITS.items)throw Error('Invalid split history');
  for(const [key,parent] of Object.entries(d.splits)){
   if(!/^\$\.meals\.\d+\.items\.\d+$/.test(key)||parent.splitParent||parent.item.path!==key||rows.some(r=>r.item.path===key))throw Error('Invalid split history');
   splits[key]=validateAIMealDraft({version:1,id:d.id,revision:d.revision,raw:'',rows:[parent],parseError:null}).rows[0];
  }
 }
 for(const row of rows)if(row.splitParent&&!splits[row.splitParent])throw Error('Missing split history');
 return {version:1,id:d.id,revision:d.revision,...(d.importId?{importId:d.importId}:{}),raw:d.raw,rows,parseError:d.parseError,...(d.splits!==undefined?{splits}:{})};
}
