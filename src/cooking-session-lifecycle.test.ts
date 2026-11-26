import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,stamp,recipes,exportAll,restoreAll,type Recipe} from './domain';
import {COOKING_PREFIX,setCookingQuantity} from './cooking-journal';
import {openCookingSession,saveCookingSession,discardCookingSession} from './cooking-session';
const recipe=():Recipe=>({...stamp(),name:'Preparation',servings:2,lines:[{lineId:'egg',ingredientId:'egg',name:'Egg',quantity:16.667,unit:'g',nutrition:{calories:70,protein:6,carbs:null,fat:0}}],instructions:'Keep.',stickyNote:''});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('discard clears only the active preparation and prevents stale saves resurrecting it',async()=>{
 const r=recipe();await recipes.put(r);await db.settings.put({key:'unrelated',value:'keep'});const before=await exportAll();let s=await openCookingSession(r,true);s=await saveCookingSession(s,{...setCookingQuantity(s,'egg',150.125,'g'),checked:['egg']});await discardCookingSession(s);expect(await db.settings.get(COOKING_PREFIX+r.id)).toBeUndefined();await expect(saveCookingSession(s,s)).rejects.toThrow();expect(await db.settings.get('unrelated')).toEqual({key:'unrelated',value:'keep'});const after=await exportAll();for(const key of Object.keys(before.tables).filter(k=>k!=='settings'))expect(after.tables[key]).toEqual(before.tables[key]);
});
it('an abandoned preparation cannot delete a new visit or another window progress',async()=>{
 const r=recipe();const old=await openCookingSession(r,true),next=await openCookingSession(r,true);await expect(discardCookingSession(old)).rejects.toThrow();expect(await openCookingSession(r)).toEqual(next);const updated=await saveCookingSession(next,{...next,checked:['egg']});await expect(discardCookingSession(next)).rejects.toThrow();expect(await openCookingSession(r)).toEqual(updated);
});
it('failed deletion preserves complete preparation for retry',async()=>{
 const r=recipe(),s=await openCookingSession(r,true),fail=()=>{throw Error('Injected deletion failure')};db.settings.hook('deleting',fail);try{await expect(discardCookingSession(s)).rejects.toThrow()}finally{db.settings.hook('deleting').unsubscribe(fail)}expect(await openCookingSession(r)).toEqual(s);await discardCookingSession(s);expect(await db.settings.get(COOKING_PREFIX+r.id)).toBeUndefined();
});
it('Backup 13 still round trips legacy and v2 sessions without rounding or bulk upgrades',async()=>{
 const r=recipe();await recipes.put(r);let s=await openCookingSession(r);s=await saveCookingSession(s,setCookingQuantity(s,'egg',150.125,'g'));const backup=await exportAll();expect(backup.version).toBe(20);await restoreAll(JSON.parse(JSON.stringify(backup)));expect(await openCookingSession(r)).toEqual(s);const fresh=await openCookingSession(r,true);expect(fresh.id).not.toBe(s.id);expect(fresh.servings).toBe(2);expect(fresh.checked).toEqual([]);expect(fresh.quantityOverrides).toEqual([]);expect((await recipes.get(r.id))!.lines[0].quantity).toBe(16.667);
});
