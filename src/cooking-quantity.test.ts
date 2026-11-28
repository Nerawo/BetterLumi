import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,stamp,recipes,exportAll,restoreAll,type Recipe} from './domain';
import {COOKING_PREFIX,reconcileCookingSession,setCookingQuantity,restoreCookingQuantity,changeCookingServings,validateCookingSession,type CookingSession} from './cooking-journal';
import {openCookingSession,saveCookingSession} from './cooking-session';
import {journalQuantity} from './journal-quantity';
const recipe=():Recipe<import("./domain").RecipeLine>=>({...stamp(),name:'Quantity journal',servings:2,lines:['a','b'].map(lineId=>({lineId,ingredientId:'milk',name:'Milk',quantity:130,unit:'mL',nutrition:{calories:50.123456,protein:3,carbs:4,fat:2}})),instructions:'Keep exact.',stickyNote:''});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('integer presentation never rounds decimal recipe/override storage, including Backup 13 round trips',async()=>{
 const r=recipe();r.lines[0].quantity=130.125;r.lines[1].quantity=16.667;r.lines[1].unit='g';await recipes.put(r);
 const original=await openCookingSession(r),s=await saveCookingSession(original,setCookingQuantity(setCookingQuantity(original,'a',150.125,'mL'),'b',0,'g'));
 expect(journalQuantity(r.lines[0])).toBe('130');expect(journalQuantity(r.lines[1])).toBe('17');
 for(const o of s.quantityOverrides!)expect(journalQuantity(o)).toBe(o.entryId==='a'?'150':'0');
 const backup=await exportAll();expect(backup.version).toBe(21);await restoreAll(JSON.parse(JSON.stringify(backup)));
 expect((await exportAll()).tables).toEqual(backup.tables);expect(await recipes.get(r.id)).toEqual(r);
 const reopened=await openCookingSession(r);expect(reopened.quantityOverrides).toEqual(s.quantityOverrides);expect(reopened.quantityOverrides?.map(o=>o.quantity)).toEqual([150.125,0]);
 expect(r.lines.map(l=>l.quantity)).toEqual([130.125,16.667]);
});
it('absolute decimal overrides have distinct stable identities and can be edited/restored independently',()=>{
 const r=recipe(),initial=reconcileCookingSession(r);let s=setCookingQuantity(initial,'a',150.123456,'mL');s=setCookingQuantity(s,'b',0,'mL');s=setCookingQuantity(s,'a',160.5,'mL');s.checked=['a'];
 expect(initial.quantityOverrides).toEqual([]);expect(s.quantityOverrides?.map(o=>[o.entryId,o.quantity])).toEqual([['b',0],['a',160.5]]);
 const reset={...s,checked:[]};expect(reset.quantityOverrides).toEqual(s.quantityOverrides);
 const restored=restoreCookingQuantity(s,'a');expect(restored.checked).toEqual(['a']);expect(restored.quantityOverrides?.map(o=>o.entryId)).toEqual(['b']);expect(r.lines[0].quantity).toBe(130);
});
it.each([-1,NaN,Infinity,-Infinity])('rejects invalid quantity %s without mutating the session',n=>{
 const s=reconcileCookingSession(recipe()),before=structuredClone(s);expect(()=>setCookingQuantity(s,'a',n,'mL')).toThrow();expect(s).toEqual(before);
});
it('rejects unit edits and missing line IDs',()=>{
 const s=reconcileCookingSession(recipe());expect(()=>setCookingQuantity(s,'a',100,'g')).toThrow();expect(()=>setCookingQuantity(s,'missing',100,'mL')).toThrow();
});
it('serving changes require confirmation for overrides alone and atomically reset both kinds of session state',()=>{
 let s=setCookingQuantity(reconcileCookingSession(recipe()),'a',150,'mL');const before=structuredClone(s);expect(()=>changeCookingServings(s,4)).toThrow('Confirm');expect(s).toEqual(before);s.checked=['b'];
 expect(changeCookingServings(s,4,true)).toMatchObject({servings:4,checked:[],quantityOverrides:[]});expect(changeCookingServings(s,2)).toBe(s);
});
it('reorder/group moves retain overrides; replacement, quantity/unit changes and removal invalidate only affected overrides',()=>{
 const r=recipe(),s=setCookingQuantity(setCookingQuantity(reconcileCookingSession(r),'a',150,'mL'),'b',160,'mL');
 const moved={...r,revision:2,ingredientGroups:[{id:'g',name:'Group'}],lines:[...r.lines].reverse().map(l=>({...l,groupId:'g'}))};expect(reconcileCookingSession(moved,s).quantityOverrides).toEqual(s.quantityOverrides);
 for(const patch of [{ingredientId:'other'},{quantity:131},{unit:'g'},{source:'batch' as const,sourceBatchId:'source'}])expect(reconcileCookingSession({...r,revision:2,lines:[{...r.lines[0],...patch},r.lines[1]]},s).quantityOverrides?.map(o=>o.entryId)).toEqual(['b']);
 expect(reconcileCookingSession({...r,revision:2,lines:[r.lines[1]]},s).quantityOverrides?.map(o=>o.entryId)).toEqual(['b']);
});
it('ambiguous legacy repeated names never transfer overrides',()=>{
 const r=recipe();r.lines=r.lines.map(({lineId,...l})=>l);const s=reconcileCookingSession(r),modified=setCookingQuantity(s,s.entries[0].id,150,'mL');
 expect(reconcileCookingSession(r,modified).quantityOverrides).toEqual(modified.quantityOverrides);expect(reconcileCookingSession({...r,revision:2},modified).quantityOverrides).toEqual([]);
});
it('persists overrides across reopen/refresh and completion without any recipe, snapshot or inventory writes',async()=>{
 const r=recipe();await recipes.put(r);const before=await exportAll();let s=await openCookingSession(r);s=await saveCookingSession(s,setCookingQuantity(s,'a',150.123456,'mL'));s=await saveCookingSession(s,{...s,checked:['b']});db.close();await db.open();expect(await openCookingSession(r)).toEqual(s);
 const restored=await saveCookingSession(s,restoreCookingQuantity(s,'a'));expect(restored.checked).toEqual(['b']);await saveCookingSession(restored,{...restored,status:'completed'});expect((await openCookingSession(r)).quantityOverrides).toEqual([]);
 const after=await exportAll();for(const key of Object.keys(before.tables).filter(k=>k!=='settings'))expect(after.tables[key]).toEqual(before.tables[key]);expect(db.verno).toBe(8);expect(db.name).toBe('BetterLumi');
});
it('Backup 13 round trips absolute overrides and checks; Backup 12 v1 sessions import unchanged and upgrade only on open',async()=>{
 const r=recipe();await recipes.put(r);let s=await openCookingSession(r);s=await saveCookingSession(s,{...setCookingQuantity(s,'a',150.987654,'mL'),checked:['b']});const b=await exportAll();expect(b.version).toBe(21);await restoreAll(JSON.parse(JSON.stringify(b)));expect((await exportAll()).tables).toEqual(b.tables);expect(await openCookingSession(r)).toEqual(s);
 const legacy:CookingSession={...s,version:1};delete legacy.quantityOverrides;const old=structuredClone(b);old.version=12;const row=old.tables.settings.find((r:any)=>r.key===COOKING_PREFIX+s.recipeId) as {key:string;value:string};row.value=JSON.stringify(legacy);
 await restoreAll(old);expect((await db.settings.get(row.key))?.value).toBe(row.value);const exported=await exportAll();expect(exported.tables.settings).toEqual(old.tables.settings);expect((await openCookingSession(r))).toMatchObject({version:2,quantityOverrides:[],checked:['b']});
});
it('rejects malformed override backup data before any writes, preserving valid records',async()=>{
 const r=recipe();await recipes.put(r);const initial=await openCookingSession(r);await saveCookingSession(initial,setCookingQuantity(initial,'a',150,'mL'));const before=await exportAll();
 for(const patch of [{quantity:-1},{quantity:null},{quantity:'150'},{entryId:'wrong'},{unit:'g'},{fingerprint:'[]'},{servings:99},{extra:'unvalidated'}]){
  const bad=structuredClone(before);
  // Find by the real recipe association, never by ingredient name.
  const target=bad.tables.settings.find((x:any)=>x.key===COOKING_PREFIX+r.id) as any;const s=JSON.parse(target.value);s.quantityOverrides[0]={...s.quantityOverrides[0],...patch};target.value=JSON.stringify(s);
  await expect(restoreAll(bad)).rejects.toThrow();expect((await exportAll()).tables).toEqual(before.tables);
 }
 const s=setCookingQuantity(reconcileCookingSession(r),'a',150,'mL');expect(()=>validateCookingSession({...s,quantityOverrides:[...s.quantityOverrides!,...s.quantityOverrides!]})).toThrow();
});
it('retains valid stale backup data and invalidates overrides against changed recipe sources only when opened',async()=>{
 const r=recipe();await recipes.put(r);const original=await openCookingSession(r);const s=await saveCookingSession(original,setCookingQuantity(original,'a',150,'mL'));
 await recipes.put({...r,revision:2,lines:r.lines.map(l=>l.lineId==='a'?{...l,ingredientId:'replacement'}:l)});
 const backup=await exportAll();await restoreAll(backup);expect(JSON.parse((await db.settings.get(COOKING_PREFIX+r.id))!.value)).toEqual(s);
 expect((await openCookingSession((await recipes.get(r.id))!)).quantityOverrides).toEqual([]);expect((await recipes.get(r.id))!.lines[0].ingredientId).toBe('replacement');
});
it('failed override saves roll back and stale writers cannot overwrite the committed quantity',async()=>{
 const r=recipe(),s=await openCookingSession(r),next=await saveCookingSession(s,setCookingQuantity(s,'a',150,'mL'));
 await expect(saveCookingSession(s,setCookingQuantity(s,'a',999,'mL'))).rejects.toThrow('changed');
 const fail=()=>{throw Error('injected')};db.settings.hook('updating',fail);
 try{await expect(saveCookingSession(next,setCookingQuantity(next,'a',160,'mL'))).rejects.toThrow('injected')}finally{db.settings.hook('updating').unsubscribe(fail)}
 expect(await openCookingSession(r)).toEqual(next);
});
