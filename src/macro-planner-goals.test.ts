import 'fake-indexeddb/auto';
import {it,expect,afterEach,beforeEach} from 'vitest';
import {db,stamp,exportAll,restoreAll} from './domain';
import {goalTable,activeGoal,goalEditContext} from './goals';
import {applyCalculatorPlan} from './calculator-goals';
import {calculateMacroPlan} from './macro-planner';
import {planInteractively} from './interactive-planner';
import {acceptableRange} from './goal-tolerance-model';
const date='2039-04-12',draft={age:38,targetWeight:76,duration:20,durationUnit:'weeks' as const,weightUnit:'kg' as const,sex:'male' as const,activity:'light' as const,excluded:false,exerciseEnabled:true,exerciseMinutes:150};
const input={...draft,heightCm:178,currentWeight:80};
beforeEach(async()=>{await db.settings.put({key:'heightCm',value:'178'})});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('atomically applies complete daily nutrition and weekly exercise, preserving precision and history',async()=>{
 const old={...stamp(),startDate:'2039-01-01',endDate:null,calorieMin:1700,calorieMax:1900,exerciseMinutes:25,exerciseKcal:90};await goalTable.add(old);const before=await exportAll();const result=planInteractively(input,draft),macros=calculateMacroPlan(80,result.targetKcal)!;
 await applyCalculatorPlan(draft,input,'plan',date);const rows=await goalTable.toArray(),g=activeGoal(rows,date)!;expect(await goalTable.get(old.id)).toEqual(old);expect(rows).toHaveLength(3);expect(g.nutritionTargets).toMatchObject({calories:result.targetKcal,protein:macros.protein,carbs:macros.carbs,fat:macros.fat});expect(g.nutritionFrequency).toBe('daily');expect(g.exerciseMode).toBe('weekly');expect(g.exerciseMinutes).toBe(150);for(const key of ['protein','carbs','fat'] as const)expect(g.nutritionGoals![key]).toMatchObject({mode:'daily',...acceptableRange(macros[key],{protein:10,carbs:15,fat:5}[key])});
 const sum=g.nutritionTargets!.protein!*4+g.nutritionTargets!.carbs!*4+g.nutritionTargets!.fat!*9;expect(sum).toBeCloseTo(result.targetKcal!,9);const after=await exportAll();for(const key of Object.keys(before.tables))if(!['goals','settings'].includes(key))expect(after.tables[key]).toEqual(before.tables[key]);expect(after.version).toBe(11);expect(db.verno).toBe(7);await restoreAll(after);expect(await goalTable.toArray()).toEqual(rows);await applyCalculatorPlan(draft,input,'plan',date);expect(await goalTable.count()).toBe(3);
});
it('changing scheme is preview only until applied and does not change calorie or exercise targets',async()=>{
 await applyCalculatorPlan(draft,input,'plan',date);const before=await goalTable.toArray(),first=activeGoal(before,date)!;calculateMacroPlan(80,first.nutritionTargets!.calories!,'highProtein');expect(await goalTable.toArray()).toEqual(before);await applyCalculatorPlan({...draft,nutritionPlan:'highProtein'},input,'plan',date);const g=activeGoal(await goalTable.toArray(),date)!;expect(g.nutritionTargets!.protein).toBe(128);expect(g.nutritionTargets!.calories).toBe(first.nutritionTargets!.calories);expect(g.exerciseMinutes).toBe(first.exerciseMinutes);expect(await goalTable.count()).toBe(3);for(const row of before)expect(await goalTable.get(row.id)).toEqual(row);
});
it('nutrition-only application preserves legacy exercise enablement and its exact period',async()=>{
 const old={...stamp(),startDate:'2039-01-01',endDate:'2039-05-01',calorieMin:1700,calorieMax:1900,exerciseMinutes:25,exerciseKcal:90};await goalTable.add(old);await applyCalculatorPlan({...draft,exerciseEnabled:false},input,'plan',date);const g=activeGoal(await goalTable.toArray(),date)!;expect(g.exerciseEnabled).toBe(true);expect(g.exerciseMinutes).toBe(25);expect(g.exercisePeriod).toEqual({startDate:old.startDate,endDate:old.endDate});expect(activeGoal(await goalTable.toArray(),'2039-05-02')!.exerciseEnabled).toBe(false);expect(await goalTable.get(old.id)).toEqual(old);
});
it('professional mode never generates macros and preserves manually configured macro targets',async()=>{
 await applyCalculatorPlan(draft,input,'plan',date);const before=activeGoal(await goalTable.toArray(),date)!;const special={...draft,specialOrProfessionalGuidance:true,professionalKcal:1050,nutritionPlan:'highProtein' as const};await applyCalculatorPlan(special,input,'professional',date);const g=activeGoal(await goalTable.toArray(),date)!;expect(g.nutritionTargets!.calories).toBe(1050);for(const key of ['protein','carbs','fat'] as const)expect(g.nutritionTargets![key]).toBe(before.nutritionTargets![key]);
});
it('a nonpositive calorie calculation rejects the entire plan even through the legacy eligible action',async()=>{for(const choice of ['plan','eligible'] as const)await expect(applyCalculatorPlan({...draft,duration:1},{...input,duration:1},choice,date)).rejects.toThrow('No complete calculator plan');expect(await goalTable.count()).toBe(0)});
it('AMDR caution does not block applying a calorie-eligible high-protein plan',async()=>{
 await db.settings.put({key:'heightCm',value:'165'});const currentWeight=56.65,targetWeight=currentWeight-(1466.1-1284)*10/1100;
 const p={...draft,age:43,targetWeight,duration:10,sex:'female' as const,activity:'sedentary' as const,exerciseEnabled:false,nutritionPlan:'highProtein' as const},body={...input,...p,currentWeight,heightCm:165};const plan=planInteractively(body,p),macros=calculateMacroPlan(currentWeight,plan.targetKcal,p.nutritionPlan)!;expect(plan.nutritionApplicable).toBe(true);expect(macros.cautions.map(c=>c.nutrient)).toContain('carbs');await applyCalculatorPlan(p,body,'plan',date);expect(activeGoal(await goalTable.toArray(),date)?.nutritionTargets?.carbs).toBe(macros.carbs);
});
it('nutrition-only versions cannot suppress a previously scheduled exercise goal after an unrestricted baseline',async()=>{
 const baseline={...stamp(),revision:1,startDate:'2039-01-01',endDate:null,nutritionEnabled:false,exerciseEnabled:true,exercisePeriod:{startDate:'2039-01-01',endDate:null,unrestricted:true},calorieMin:null,calorieMax:null,exerciseMinutes:25,exerciseKcal:90};
 const scheduled={...stamp(),revision:2,scope:'exercise' as const,startDate:'2039-05-01',endDate:null,nutritionEnabled:false,exerciseEnabled:true,exerciseMode:'weekly' as const,exercisePeriod:{startDate:'2039-05-01',endDate:null},calorieMin:null,calorieMax:null,exerciseMinutes:180,exerciseKcal:700};await goalTable.bulkAdd([baseline,scheduled]);await applyCalculatorPlan({...draft,exerciseEnabled:false},input,'plan',date);const rows=await goalTable.toArray();expect(rows.some(row=>row.nutritionOnly)).toBe(true);expect(activeGoal(rows,date)?.exerciseMinutes).toBe(25);expect(activeGoal(rows,'2039-05-01')?.exerciseMinutes).toBe(180);expect(activeGoal(rows,'2039-05-01')?.exerciseMode).toBe('weekly');expect(await goalTable.get(baseline.id)).toEqual(baseline);expect(await goalTable.get(scheduled.id)).toEqual(scheduled);const backup=await exportAll();await restoreAll(backup);expect(activeGoal(await goalTable.toArray(),'2039-05-01')?.exerciseMinutes).toBe(180);
});
it('retains weekly-average tracking while macro targets remain average grams per day',async()=>{
 const off={mode:'off' as const,min:null,max:null};await goalTable.add({...stamp(),startDate:'2039-01-01',endDate:null,nutritionFrequency:'weekly',calorieMin:1800,calorieMax:1900,exerciseMinutes:null,exerciseKcal:null,nutritionGoals:{calories:{mode:'weekly',min:1800,max:1900},protein:off,carbs:off,fat:off}});await applyCalculatorPlan(draft,input,'plan',date);const rows=await goalTable.toArray(),g=activeGoal(rows,date)!;expect(g.nutritionFrequency).toBe('weekly');expect(g.nutritionTargets!.protein).toBeCloseTo(112,9);for(const key of ['calories','protein','carbs','fat'] as const)expect(g.nutritionGoals![key].mode).toBe('weekly');expect(g.nutritionOnly).toBeUndefined();expect(rows.find(row=>row.nutritionOnly)?.nutritionGoals!.protein.mode).toBe('weekly');
});
it('does not reuse a nutrition-only record as the editable full nutrition/exercise goal version',async()=>{
 await applyCalculatorPlan(draft,input,'plan',date);const rows=await goalTable.toArray(),current=activeGoal(rows,date)!;expect(goalEditContext(rows,current)).toBeUndefined();
});
it('uses saved tolerance preferences for all four nutrient ranges',async()=>{
 const values={calories:25,protein:3,carbs:7,fat:2};await db.settings.put({key:'goalTolerances',value:JSON.stringify({version:1,events:[{id:'synthetic-tolerances',date,at:date+'T10:00:00Z',values}]})});await applyCalculatorPlan(draft,input,'plan',date);const g=activeGoal(await goalTable.toArray(),date)!;for(const key of ['calories','protein','carbs','fat'] as const)expect(g.nutritionGoals![key]).toMatchObject(acceptableRange(g.nutritionTargets![key],values[key]));expect(g.nutritionTolerances).toEqual(values);
});

