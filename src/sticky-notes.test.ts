import 'fake-indexeddb/auto';
import {beforeEach,expect,it} from 'vitest';
import {db,stamp,foodLogs,recipes,softDelete,exportAll,restoreAll,type FoodLog,type Recipe} from './domain';
import {recipeNotes} from './goals';
import {newStickyNote,sortStickyNotes,loadStickyNotes,commitStickyNoteChanges,assertMealNoteRevision,StickyNoteConflict,type StickyNoteChange} from './sticky-notes';
const recipe=():Recipe=>({...stamp(),name:'Shared recipe',servings:1,lines:[],instructions:'Keep',stickyNote:''});
const meal=(recipeId:string|null=null):FoodLog=>({...stamp(),date:'2026-10-30',category:'dinner',name:'Shared recipe',source:recipeId?'recipe':'quick',sourceId:recipeId,quantity:1,unit:'entry',nutrition:{calories:123.456,protein:null,carbs:0,fat:4},lines:[],cookingNote:'',photo:'original-photo',estimated:true});
beforeEach(async()=>{await db.transaction('rw',db.tables,async()=>{for(const t of db.tables)await t.clear()})});
async function add(r:Recipe,m:FoodLog,text='A shared meal note'){
 const before=newStickyNote(r.id,{id:m.id,date:m.date});await commitStickyNoteChanges([{before,text,fresh:true}],m);return before.id;
}
it('creates a single stable shared note visible from a recipe and every linked meal',async()=>{
 const r=recipe(),a=meal(r.id),b=meal(r.id);await recipes.put(r);await foodLogs.bulkPut([a,b]);const id=await add(r,a);
 for(const mealId of ['',a.id,b.id]){const notes=await loadStickyNotes(r.id,mealId);expect(notes).toHaveLength(1);expect(notes[0]).toMatchObject({id,text:'A shared meal note',origin:'meal',mealId:a.id,mealDate:a.date})}
 expect(await recipeNotes.count()).toBe(1);expect(await foodLogs.get(a.id)).toEqual(a);
});
it('edits and soft-deletes the same note from either view without changing creation metadata',async()=>{
 const r=recipe(),m=meal(r.id);await recipes.put(r);await foodLogs.put(m);const id=await add(r,m),original=(await recipeNotes.get(id))!;
 await commitStickyNoteChanges([{before:(await loadStickyNotes(r.id))[0],text:'Edited from recipe'}]);
 const note=(await loadStickyNotes(r.id,m.id))[0];expect(note).toMatchObject({id,text:'Edited from recipe',createdAt:original.createdAt,origin:'meal',mealId:m.id});
 await commitStickyNoteChanges([{before:note,text:null}],m);expect(await loadStickyNotes(r.id)).toEqual([]);expect((await recipeNotes.get(id))?.deletedAt).toBeTruthy();
});
it('recipe-created notes are visible from meals and retain Recipe origin when edited in a meal',async()=>{
 const r=recipe(),m=meal(r.id);await recipes.put(r);await foodLogs.put(m);const before=newStickyNote(r.id);await commitStickyNoteChanges([{before,text:'Recipe origin',fresh:true}]);const n=(await loadStickyNotes(r.id,m.id))[0];await commitStickyNoteChanges([{before:n,text:'Meal edit'}],m);expect((await loadStickyNotes(r.id))[0]).toMatchObject({id:before.id,text:'Meal edit',origin:'recipe'});
});
it('private notes do not match by food name and attach once after an explicit recipe link',async()=>{
 const r=recipe(),m=meal();await recipes.put(r);await foodLogs.put(m);const before=newStickyNote('',{id:m.id,date:m.date});await commitStickyNoteChanges([{before,text:'Private',fresh:true}],m);expect(await loadStickyNotes(r.id)).toEqual([]);expect(await loadStickyNotes('',m.id)).toHaveLength(1);
 const linked={...m,source:'recipe' as const,sourceId:r.id,revision:m.revision+1};await db.transaction('rw',[foodLogs,recipes,recipeNotes],async()=>{await foodLogs.put(linked);await commitStickyNoteChanges([],linked)});await commitStickyNoteChanges([],linked);expect(await recipeNotes.count()).toBe(1);expect((await loadStickyNotes(r.id))[0]).toMatchObject({id:before.id,text:'Private',recipeId:r.id});
});
it('preserves legacy meal and recipe text in place without a read-time conversion or duplicate copies',async()=>{
 const r={...recipe(),stickyNote:'Legacy recipe text'},m={...meal(r.id),cookingNote:'Legacy meal text'};await recipes.put(r);await foodLogs.put(m);const before=(await exportAll()).tables;
 const notes=await loadStickyNotes(r.id,m.id);expect(notes.map(n=>n.text).sort()).toEqual(['Legacy meal text','Legacy recipe text']);expect((await exportAll()).tables).toEqual(before);expect(await recipeNotes.count()).toBe(0);
 const n=notes.find(n=>n.location==='legacy-meal')!;await commitStickyNoteChanges([{before:n,text:'Edited legacy'}],m);expect(await foodLogs.get(m.id)).toMatchObject({...m,cookingNote:'Edited legacy',revision:m.revision+1,updatedAt:expect.any(String)});expect((await loadStickyNotes(r.id)).filter(n=>n.text==='Edited legacy')).toHaveLength(1);
});
it('keeps AI portion/source details separate from user-authored sticky notes',async()=>{
 const m={...meal(),id:'ai-meal:test-import:0',cookingNote:'2 piece · 123.456 g · Of original serving: 50%\nUser AI note'};await foodLogs.put(m);expect(await loadStickyNotes('',m.id)).toEqual([]);const before=newStickyNote('',{id:m.id,date:m.date});await commitStickyNoteChanges([{before,text:'User sticky',fresh:true}],m);expect((await loadStickyNotes('',m.id)).map(n=>n.text)).toEqual(['User sticky']);expect(await foodLogs.get(m.id)).toEqual(m);
});
it('retains shared notes and legacy text after a meal or recipe is soft-deleted',async()=>{
 const r={...recipe(),stickyNote:'Legacy recipe'},m={...meal(r.id),cookingNote:'Legacy meal'};await recipes.put(r);await foodLogs.put(m);await add(r,m);await softDelete(foodLogs,m.id);expect(await loadStickyNotes(r.id)).toHaveLength(3);await softDelete(recipes,r.id);expect(await loadStickyNotes(r.id,m.id)).toHaveLength(3);expect(await recipeNotes.count()).toBe(1);
});
it('detects a newer shared-note edit and rolls back the entire meal transaction',async()=>{
 const r=recipe(),m=meal(r.id);await recipes.put(r);await foodLogs.put(m);await add(r,m);const stale=(await loadStickyNotes(r.id))[0];await commitStickyNoteChanges([{before:stale,text:'Newer edit'}]);
 await expect(db.transaction('rw',[foodLogs,recipes,recipeNotes],async()=>{await foodLogs.put({...m,name:'Must roll back',revision:2});await commitStickyNoteChanges([{before:stale,text:'Stale overwrite'}],m)})).rejects.toBeInstanceOf(StickyNoteConflict);expect(await foodLogs.get(m.id)).toEqual(m);expect((await loadStickyNotes(r.id))[0].text).toBe('Newer edit');
});
it('rejects stale meal edits and legacy-note overwrites',async()=>{
 const m={...meal(),cookingNote:'Original'};await foodLogs.put(m);const stale=(await loadStickyNotes('',m.id))[0];await foodLogs.update(m.id,{revision:m.revision+1,cookingNote:'Newer'});await expect(assertMealNoteRevision(m)).rejects.toBeInstanceOf(StickyNoteConflict);await expect(commitStickyNoteChanges([{before:stale,text:'Stale'}])).rejects.toBeInstanceOf(StickyNoteConflict);expect((await foodLogs.get(m.id))?.cookingNote).toBe('Newer');
});
it('rolls back both meal and note writes on an injected failure and preserves the staged changes',async()=>{
 const r=recipe(),m=meal(r.id);await recipes.put(r);await foodLogs.put(m);const changes:StickyNoteChange[]=[{before:newStickyNote(r.id,{id:m.id,date:m.date}),text:'Retain draft',fresh:true}],copy=structuredClone(changes),fail=()=>{throw Error('Injected note failure')};recipeNotes.hook('creating',fail);
 try{await expect(db.transaction('rw',[foodLogs,recipeNotes,recipes],async()=>{await foodLogs.put({...m,name:'Do not save'});await commitStickyNoteChanges(changes,m)})).rejects.toThrow('Injected note failure')}finally{recipeNotes.hook('creating').unsubscribe(fail)}
 expect(await foodLogs.get(m.id)).toEqual(m);expect(await recipeNotes.count()).toBe(0);expect(changes).toEqual(copy);
});
it('orders notes chronologically and preserves note metadata through Backup 10 restore',async()=>{
 const r={...recipe(),createdAt:'2020-01-01T12:00:00Z',stickyNote:'Old recipe'},m=meal(r.id);await recipes.put(r);await foodLogs.put(m);await add(r,m);const notes=await loadStickyNotes(r.id);expect(notes[0].text).toBe('Old recipe');const backup=await exportAll();expect(backup.version).toBe(11);expect(db.verno).toBe(7);expect(db.name).toBe('BetterLumi');await restoreAll(backup);expect((await exportAll()).tables).toEqual(backup.tables);expect(await loadStickyNotes(r.id)).toEqual(notes);
 const bad=structuredClone(backup);(bad.tables.recipeNotes[0] as any).mealDate='not a date';await expect(restoreAll(bad)).rejects.toThrow('Invalid recipe note');expect((await exportAll()).tables).toEqual(backup.tables);
});

it('orders creation instants correctly across timestamp offsets',()=>{
 const later={...newStickyNote('r'),id:'later',createdAt:'2026-10-29T08:00:00-04:00'},earlier={...newStickyNote('r'),id:'earlier',createdAt:'2026-10-29T10:00:00Z'};expect(sortStickyNotes([later,earlier]).map(n=>n.id)).toEqual(['earlier','later']);
});
