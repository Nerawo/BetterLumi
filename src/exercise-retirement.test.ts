import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import {db,stamp,exportAll,restoreAll} from './domain';
import {goalTable} from './goals';
import {applyCalculatorPlan} from './calculator-goals';
import {planInteractively} from './interactive-planner';
import {todayOverview} from './TodayProgress';
import {todayTabs} from './TodayTabs';
afterEach(async()=>{for(const t of db.tables)await t.clear()});
it('keeps five Today destinations without movement',()=>expect(todayTabs).toEqual(['food','supplements','weight','more','calculator']));
it('legacy exercise cannot change nutrition progress or calculator estimates and survives backup',async()=>{
 const draft={age:30,weightUnit:'kg' as const,targetWeight:70,duration:20,durationUnit:'weeks' as const,sex:'male' as const,activity:'light' as const,excluded:false,exerciseEnabled:true,exerciseMinutes:150},input={...draft,currentWeight:75,heightCm:175};
 const before=planInteractively(input,draft),empty=todayOverview([],'2039-01-01',[],[]);
 const activity={...stamp(),date:'2039-01-01',name:'Legacy',type:'other' as const,duration:60,caloriesBurned:900,distance:null,notes:''};await db.activities.put(activity);
 expect(planInteractively(input,draft)).toEqual(before);expect(todayOverview([],'2039-01-01',[],[activity])).toEqual(empty);
 const changed=planInteractively(input,{...draft,exerciseMinutes:300});expect(changed.targetKcal).toBeGreaterThan(before.targetKcal!);
 await db.settings.put({key:'heightCm',value:'175'});await applyCalculatorPlan(draft,input,'plan','2039-01-01');expect((await goalTable.toArray()).every(g=>g.nutritionOnly)).toBe(true);expect(await db.activities.toArray()).toEqual([activity]);
 const backup=await exportAll();expect(backup.version).toBe(14);expect(db.verno).toBe(7);await restoreAll(backup);expect(await db.activities.get(activity.id)).toEqual(activity);
});

it('legacy plans, occurrences, linked actual records and settings round-trip without loss',async()=>{
 const {exercisePlans,completeExerciseOccurrence,saveExercisePlan}=await import('./exercise-plans');
 const plan={...stamp(),name:'Legacy plan',enabled:true,schedule:'daily' as const,days:[],dates:[],notes:'Preserve',exercises:[{id:'legacy-walk',name:'Legacy walk',duration:30,distance:null,estimatedCalories:120,notes:'Original'}]};
 await saveExercisePlan(plan);await completeExerciseOccurrence(plan.id,'legacy-walk','2020-01-01',true);await db.settings.put({key:'legacyExercisePreference',value:'unchanged'});
 const before=await exportAll();expect(before.tables.exerciseOccurrences).toHaveLength(1);expect(before.tables.activities).toHaveLength(1);await restoreAll(before);expect((await exportAll()).tables).toEqual(before.tables);expect(await exercisePlans.get(plan.id)).toEqual(plan);
});