it.each(['balanced','highProtein'] as const)('applies all five targets below calorie references with AMDR warnings: %s',async nutritionPlan=>{
 await db.settings.put({key:'heightCm',value:'166'});const weight=56,age=48,baseline=(10*weight+6.25*166-5*age-161)*1.2,extra=3*weight*150/60/7,targetWeight=weight-(baseline+extra-1184)*12/1100;
 const preferences={...draft,age,sex:'female' as const,activity:'sedentary' as const,targetWeight,duration:12,nutritionPlan},body={...preferences,heightCm:166,currentWeight:weight};const p=planInteractively(body,preferences),m=calculateMacroPlan(weight,p.targetKcal,nutritionPlan)!;expect(p.targetKcal).toBe(1184);expect(p.assessment.withinPlanningRange).toBe(false);expect(m.cautions.length).toBeGreaterThan(0);
 const off={mode:'off' as const,min:null,max:null},old={...stamp(),startDate:'2038-01-01',endDate:null,nutritionEnabled:false,exerciseEnabled:false,calorieMin:null,calorieMax:null,exerciseMinutes:null,exerciseKcal:null,nutritionGoals:{calories:off,protein:off,carbs:off,fat:off}};await goalTable.put(old);const before=await exportAll();
 const outcome=await applyCalculatorPlan(preferences,body,'plan',date);expect(outcome).toMatchObject({nutrition:true,exercise:true});const rows=await goalTable.toArray(),g=activeGoal(rows,date)!;expect(g.nutritionTargets).toEqual({calories:1184,protein:m.protein,carbs:m.carbs,fat:m.fat});expect(g).toMatchObject({nutritionEnabled:true,exerciseEnabled:true,exerciseMode:'weekly',exerciseMinutes:150,exerciseKcal:420});for(const key of ['calories','protein','carbs','fat'] as const)expect(g.nutritionGoals![key].mode).toBe('daily');expect(await goalTable.get(old.id)).toEqual(old);
 const after=await exportAll();for(const key of Object.keys(before.tables))if(!['goals','settings'].includes(key))expect(after.tables[key]).toEqual(before.tables[key]);expect(after.version).toBe(11);expect(db.verno).toBe(7);await restoreAll(after);expect(activeGoal(await goalTable.toArray(),date)!.nutritionTargets).toEqual(g.nutritionTargets);await applyCalculatorPlan(preferences,body,'plan',date);expect(await goalTable.count()).toBe(rows.length);
});
it('does not apply even exercise when a positive calorie target cannot produce nonnegative macros',async()=>{
 const targetWeight=80-(2375.3125+600/7-100)*20/1100,preferences={...draft,targetWeight};const body={...input,targetWeight};expect(planInteractively(body,preferences).targetKcal).toBe(100);await expect(applyCalculatorPlan(preferences,body,'eligible',date)).rejects.toThrow('No complete calculator plan');expect(await goalTable.count()).toBe(0);
});
it('late exercise write failure rolls back all nutrition targets and the draft',async()=>{
 const before=await exportAll();const fail=(_key:unknown,row:{scope?:string})=>{if(row.scope==='exercise')throw Error('Synthetic exercise write failure')};goalTable.hook('creating',fail);
 try{await expect(applyCalculatorPlan(draft,input,'plan',date)).rejects.toThrow('Synthetic exercise write failure')}finally{goalTable.hook('creating').unsubscribe(fail)}expect((await exportAll()).tables).toEqual(before.tables);
});
it('technical missing values and unsupported units cannot become partial plans',async()=>{
 for(const patch of [{targetWeight:null},{duration:null},{duration:0},{currentWeight:null},{currentWeight:NaN},{sex:''},{weightUnit:'stone'},{durationUnit:'days'}]){const body={...input,...patch} as typeof input;await expect(applyCalculatorPlan(draft,body,'eligible',date)).rejects.toThrow();expect(await goalTable.count()).toBe(0)}
});
