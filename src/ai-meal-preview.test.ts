import {parseRoute} from './routing';
import {validPageSession} from './session-state';
import {expect,it} from 'vitest';
import {createAIMealDraft,aiMealDraftTotals,editAIMealDraftNutrition,editAIMealDraftRow,validateAIMealDraft,restoreAIMealEstimate} from './ai-meal-state';
import {assignMissingAIMealContext,acceptAIMealSplit,undoAIMealSplit,splitSuggestionRows,newSplitComponent,moveAIMealRow,editAIMealGroupDate,aiMealPreviewWarnings} from './ai-meal-preview';
const make=()=>createAIMealDraft(JSON.stringify({format:'betterlumi-meal',version:1,meals:[{date:'2026-11-01',mealType:'lunch',items:[{name:'Synthetic parent',date:null,mealType:null,amount:2,unit:'serving',weightG:200,consumedFraction:.5,nutrition:{calories:201.123456,protein:null,carbs:20,fat:0},estimated:true,notes:'Keep note',splitSuggestions:[{name:'Synthetic component',amount:1,unit:'piece',weightG:80,nutrition:{calories:81.1234,protein:null,carbs:0,fat:1},estimated:true}]}]},{date:null,mealType:null,items:[{name:'Synthetic flat',date:null,mealType:null,amount:null,unit:'',weightG:null,consumedFraction:null,nutrition:{calories:50,protein:0,carbs:10,fat:0},estimated:true,notes:null,splitSuggestions:[]}]}]}),'preview');
it('accepts split components as replacements, never adds them alongside the original and keeps null/precision',()=>{
 const d=make(),parent=d.rows[0],parts=splitSuggestionRows(parent),split=acceptAIMealSplit(d,parent,parts);expect(split.rows.map(r=>r.item.name)).toEqual(['Synthetic component','Synthetic flat']);expect(aiMealDraftTotals(split).nutrition).toEqual({calories:131.1234,protein:null,carbs:10,fat:1});expect(split.rows[0].item.consumedFraction).toBeNull();expect(d.rows[0].item.nutrition.calories).toBe(201.123456);
});
it('undo preserves the original full source/manual snapshot even after components are edited and moved',()=>{
 const d=make();d.rows[0]=editAIMealDraftNutrition(d.rows[0],{calories:300});const original=structuredClone(d.rows[0]);let split=acceptAIMealSplit(d,original,splitSuggestionRows(original));split.rows[0]=editAIMealDraftNutrition(split.rows[0],{calories:22});split=moveAIMealRow(split,split.rows[0].item.path,{date:'2026-11-04',mealType:'dinner'});const undone=undoAIMealSplit(split,original.item.path);expect(undone.rows.find(r=>r.item.path===original.item.path)).toEqual(original);expect(undone.rows).toHaveLength(2);
});
it('supports adding/removing components and restores a split even when all components were removed',()=>{
 const d=make(),parent=d.rows[0],parts=splitSuggestionRows(parent),extra=newSplitComponent(parent,{name:'User component',amount:null,unit:'',weightG:null,nutrition:{calories:null,protein:null,carbs:null,fat:null},estimated:true},1);const split=acceptAIMealSplit(d,parent,[...parts,extra]);split.rows=split.rows.filter(r=>!r.splitParent);expect(undoAIMealSplit(split,parent.item.path).rows).toHaveLength(2);expect(()=>newSplitComponent(parts[0],extra.item,0)).toThrow(/Nested/);
});
it('round-trips split draft history and original AI restore without changing import contract or losing undo metadata',()=>{
 const d=make(),split=acceptAIMealSplit(d,d.rows[0],splitSuggestionRows(d.rows[0]));const restored=validateAIMealDraft(JSON.parse(JSON.stringify(split)));restored.rows[0]=restoreAIMealEstimate(restored.rows[0]);expect(validateAIMealDraft(restored)).toEqual(restored);expect(restored.rows[0].splitParent).toBe(d.rows[0].item.path);
});
it('moves between groups and flat rows without touching nutrition, amount, source baseline or fraction',()=>{
 const d=make(),before=structuredClone(d.rows[0]);let moved=moveAIMealRow(d,before.item.path,{date:'2026-11-02',mealType:'dinner'});let row=moved.rows.find(r=>r.item.path===before.item.path)!;expect(row.item).toEqual({...before.item,date:'2026-11-02',mealType:'dinner'});expect(row.baseline).toEqual(before.baseline);moved=moveAIMealRow(moved,before.item.path,null);row=moved.rows.find(r=>r.item.path===before.item.path)!;expect(row.item.date).toBe('2026-11-02');expect(row.item.mealType).toBeNull();expect(row.item.nutrition).toEqual(before.item.nutrition);
});
it('supports stable reordering and adoption of an existing group with no invented date',()=>{
 const d=make(),flat=d.rows[1],parent=d.rows[0];const moved=moveAIMealRow(d,flat.item.path,{date:'2026-11-01',mealType:'lunch'},parent.item.path);expect(moved.rows[0].item.name).toBe('Synthetic flat');expect(moved.rows[0].item.nutrition).toEqual(flat.item.nutrition);expect(moveAIMealRow(d,parent.item.path,null,parent.item.path)).toEqual(d);
});
it('edits group dates safely and leaves unresolved rows alone',()=>{
 const d=make(),edited=editAIMealGroupDate(d,{date:'2026-11-01',mealType:'lunch'},'2026-11-02');expect(edited.rows[0].item.date).toBe('2026-11-02');expect(edited.rows[1].item.date).toBeNull();expect(()=>editAIMealGroupDate(d,{date:'2026-11-01',mealType:'lunch'},'2026-02-30')).toThrow();expect(d.rows[0].item.date).toBe('2026-11-01');
});
it('refuses empty or structurally inconsistent splits and blank component placeholders',()=>{
 const d=make(),parent=d.rows[0];expect(()=>acceptAIMealSplit(d,parent,[])).toThrow();expect(()=>newSplitComponent(parent,{name:' ',amount:null,unit:'',weightG:null,nutrition:{calories:null,protein:null,carbs:null,fat:null},estimated:true},0)).toThrow();const parts=splitSuggestionRows(parent);parts[0]=editAIMealDraftRow(parts[0],{amount:2});const split=acceptAIMealSplit(d,parent,parts);delete split.splits;expect(()=>validateAIMealDraft(split)).toThrow(/Missing split/);
});

