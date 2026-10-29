import {expect,it} from 'vitest';
import {createAIMealDraft,editAIMealDraftRow,editAIMealDraftNutrition,parseAIMealDraft,selectAIMealDraftSource,recalculateAIMealDraftRow,restoreAIMealEstimate,validateAIMealDraft,groupAIMealDraft,aiMealDraftTotals,type AIMealBaseline} from './ai-meal-state';
const raw=()=>JSON.stringify({format:'betterlumi-meal',version:1,meals:[{date:null,mealType:null,items:[{name:'Synthetic dish',date:null,mealType:null,amount:2,unit:'piece',weightG:120,consumedFraction:.5,nutrition:{calories:201.123456,protein:null,carbs:20,fat:0},estimated:true,notes:null,splitSuggestions:[{name:'Optional component',amount:1,unit:'piece',nutrition:{calories:7,protein:1,carbs:1,fat:1},estimated:true}]}]}]});
const draft=()=>createAIMealDraft(raw(),'synthetic');
const row=()=>draft().rows[0];
const local:AIMealBaseline={kind:'pantry',id:'local',name:'Local source',amount:1,unit:'g',weightG:1,nutrition:{calories:2,protein:1,carbs:null,fat:0},estimated:false};
it('keeps unknown context flat, preserves original estimates and excludes optional splits from totals',()=>{
 const d=draft();expect(groupAIMealDraft(d).groups).toEqual([]);expect(groupAIMealDraft(d).unresolved).toHaveLength(1);expect(aiMealDraftTotals(d).nutrition).toEqual(d.rows[0].original.nutrition);expect(d.rows[0].item.consumedFraction).toBe(.5);
 d.rows[0]=editAIMealDraftRow(d.rows[0],{date:'2026-11-02',mealType:'breakfast'});expect(groupAIMealDraft(d)).toMatchObject({groups:[{date:'2026-11-02',mealType:'breakfast'}],unresolved:[]});expect(d.rows[0].original.date).toBeNull();
});
it('retains the last edited preview on a failed explicit parse and does not silently parse raw edits',()=>{
 const d=draft();d.rows[0]=editAIMealDraftNutrition(d.rows[0],{calories:44});d.raw='not JSON';const failed=parseAIMealDraft(d);expect(failed.parseError).toBeTruthy();expect(failed.rows).toEqual(d.rows);expect(validateAIMealDraft(failed)).toEqual(failed);d.raw=raw();expect(parseAIMealDraft(d).rows[0].item.nutrition.calories).toBe(201.123456);
});
it('scales from an immutable full-precision consumed baseline without applying the fraction or counting splits',()=>{
 const original=row(),one=editAIMealDraftRow(original,{amount:1}),three=editAIMealDraftRow(one,{amount:3}),back=editAIMealDraftRow(three,{amount:2});expect(one.item.nutrition).toEqual({calories:201.123456/2,protein:null,carbs:10,fat:0});expect(one.item.weightG).toBe(60);expect(three.item.nutrition.calories).toBe(201.123456*1.5);expect(back.item.nutrition).toEqual(original.item.nutrition);expect(back.original).toEqual(original.original);expect(original.item.amount).toBe(2);
});
it('supports clearable quantities, explicit zero and re-entry while retaining nulls',()=>{
 const r=row(),empty=editAIMealDraftRow(r,{amount:null});expect(empty.status).toBe('unresolved-portion');expect(empty.item.nutrition).toEqual({calories:null,protein:null,carbs:null,fat:null});const zero=editAIMealDraftRow(empty,{amount:0});expect(zero.item.nutrition).toEqual({calories:0,protein:null,carbs:0,fat:0});expect(editAIMealDraftRow(zero,{amount:2}).item.nutrition).toEqual(r.item.nutrition);
});
it('rescales an explicit weight edit and refuses incompatible or unknown units rather than assuming density',()=>{
 expect(editAIMealDraftRow(row(),{weightG:60}).item.nutrition.calories).toBe(201.123456/2);expect(editAIMealDraftRow(row(),{unit:'mL'}).status).toBe('unresolved-portion');expect(editAIMealDraftRow(row(),{weightG:null}).status).toBe('unresolved-portion');
});
it('preserves manual nutrient edits on quantity changes and requires explicit replacement on source changes',()=>{
 const r=editAIMealDraftNutrition(row(),{calories:99,protein:0}),edited=editAIMealDraftRow(r,{amount:4});expect(edited.item.nutrition).toEqual({calories:99,protein:0,carbs:40,fat:0});expect(()=>selectAIMealDraftSource(r,local,{amount:30,unit:'g',weightG:30})).toThrow(/Confirm/);const selected=selectAIMealDraftSource(r,local,{amount:30,unit:'g',weightG:30},true);expect(selected.item.nutrition).toEqual({calories:60,protein:30,carbs:null,fat:0});expect(recalculateAIMealDraftRow(edited).item.nutrition.calories).toBe(201.123456*2);expect(restoreAIMealEstimate(selected)).toEqual(row());
});
it('preserves a wholly unknown amount and nutrition as a valid draft without substituting defaults',()=>{
 const d=JSON.parse(raw());Object.assign(d.meals[0].items[0],{amount:null,unit:'',weightG:null,nutrition:{calories:null,protein:null,carbs:null,fat:null}});const r=createAIMealDraft(JSON.stringify(d),'unknown');expect(r.rows[0].item.amount).toBeNull();expect(r.rows[0].item.nutrition.calories).toBeNull();expect(validateAIMealDraft(r)).toEqual(r);
});
it.each([NaN,Infinity,-1])('rejects invalid numeric edits %s without changing the previous row',amount=>{const r=row(),before=structuredClone(r);expect(()=>editAIMealDraftRow(r,{amount})).toThrow();expect(()=>editAIMealDraftNutrition(r,{fat:amount})).toThrow();expect(r).toEqual(before)});
it('rejects overflow and tampered stored snapshots, original baselines and unsupported draft versions',()=>{
 expect(()=>editAIMealDraftRow(row(),{amount:Number.MAX_VALUE})).toThrow();let d=draft();d.rows[0].item.nutrition.calories=8;expect(()=>validateAIMealDraft(d)).toThrow(/differs/);d=draft();d.rows[0].baseline.nutrition.calories=8;expect(()=>validateAIMealDraft(d)).toThrow(/baseline/);expect(()=>validateAIMealDraft({...draft(),version:2})).toThrow();d=draft();d.rows.push(structuredClone(d.rows[0]));expect(()=>validateAIMealDraft(d)).toThrow(/Duplicate/);
});
