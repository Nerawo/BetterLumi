// Fictional regression data; never seed these tests from a personal journal or export.
import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect} from 'vitest';
import {db,stamp,exportAll,restoreAll} from './domain';
import {goalTable,activeGoal,sectionGoal} from './goals';
import {applyInteractiveGoals,applyCalculatorPlan} from './calculator-goals';
import type {PlanAssessmentInput} from './goal-plan-assessment';
const date='2026-10-21',input:PlanAssessmentInput={age:30,heightCm:175,currentWeight:85,targetWeight:80,weightUnit:'kg',duration:20,durationUnit:'weeks',activity:'light',sex:'male',excluded:false};
beforeEach(async()=>{await db.settings.put({key:'heightCm',value:'175'});await goalTable.put({...stamp(),startDate:'2026-09-01',endDate:'2026-11-01',nutritionEnabled:true,calorieMin:1600,calorieMax:1800,exerciseMinutes:30,exerciseKcal:100,exerciseMode:'daily',nutritionGoals:{calories:{mode:'daily',min:1600,max:1800},protein:{mode:'daily',min:70,max:90},carbs:{mode:'off',min:null,max:null},fat:{mode:'off',min:null,max:null}}})});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('applies nutrition then exercise independently without losing either override or history',async()=>{
 const before=await goalTable.toArray();await applyInteractiveGoals(input,{exerciseEnabled:true},'nutrition',date);let current=activeGoal(await goalTable.toArray(),date)!;expect(current.calorieMin).toBe(2239);expect(current.exerciseMinutes).toBe(30);expect(current.exerciseMode).toBe('daily');
 await applyInteractiveGoals(input,{exerciseEnabled:true},'exercise',date);current=activeGoal(await goalTable.toArray(),date)!;expect(current.nutritionGoals!.protein.min).toBe(70);expect(current.calorieMin).toBe(2239);expect(current.exerciseMinutes).toBe(150);expect(current.exerciseKcal).toBe(638);expect(current.exerciseMode).toBe('weekly');expect(await goalTable.get(before[0].id)).toEqual(before[0]);expect(await goalTable.count()).toBe(3);
 expect(activeGoal(await goalTable.toArray(),'2026-10-20')!.exerciseMinutes).toBe(30);expect(activeGoal(await goalTable.toArray(),'2026-11-03')!.nutritionGoals!.protein.mode).toBe('off');
 const backup=await exportAll();expect(backup.version).toBe(9);await restoreAll(backup);expect(activeGoal(await goalTable.toArray(),date)!.calorieMin).toBe(2239);expect(sectionGoal(await goalTable.toArray(),date,date,'exercise')!.scope).toBe('exercise');
 const bad=structuredClone(backup);bad.version=8;const all=await goalTable.toArray();await expect(restoreAll(bad)).rejects.toThrow();expect(await goalTable.toArray()).toEqual(all);
});
it('exercise first cannot suppress a later calorie override or extend expired macros',async()=>{
 await applyInteractiveGoals(input,{exerciseEnabled:true,exerciseMinutes:0,exerciseCustom:true,exerciseCalories:0},'exercise',date);await applyInteractiveGoals(input,{},'nutrition',date);const g=activeGoal(await goalTable.toArray(),date)!;expect(g.exerciseMinutes).toBe(0);expect(g.exerciseKcal).toBe(0);expect(g.exerciseMode).toBe('weekly');expect(g.calorieMin).toBe(2148);expect(g.nutritionGoals!.protein.mode).toBe('daily');
});
it('unsafe values, excluded profiles and disabled exercise cannot write goals',async()=>{
 for(const p of [{...input,duration:1},{...input,targetWeight:30},{...input,excluded:true}])await expect(applyInteractiveGoals(p,{},'nutrition',date)).rejects.toThrow();
 await expect(applyInteractiveGoals(input,{exerciseEnabled:false},'exercise',date)).rejects.toThrow();expect(await goalTable.count()).toBe(1);
});
it('legacy v8 backups remain exact and custom drafts round trip separately',async()=>{
 const old=await exportAll();old.version=8;await restoreAll(old);expect(await goalTable.toArray()).toEqual(old.tables.goals);expect(db.verno).toBe(6);
});

