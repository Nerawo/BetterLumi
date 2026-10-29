import {validLocalDate} from './routing';
import {aiMealTypes} from './ai-meal-model';
import {createAIMealDraftRow,validateAIMealDraft,type AIMealDraft,type AIMealDraftRow} from './ai-meal-state';
import type {AIConsumedPortion,ParsedAIMealItem} from './ai-meal-model';

export function splitSuggestionRows(parent:AIMealDraftRow):AIMealDraftRow[]{
 return parent.item.splitSuggestions.map((part,i)=>newSplitComponent(parent,part,i));
}
export function newSplitComponent(parent:AIMealDraftRow,part:AIConsumedPortion,index:number):AIMealDraftRow {
 if(parent.splitParent)throw Error('Nested splits are unsupported');
 const item:ParsedAIMealItem={...structuredClone(part),date:parent.item.date,mealType:parent.item.mealType,consumedFraction:null,notes:null,splitSuggestions:[],path:parent.item.path+'.split.'+index};
 return {...createAIMealDraftRow(item),splitParent:parent.item.path};
}
export function acceptAIMealSplit(draft:AIMealDraft,parent:AIMealDraftRow,components:AIMealDraftRow[]):AIMealDraft {
 if(parent.splitParent||!components.length||!draft.rows.some(r=>r.item.path===parent.item.path))throw Error('Invalid split');
 const next=structuredClone(draft),at=next.rows.findIndex(r=>r.item.path===parent.item.path);
 next.splits={...next.splits,[parent.item.path]:structuredClone(parent)};
 const previous=next.rows[at].item;
 next.rows.splice(at,1,...structuredClone(components).map(row=>({...row,splitParent:parent.item.path,item:{...row.item,...(row.item.date===previous.date&&row.item.mealType===previous.mealType?{date:parent.item.date,mealType:parent.item.mealType}:{})}})));return validateAIMealDraft(next);
}
export function undoAIMealSplit(draft:AIMealDraft,parentPath:string):AIMealDraft {
 const next=structuredClone(draft),parent=next.splits?.[parentPath];if(!parent)throw Error('Split history missing');
 const at=next.rows.findIndex(row=>row.splitParent===parentPath);next.rows=next.rows.filter(row=>row.splitParent!==parentPath);next.rows.splice(at<0?next.rows.length:at,0,parent);delete next.splits![parentPath];return validateAIMealDraft(next);
}
export interface AIMealGroupTarget {date:string;mealType:NonNullable<ParsedAIMealItem['mealType']>}
export function moveAIMealRow(draft:AIMealDraft,path:string,target:AIMealGroupTarget|null,beforePath?:string):AIMealDraft {
 const next=structuredClone(draft),index=next.rows.findIndex(row=>row.item.path===path);if(index<0)throw Error('Missing draft row');
 if(beforePath===path)return next;
 const [row]=next.rows.splice(index,1);row.item={...row.item,date:target?.date??row.item.date,mealType:target?.mealType??null};
 const at=beforePath?next.rows.findIndex(row=>row.item.path===beforePath):-1;next.rows.splice(at<0?next.rows.length:at,0,row);return validateAIMealDraft(next);
}
export function editAIMealGroupDate(draft:AIMealDraft,target:AIMealGroupTarget,date:string):AIMealDraft {
 const next=structuredClone(draft);next.rows=next.rows.map(row=>row.item.date===target.date&&row.item.mealType===target.mealType?{...row,item:{...row.item,date}}:row);return validateAIMealDraft(next);
}

/** Informational only: never drop or merge suspicious entries automatically. */
export function aiMealPreviewWarnings(draft:AIMealDraft):Record<string,'zero'|'duplicate'> {
 const warnings:Record<string,'zero'|'duplicate'>={},seen=new Set<string>();
 for(const row of draft.rows){const i=row.item,key=JSON.stringify([i.date,i.mealType,i.name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')]);
  if(i.amount===0||i.weightG===0||i.consumedFraction===0||Object.values(i.nutrition).every(n=>n===0))warnings[i.path]='zero';
  if(seen.has(key))warnings[i.path]='duplicate';seen.add(key);
 }return warnings;
}

/** Explicit action fills missing context only; supplied values and nutrition remain untouched. */
export function assignMissingAIMealContext(draft:AIMealDraft,context:{date?:string;mealType?:typeof aiMealTypes[number]}):AIMealDraft {
 if(context.date!==undefined&&!validLocalDate(context.date))throw Error('Choose a valid local meal date');
 if(context.mealType!==undefined&&!aiMealTypes.includes(context.mealType))throw Error('Choose a supported meal type');
 const next=structuredClone(draft);
 next.rows=next.rows.map(row=>({...row,item:{...row.item,...(row.item.date===null&&context.date!==undefined?{date:context.date}:{}),...(row.item.mealType===null&&context.mealType!==undefined?{mealType:context.mealType}:{})}}));
 return validateAIMealDraft(next);
}
