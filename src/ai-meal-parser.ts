import {nutrientKeys,sumNutrition,type Nutrition} from './domain';
import {measurement} from './aggregation';
import {validLocalDate} from './routing';
import {AI_MEAL_FORMAT,AI_MEAL_VERSION,aiMealTypes,type AIMealType,type AIMealItem,type AIConsumedPortion,type AIMealDocument,type ParsedAIMealResponse,type AIMealWarning,type AIMealTotals} from './ai-meal-model';
export const AI_MEAL_LIMITS={text:200000,items:500,components:30,name:200,unit:80,notes:4000} as const;
export class AIMealParseError extends Error {
 constructor(readonly code:'empty'|'too-large'|'json'|'ambiguous'|'contract',readonly path:string,message:string){super(path+': '+message);this.name='AIMealParseError'}
}
function fail(path:string,message:string):never {throw new AIMealParseError('contract',path,message)}
function object(value:unknown,path:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))fail(path,'Expected an object');return value as Record<string,unknown>}
function fields(value:Record<string,unknown>,required:readonly string[],optional:readonly string[],path:string){
 for(const key of required)if(!Object.hasOwn(value,key))fail(path+'.'+key,'Required field is missing; use null for an unknown nullable value');
 for(const key of Object.keys(value))if(!required.includes(key)&&!optional.includes(key))fail(path+'.'+key,'Unexpected field');
}
function text(value:unknown,path:string,max:number,allowEmpty=false){if(typeof value!=='string'||value.length>max||!allowEmpty&&!value.trim())fail(path,'Expected a valid text value');return value.trim()}
function number(value:unknown,path:string,max=Number.MAX_VALUE):number|null {if(value===null)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)fail(path,'Expected null or a finite nonnegative number');return value}
function date(value:unknown,path:string):string|null {if(value===null)return null;if(typeof value!=='string'||!validLocalDate(value))fail(path,'Expected null or a valid local YYYY-MM-DD date');return value}
function mealType(value:unknown,path:string):AIMealType|null {if(value===null)return null;if(!aiMealTypes.includes(value as AIMealType))fail(path,'Unsupported meal type');return value as AIMealType}
export function validateAIMealNutrition(value:unknown,path='nutrition'):Nutrition {
 const n=object(value,path);fields(n,nutrientKeys,[],path);return Object.fromEntries(nutrientKeys.map(key=>[key,number(n[key],path+'.'+key)])) as Nutrition;
}
function portion(value:Record<string,unknown>,path:string):AIConsumedPortion {
 if(typeof value.estimated!=='boolean')fail(path+'.estimated','Expected a boolean');
 return {name:text(value.name,path+'.name',AI_MEAL_LIMITS.name),amount:number(value.amount,path+'.amount'),unit:text(value.unit,path+'.unit',AI_MEAL_LIMITS.unit,true),weightG:number(value.weightG===undefined?null:value.weightG,path+'.weightG'),nutrition:validateAIMealNutrition(value.nutrition,path+'.nutrition'),estimated:value.estimated};
}
const portionKeys=['name','amount','unit','nutrition','estimated'];
function item(value:unknown,path:string):AIMealItem {
 const v=object(value,path);fields(v,[...portionKeys,'weightG','date','mealType','consumedFraction','notes','splitSuggestions'],[],path);
 if(v.notes!==null&&typeof v.notes!=='string')fail(path+'.notes','Expected null or text');
 if(!Array.isArray(v.splitSuggestions)||v.splitSuggestions.length>AI_MEAL_LIMITS.components)fail(path+'.splitSuggestions','Expected a bounded non-recursive array');
 const suggestions=v.splitSuggestions.map((value,index)=>{const p=path+'.splitSuggestions.'+index,c=object(value,p);fields(c,portionKeys,['weightG'],p);return portion(c,p)});
 return {...portion(v,path),date:date(v.date,path+'.date'),mealType:mealType(v.mealType,path+'.mealType'),consumedFraction:number(v.consumedFraction,path+'.consumedFraction',1),notes:v.notes===null?null:text(v.notes,path+'.notes',AI_MEAL_LIMITS.notes,true),splitSuggestions:suggestions};
}
function extract(raw:string):unknown {
 const text=raw.replace(/^\uFEFF/,'').trim();if(!text)throw new AIMealParseError('empty','$','Paste the AI response first');if(raw.length>AI_MEAL_LIMITS.text)throw new AIMealParseError('too-large','$','Response is too large');
 try{return JSON.parse(text)}catch{/* A complete Markdown response may wrap its JSON in a fence. */}
 const blocks=[...text.matchAll(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gim)].map(match=>match[1]);
 const candidates:unknown[]=[];for(const block of blocks){try{candidates.push(JSON.parse(block))}catch{/* Reject below unless another unambiguous contract object exists. */}}
 const intended=candidates.filter(value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(value as Record<string,unknown>).format===AI_MEAL_FORMAT);
 if(intended.length===1)return intended[0];if(intended.length>1||candidates.length>1)throw new AIMealParseError('ambiguous','$','Multiple JSON objects found; paste only the intended meal result');
 if(candidates.length===1)return candidates[0];throw new AIMealParseError('json','$','Use valid JSON alone or a complete json code block');
}
export function aiMealTotals(items:readonly Pick<AIMealItem,'nutrition'>[]):AIMealTotals {
 const metrics=Object.fromEntries(nutrientKeys.map(key=>[key,measurement(items.map(i=>i.nutrition[key]))])) as Record<keyof Nutrition,ReturnType<typeof measurement>>;
 const nutrition=validateAIMealNutrition(sumNutrition(items.map(i=>i.nutrition)),'$.totals.nutrition'),knownNutrition=validateAIMealNutrition(Object.fromEntries(nutrientKeys.map(key=>[key,metrics[key].value])),'$.totals.knownNutrition');
 return {nutrition,knownNutrition,missing:Object.fromEntries(nutrientKeys.map(key=>[key,metrics[key].missing])) as Record<keyof Nutrition,number>};
}
export function parseAIMealResponse(raw:string):ParsedAIMealResponse {
 const root=object(extract(raw),'$');fields(root,['format','version','meals'],[],'$');if(root.format!==AI_MEAL_FORMAT)fail('$.format','Unsupported format');if(root.version!==AI_MEAL_VERSION)fail('$.version','Unsupported version');
 if(!Array.isArray(root.meals)||!root.meals.length||root.meals.length>AI_MEAL_LIMITS.items)fail('$.meals','Expected meal groups');let count=0;
 const document:AIMealDocument={format:AI_MEAL_FORMAT,version:AI_MEAL_VERSION,meals:root.meals.map((value,index)=>{const path='$.meals.'+index,g=object(value,path);fields(g,['date','mealType','items'],[],path);if(!Array.isArray(g.items)||!g.items.length||(count+=g.items.length)>AI_MEAL_LIMITS.items)fail(path+'.items','Expected a nonempty bounded item list');return {date:date(g.date,path+'.date'),mealType:mealType(g.mealType,path+'.mealType'),items:g.items.map((value,index)=>item(value,path+'.items.'+index))}})};
 const items=document.meals.flatMap((group,g)=>group.items.map((item,i)=>({...structuredClone(item),date:item.date??group.date,mealType:item.mealType??group.mealType,path:'$.meals.'+g+'.items.'+i}))),warnings:AIMealWarning[]=[],seen=new Map<string,string>();
 for(const i of items){
  const inspect=(p:AIConsumedPortion,path:string)=>{if(nutrientKeys.some(k=>p.nutrition[k]===null))warnings.push({code:'missing-nutrition',path});if(p.amount===0)warnings.push({code:'zero-amount',path});if(p.weightG===0)warnings.push({code:'zero-weight',path});if(nutrientKeys.every(k=>p.nutrition[k]===0))warnings.push({code:'zero-nutrition',path})};
  inspect(i,i.path);i.splitSuggestions.forEach((p,index)=>inspect(p,i.path+'.splitSuggestions.'+index));if(i.consumedFraction===0)warnings.push({code:'zero-fraction',path:i.path});
  const key=JSON.stringify([i.date,i.mealType,i.name.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()]);const prior=seen.get(key);if(prior)warnings.push({code:'duplicate-looking',path:i.path,relatedPath:prior});else seen.set(key,i.path);
 }
 return {document,items,totals:aiMealTotals(items),warnings};
}