it('cannot use a legacy manual calorie override when applying computed goals',async()=>{
 await applyInteractiveGoals(input,{exerciseEnabled:true,plannerMode:'intake',dailyIntake:1,exerciseCustom:true,exerciseCalories:100000},'nutrition',date);expect(activeGoal(await goalTable.toArray(),date)!.calorieMin).toBe(2239);
 await applyInteractiveGoals(input,{exerciseEnabled:true,exerciseCustom:true,exerciseCalories:100000},'exercise',date);expect(activeGoal(await goalTable.toArray(),date)!.exerciseKcal).toBe(638);
});

it('flagged nutrition stays blocked while explicit maintenance preserves other goals and history',async()=>{
 const risky={...input,duration:1},before=await goalTable.toArray();
 await expect(applyInteractiveGoals(risky,{exerciseEnabled:true},'nutrition',date)).rejects.toThrow();
 const saved=await applyInteractiveGoals(risky,{exerciseEnabled:true},'maintenance',date);
 expect(saved.target).toBeGreaterThan(2000);expect(saved.max-saved.min).toBe(100);
 const current=activeGoal(await goalTable.toArray(),date)!;expect(current.nutritionGoals!.protein.min).toBe(70);expect(current.exerciseMinutes).toBe(30);expect(await goalTable.get(before[0].id)).toEqual(before[0]);
 await applyInteractiveGoals(risky,{exerciseEnabled:true},'exercise',date);expect(activeGoal(await goalTable.toArray(),date)!.exerciseMinutes).toBe(150);
});
it('no conservative target can bypass excluded, minor, underweight or unknown-coefficient screening',async()=>{
 for(const partial of [{excluded:true},{age:17},{currentWeight:50},{sex:'' as const}])await expect(applyInteractiveGoals({...input,...partial},{},'maintenance',date)).rejects.toThrow();
 expect(await goalTable.count()).toBe(1);
});

const draft={age:30,targetWeight:80,weightUnit:'kg' as const,duration:20,durationUnit:'weeks' as const,activity:'light' as const,sex:'male' as const,excluded:false,exerciseEnabled:true,exerciseMinutes:150};
it('unified application is atomic, idempotent and preserves unrelated history',async()=>{
 const original=await goalTable.toArray();const result=await applyCalculatorPlan(draft,input,'plan',date);expect(result).toMatchObject({nutrition:true,exercise:true});expect(await goalTable.count()).toBe(3);
 await applyCalculatorPlan(draft,input,'plan',date);expect(await goalTable.count()).toBe(3);expect(await goalTable.get(original[0].id)).toEqual(original[0]);
 const g=activeGoal(await goalTable.toArray(),date)!;expect(g.exerciseMode).toBe('weekly');expect(g.calorieMin).toBe(2239);expect(g.nutritionGoals!.protein.min).toBeCloseTo(109,9);
});
it('flagged plan saves only eligible exercise and cannot substitute a maintenance goal',async()=>{
 const risky={...input,duration:1},preferences={...draft,duration:1};await expect(applyCalculatorPlan(preferences,risky,'plan',date)).rejects.toThrow();expect(await goalTable.count()).toBe(1);
 await applyCalculatorPlan(preferences,risky,'eligible',date);expect(await goalTable.count()).toBe(2);expect(activeGoal(await goalTable.toArray(),date)!.calorieMin).toBe(1600);
 await applyCalculatorPlan(preferences,risky,'eligible',date);expect(await goalTable.count()).toBe(2);expect(activeGoal(await goalTable.toArray(),date)!.calorieMin).toBe(1600);
 expect(JSON.parse((await db.settings.get('healthGoalCalculatorDraft'))!.value).value).toEqual(preferences);
});
it('a final draft write failure rolls back nutrition and exercise versions together',async()=>{
 const original=await goalTable.toArray();const fail=()=>{throw Error('Storage unavailable')};db.settings.hook('creating',fail);
 try{await expect(applyCalculatorPlan(draft,input,'plan',date)).rejects.toThrow('Storage unavailable')}finally{db.settings.hook('creating').unsubscribe(fail)}
 expect(await goalTable.toArray()).toEqual(original);expect(await db.settings.get('healthGoalCalculatorDraft')).toBeUndefined();
});
it('new effective dates append versions and disabled exercise never changes its saved goal',async()=>{
 await applyCalculatorPlan(draft,input,'plan',date);await applyCalculatorPlan(draft,input,'plan','2026-10-22');expect(await goalTable.count()).toBe(5);
 await applyCalculatorPlan({...draft,exerciseEnabled:false},input,'plan','2026-10-23');expect(await goalTable.count()).toBe(6);expect(activeGoal(await goalTable.toArray(),'2026-10-23')!.exerciseMinutes).toBe(150);
});
it('excluded profiles cannot produce preference-only or misleading successful applications',async()=>{
 await expect(applyCalculatorPlan({...draft,excluded:true},{...input,excluded:true},'eligible',date)).rejects.toThrow('No eligible goals');expect(await goalTable.count()).toBe(1);expect(await db.settings.get('healthGoalCalculatorDraft')).toBeUndefined();
});

