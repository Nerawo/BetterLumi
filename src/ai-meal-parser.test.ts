import {describe,it,expect} from 'vitest';
import {parseAIMealResponse,AIMealParseError,AI_MEAL_LIMITS} from './ai-meal-parser';
const item=()=>({name:'Synthetic dish',date:null,mealType:null,amount:2,unit:'serving',weightG:123.456,consumedFraction:.25,nutrition:{calories:201.125,protein:10,carbs:20,fat:3},estimated:true,notes:null,splitSuggestions:[] as unknown[]});
const document=()=>({format:'betterlumi-meal',version:1,meals:[{date:null as string|null,mealType:null as string|null,items:[item()]}]});
const parse=(value:unknown)=>parseAIMealResponse(JSON.stringify(value));
describe('local AI meal contract parser',()=>{
 it('accepts JSON alone, UTF-8 BOM, and complete Markdown responses without interpreting prose',()=>{
  const d=document(),raw=JSON.stringify(d),result=parse(d);expect(parseAIMealResponse('\uFEFF'+raw)).toEqual(result);
  for(const fence of ['json','JSON',''])expect(parseAIMealResponse('AI total: 999999 kcal\n\n```'+fence+'\n'+raw+'\n```\nFinished.')).toEqual(result);
  expect(result.totals.nutrition.calories).toBe(201.125);expect(result.items[0].consumedFraction).toBe(.25);
 });
 it('selects exactly one meal object among unrelated JSON fences and rejects ambiguous meal objects',()=>{
  const block='```json\n'+JSON.stringify(document())+'\n```';expect(parseAIMealResponse('```json\n{"unrelated":true}\n```\n'+block).items).toHaveLength(1);expect(()=>parseAIMealResponse(block+'\n'+block)).toThrow(/Multiple JSON objects/);
 });
 it.each(['','  ','{','{"format":','```json\n{\n```','Summary without fenced JSON','[]','null'])('rejects malformed or non-object input %s',raw=>{expect(()=>parseAIMealResponse(raw)).toThrow(AIMealParseError)});
 it.each([['format','other'],['version',2],['version','1']])('rejects unsupported %s', (key,value)=>{const d={...document(),[key]:value};expect(()=>parse(d)).toThrow('$.mat'.replace('mat',key))});
 it('rejects unknown keys, including unsafe prototype keys, without executing anything',()=>{
  const d=document();Object.assign(d,{extra:true});expect(()=>parse(d)).toThrow('$.extra');
  const raw=JSON.stringify(document()).replace('"version":1','"version":1,"__proto__":{"polluted":true}');expect(()=>parseAIMealResponse(raw)).toThrow(/Unexpected field/);expect(({} as {polluted?:boolean}).polluted).toBeUndefined();
 });
 it('keeps unknown dates/types null and inherits only explicitly supplied group context',()=>{
  const d=document();expect(parse(d).items[0]).toMatchObject({date:null,mealType:null});d.meals[0].date='2026-10-30';d.meals[0].mealType='breakfast';const result=parse(d);expect(result.items[0]).toMatchObject({date:'2026-10-30',mealType:'breakfast'});expect(result.document.meals[0].items[0].date).toBeNull();
  Object.assign(d.meals[0].items[0],{date:'2026-11-02',mealType:'dinner'});expect(parse(d).items[0]).toMatchObject({date:'2026-11-02',mealType:'dinner'});
 });
 it.each(['2026-02-30','2026-2-03','2026-10-30T00:00:00Z','not-a-date'])('rejects invalid local date %s',date=>{const d=document();d.meals[0].date=date;expect(()=>parse(d)).toThrow('$.meals.0.date')});
 it('validates item dates and unsupported meal types at their actual paths',()=>{const d=document();Object.assign(d.meals[0].items[0],{date:'2026-02-30'});expect(()=>parse(d)).toThrow('$.meals.0.items.0.date');Object.assign(d.meals[0].items[0],{date:null,mealType:'uncategorized'});expect(()=>parse(d)).toThrow('$.meals.0.items.0.mealType')});
 it('preserves null vs explicit zero in partial nutrition and labels totals as incomplete',()=>{
  const d=document();Object.assign(d.meals[0].items[0].nutrition,{calories:null,protein:0,carbs:null});d.meals[0].items.push(item());const r=parse(d);expect(r.items[0].nutrition).toEqual({calories:null,protein:0,carbs:null,fat:3});expect(r.totals.nutrition.calories).toBeNull();expect(r.totals.knownNutrition.calories).toBe(201.125);expect(r.totals.missing.calories).toBe(1);expect(r.totals.nutrition.protein).toBe(10);expect(r.warnings).toContainEqual({code:'missing-nutrition',path:'$.meals.0.items.0'});
 });
 it('never turns all-unknown nutrition into a zero total',()=>{const d=document();Object.assign(d.meals[0].items[0].nutrition,{calories:null,protein:null,carbs:null,fat:null});expect(parse(d).totals.knownNutrition).toEqual({calories:null,protein:null,carbs:null,fat:null})});
 it('rejects absent nutrients and numeric strings instead of supplying defaults',()=>{const d=document();Reflect.deleteProperty(d.meals[0].items[0].nutrition,'protein');expect(()=>parse(d)).toThrow(/Required field/);const e=document();Object.assign(e.meals[0].items[0].nutrition,{protein:'12'});expect(()=>parse(e)).toThrow(/finite nonnegative number/)});
 it('rejects negative/non-finite values and fractions outside zero to one',()=>{const d=document();d.meals[0].items[0].nutrition.protein=-1;expect(()=>parse(d)).toThrow(/finite nonnegative/);expect(()=>parseAIMealResponse(JSON.stringify(document()).replace('201.125','1e400'))).toThrow(/finite nonnegative/);for(const fraction of [-1,1.1]){const d=document();d.meals[0].items[0].consumedFraction=fraction;expect(()=>parse(d)).toThrow(/consumedFraction/)}});
 it('requires boolean estimated flags and correctly typed nested items',()=>{const d=document();Object.assign(d.meals[0].items[0],{estimated:'true'});expect(()=>parse(d)).toThrow(/estimated/);expect(()=>parse({...document(),meals:[{date:null,mealType:null,items:[null]}]})).toThrow(/Expected an object/)});
 it('warns about zero and duplicate-looking entries without removing or merging any item',()=>{const d=document();Object.assign(d.meals[0].items[0],{amount:0,weightG:0,consumedFraction:0});Object.assign(d.meals[0].items[0].nutrition,{calories:0,protein:0,carbs:0,fat:0});d.meals[0].items.push({...item(),name:'Ｓｙｎｔｈｅｔｉｃ dish'});const r=parse(d);expect(r.items).toHaveLength(2);expect(r.warnings.map(w=>w.code)).toEqual(expect.arrayContaining(['zero-amount','zero-weight','zero-fraction','zero-nutrition','duplicate-looking']))});
 it('validates non-recursive split components, permits omitted weight and never counts suggestions in totals',()=>{const d=document();d.meals[0].items[0].splitSuggestions=[{name:'Synthetic component',amount:1,unit:'portion',nutrition:{calories:888,protein:null,carbs:0,fat:1},estimated:true}];const r=parse(d);expect(r.items[0].splitSuggestions[0].weightG).toBeNull();expect(r.totals.nutrition.calories).toBe(201.125);Object.assign(d.meals[0].items[0].splitSuggestions[0] as object,{splitSuggestions:[]});expect(()=>parse(d)).toThrow(/Unexpected field/)});
 it('requires every component nutrient and rejects unsupported nested fields',()=>{const d=document();d.meals[0].items[0].splitSuggestions=[{name:'Synthetic component',amount:1,unit:'portion',nutrition:{calories:1,protein:0,carbs:0},estimated:true}];expect(()=>parse(d)).toThrow(/nutrition.fat/)});
 it('rejects oversized text and empty or oversized groups before preview',()=>{expect(()=>parseAIMealResponse(' '.repeat(AI_MEAL_LIMITS.text+1)+'{}')).toThrow(/too large/);expect(()=>parse({...document(),meals:[]})).toThrow(/meal groups/);const d=document();d.meals[0].items=[];expect(()=>parse(d)).toThrow(/nonempty/)});
 it('returns deterministic detached results and does not alter its input',()=>{const d=document(),raw=JSON.stringify(d),a=parse(d),b=parse(d);expect(a).toEqual(b);a.items[0].nutrition.calories=7;expect(a.document.meals[0].items[0].nutrition.calories).toBe(201.125);expect(JSON.stringify(d)).toBe(raw)});
});

it('rejects overflow in aggregated nutrition even when each individual value is finite',()=>{
 const d={format:'betterlumi-meal',version:1,meals:[{date:null,mealType:null,items:Array.from({length:2},()=>({name:'Synthetic large amount',date:null,mealType:null,amount:null,unit:'',weightG:null,consumedFraction:null,nutrition:{calories:1e308,protein:null,carbs:null,fat:null},estimated:true,notes:null,splitSuggestions:[]}))}]};expect(()=>parseAIMealResponse(JSON.stringify(d))).toThrow('$.totals.nutrition.calories');
});

it.each(['','   ','\t\n'])('rejects empty-name schema placeholders in foods and split components: %j',name=>{
 const d=document();d.meals[0].items[0].name=name;expect(()=>parse(d)).toThrow('$.meals.0.items.0.name');
 const e=document();e.meals[0].items[0].splitSuggestions=[{name,amount:null,unit:'',weightG:null,nutrition:{calories:null,protein:null,carbs:null,fat:null},estimated:true}];expect(()=>parse(e)).toThrow('$.meals.0.items.0.splitSuggestions.0.name');
});
