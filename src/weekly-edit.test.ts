import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {db,stamp} from './db';
import {exercisePlans,exerciseOccurrences,togglePlanWeekday,completeExerciseOccurrence} from './exercise-plans';
const plan=(schedule:'daily'|'weekdays'|'custom'='daily',days:number[]=[])=>({...stamp(),name:'Plan',enabled:true,schedule,days,dates:[],notes:'Keep',exercises:[{id:'walk',name:'Walk',duration:20,distance:null,notes:''}]});
afterEach(async()=>{vi.restoreAllMocks();await exercisePlans.clear();await exerciseOccurrences.clear();await db.activities.clear()});
it('changes recurrence only, preserves occurrences and actual records, and converts defaults to custom',async()=>{
 const daily=plan();await exercisePlans.put(daily);await completeExerciseOccurrence(daily.id,'walk','2026-10-18',true);const check=await exerciseOccurrences.toArray();const activity={...stamp(),date:'2026-10-18',type:'other' as const,duration:17,distance:null,notes:'Real',caloriesBurned:null};await db.activities.put(activity);const allActual=await db.activities.toArray();
 const changed=await togglePlanWeekday(daily.id,0,daily.revision);expect(changed.schedule).toBe('custom');expect(changed.days).toEqual([1,2,3,4,5,6]);expect(changed.exercises).toEqual(daily.exercises);expect(await exerciseOccurrences.toArray()).toEqual(check);expect(await db.activities.toArray()).toEqual(allActual);
 const weekdays=plan('weekdays');await exercisePlans.put(weekdays);expect((await togglePlanWeekday(weekdays.id,6,weekdays.revision)).days).toEqual([1,2,3,4,5,6]);
});
it('rejects zero days, stale edits and date-specific plans without rewriting them',async()=>{
 const one=plan('custom',[1]);await exercisePlans.put(one);await expect(togglePlanWeekday(one.id,1,one.revision)).rejects.toThrow();await expect(togglePlanWeekday(one.id,2,99)).rejects.toThrow();expect(await exercisePlans.get(one.id)).toEqual(one);
 const legacy={...plan(),schedule:'dates' as const,dates:['2026-10-18']};await exercisePlans.put(legacy);await expect(togglePlanWeekday(legacy.id,1,legacy.revision)).rejects.toThrow();expect(await exercisePlans.get(legacy.id)).toEqual(legacy);
});
it('rolls back a rejected persistence operation',async()=>{const row=plan();await exercisePlans.put(row);vi.spyOn(exercisePlans,'put').mockRejectedValueOnce(Error('Rejected'));await expect(togglePlanWeekday(row.id,0,row.revision)).rejects.toThrow('Rejected');expect(await exercisePlans.get(row.id)).toEqual(row)});