it('split components inherit a changed parent context unless explicitly placed in another meal',()=>{
 const d=make(),parent=editAIMealDraftRow(d.rows[0],{date:'2026-11-05',mealType:'breakfast'}),parts=splitSuggestionRows(d.rows[0]);const split=acceptAIMealSplit(d,parent,parts);expect(split.rows[0].item).toMatchObject({date:'2026-11-05',mealType:'breakfast',nutrition:parts[0].item.nutrition});
});

it('recognizes both assistant hash routes under Pages and retains their session without a new navigation tab',()=>{
 expect(parseRoute('https://example.test/BetterLumi/#/assistant')).toMatchObject({page:'assistant',assistantMeals:false});expect(parseRoute('https://example.test/BetterLumi/#/assistant/meals')).toMatchObject({page:'assistant',assistantMeals:true});expect(validPageSession({route:'/assistant/meals',tab:'food',todayDate:'2026-11-01',scrollY:0})).toBe(true);
});

it('surfaces zero/duplicate advisories without changing or removing foods',()=>{
 const draft=make();draft.rows[1]=editAIMealDraftRow(draft.rows[1],{name:draft.rows[0].item.name,date:draft.rows[0].item.date,mealType:draft.rows[0].item.mealType,amount:0});draft.rows[0]=editAIMealDraftRow(draft.rows[0],{amount:0});const before=structuredClone(draft),warnings=aiMealPreviewWarnings(draft);expect(warnings[draft.rows[0].item.path]).toBe('zero');expect(warnings[draft.rows[1].item.path]).toBe('duplicate');expect(draft).toEqual(before);
});

it('batch context only fills missing fields and preserves supplied group and item context',()=>{
 const d=make(),before=structuredClone(d),dated=assignMissingAIMealContext(d,{date:'2026-11-06'});
 expect(d).toEqual(before);expect(dated.rows[0]).toEqual(d.rows[0]);expect(dated.rows[1].item.date).toBe('2026-11-06');expect(dated.rows[1].item.mealType).toBeNull();
 for(const mealType of ['breakfast','lunch','dinner','snack'] as const){const filled=assignMissingAIMealContext(dated,{mealType});expect(filled.rows[0]).toEqual(d.rows[0]);expect(filled.rows[1].item).toEqual({...d.rows[1].item,date:'2026-11-06',mealType});expect(filled.rows[1].baseline).toEqual(d.rows[1].baseline);expect(assignMissingAIMealContext(filled,{date:'2026-11-07',mealType:'snack'})).toEqual(filled)}
});
it('batch context preserves split undo metadata and exact null versus zero nutrition',()=>{
 const d=make();d.rows[0]=editAIMealDraftRow(d.rows[0],{date:null,mealType:null});const split=acceptAIMealSplit(d,d.rows[0],splitSuggestionRows(d.rows[0]));const next=assignMissingAIMealContext(split,{date:'2026-11-08',mealType:'dinner'});expect(next.splits).toEqual(split.splits);expect(next.raw).toEqual(split.raw);next.rows.forEach((row,i)=>expect(row).toEqual({...split.rows[i],item:{...split.rows[i].item,date:'2026-11-08',mealType:'dinner'}}));expect(next.rows[0].item.nutrition).toEqual({calories:81.1234,protein:null,carbs:0,fat:1});
});
it('batch context rejects invalid dates and unsupported meal types without mutating the draft',()=>{
 const d=make(),before=structuredClone(d);for(const date of ['', '2026-02-30','not-a-date'])expect(()=>assignMissingAIMealContext(d,{date})).toThrow();expect(()=>assignMissingAIMealContext(d,{mealType:'brunch' as any})).toThrow();expect(d).toEqual(before);
});