it('nutrition tolerance failures cannot block an exercise-only eligible save',async()=>{
 await db.settings.put({key:'goalTolerances',value:'invalid'});await applyCalculatorPlan({...draft,duration:1},{...input,duration:1},'eligible',date);expect(await goalTable.count()).toBe(2);expect(activeGoal(await goalTable.toArray(),date)!.exerciseMinutes).toBe(150);
});

it('applies a cautionary 1284 kcal plan normally and preserves original history and unrelated goals',async()=>{
 await db.settings.put({key:'heightCm',value:'165'});const before=await goalTable.toArray();const currentWeight=56.65,targetWeight=currentWeight-(1466.1-1284)*10/1100;
 const body={...input,age:43,heightCm:165,currentWeight,targetWeight,duration:10,sex:'female' as const,activity:'sedentary' as const},preferences={...draft,age:43,targetWeight,duration:10,sex:'female' as const,activity:'sedentary' as const,exerciseEnabled:false};
 await applyCalculatorPlan(preferences,body,'plan',date);const rows=await goalTable.toArray(),current=activeGoal(rows,date)!;expect(rows).toHaveLength(2);expect(current.calorieMin).toBe(1234);expect(current.calorieMax).toBe(1334);expect(current.exerciseMinutes).toBe(30);expect(current.nutritionGoals!.protein.min).toBeCloseTo(body.currentWeight!*1.4-10,9);expect(await goalTable.get(before[0].id)).toEqual(before[0]);expect(rows.find(g=>g.nutritionTargets?.carbs!=null)!.nutritionTargets!.calories).toBe(1284);
});

it.each([19.8,20.2])('unified apply saves nutrition and exercise at BMI %s without rewriting history',async currentBmi=>{
 await db.settings.put({key:'heightCm',value:'166'});const before=await goalTable.toArray(),targetWeight=(currentBmi-.2)*1.66**2;
 const body={...input,age:43,heightCm:166,currentWeight:currentBmi*1.66**2,targetWeight,duration:12,sex:'female' as const},preferences={...draft,age:43,targetWeight,duration:12,sex:'female' as const};
 await applyCalculatorPlan(preferences,body,'plan',date);const rows=await goalTable.toArray(),current=activeGoal(rows,date)!;expect(rows).toHaveLength(3);expect(rows.find(r=>r.id===before[0].id)).toEqual(before[0]);expect(current.nutritionGoals!.protein.min).toBeCloseTo(body.currentWeight!*1.4-10,9);expect(current.exerciseMode).toBe('weekly');expect(current.exerciseMinutes).toBe(150);expect(rows.find(r=>r.nutritionTargets?.carbs!=null)!.nutritionTargets!.calories).toBeGreaterThan(1200);await applyCalculatorPlan(preferences,body,'plan',date);expect(await goalTable.count()).toBe(3);
});
