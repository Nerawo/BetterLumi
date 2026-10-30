import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {db} from './db';
import {foodLogs} from './domain';
import {createAIMealSession} from './ai-meal-session';
import {createAIMealDraft} from './ai-meal-state';
import {saveAIMealDraft,loadAIMealDraft} from './ai-meal-storage';
import {dailyAggregation} from './aggregation';
const raw=JSON.stringify({format:'betterlumi-meal',version:1,meals:[{date:'2026-11-09',mealType:null,items:[{name:'Session food',date:null,mealType:null,amount:1,unit:'piece',weightG:100,consumedFraction:.5,nutrition:{calories:211.123456,protein:5,carbs:20,fat:0},estimated:true,notes:'Keep note',splitSuggestions:[]}]}]});
const fill=(s:ReturnType<typeof createAIMealSession>)=>s.change(d=>({...createAIMealDraft(raw,d.id),revision:d.revision,importId:d.importId}));
afterEach(async()=>{vi.useRealTimers();for(const t of db.tables)await t.clear()});
it('starts distinct empty visits without loading or overwriting old drafts or other settings',async()=>{
 const old=await saveAIMealDraft(createAIMealDraft(raw,'current'));await db.settings.put({key:'language',value:'zh'});const a=createAIMealSession(),b=createAIMealSession();expect(a.getSnapshot().draft.raw).toBe('');expect(b.getSnapshot().draft.id).not.toBe(a.getSnapshot().draft.id);fill(a);await a.flush();expect(b.getSnapshot().draft.raw).toBe('');expect(await loadAIMealDraft('current')).toEqual(old);expect((await db.settings.get('language'))?.value).toBe('zh');await a.discard();await b.discard();
});
it('discards only the confirmed visit, fences pending saves, and never resurrects a discarded draft',async()=>{
 const a=createAIMealSession(),b=createAIMealSession();fill(a);fill(b);await b.flush();const bSaved=await loadAIMealDraft(b.getSnapshot().draft.id);const pending=a.flush();const close=a.discard();await pending;await close;const stored=await loadAIMealDraft(a.getSnapshot().draft.id);expect(stored?.raw).toBe('');expect(stored?.rows).toEqual([]);expect(()=>fill(a)).toThrow();await a.flush();expect(await loadAIMealDraft(b.getSnapshot().draft.id)).toEqual(bSaved);await b.discard();
});
it('preserves exact edited drafts on failed import and retries once without double-applying fractions',async()=>{
 const s=createAIMealSession();fill(s);await s.flush();const before=structuredClone(s.getSnapshot().draft),fail=()=>{throw Error('Injected failure')};foodLogs.hook('creating',fail);try{await expect(s.importDraft('en')).rejects.toThrow('Injected failure')}finally{foodLogs.hook('creating').unsubscribe(fail)}expect(s.getSnapshot().draft).toEqual(before);expect(s.dirty()).toBe(true);expect(await foodLogs.count()).toBe(0);const a=s.importDraft('en'),b=s.importDraft('en');expect(a).toBe(b);await a;expect(s.dirty()).toBe(false);expect(s.getSnapshot().draft.raw).toBe('');expect(await foodLogs.count()).toBe(1);const log=(await foodLogs.toArray())[0];expect(log.category).toBe('uncategorized');expect(log.nutrition.calories).toBe(211.123456);expect(dailyAggregation(log.date,[log],[]).nutrition).toEqual(log.nutrition);await s.discard();
});
it('ignores old recovery journals and remains editable throughout one visit',async()=>{
 const s=createAIMealSession();fill(s);const id=s.getSnapshot().draft.id;s.change(d=>({...d,raw:'Incomplete new reply'}));await s.flush();expect(s.getSnapshot().draft.id).toBe(id);expect(s.getSnapshot().draft.rows[0].item.name).toBe('Session food');const next=createAIMealSession();expect(next.getSnapshot().draft.raw).toBe('');await s.discard();await next.discard();
});

it('clearing the last raw text and rows before leaving also clears the older persisted snapshot',async()=>{
 const s=createAIMealSession();fill(s);await s.flush();const id=s.getSnapshot().draft.id;s.change(d=>({...d,raw:'',rows:[],splits:{}}));expect(s.dirty()).toBe(false);await s.discard();expect((await loadAIMealDraft(id))?.raw).toBe('');expect((await loadAIMealDraft(id))?.rows).toEqual([]);
});
