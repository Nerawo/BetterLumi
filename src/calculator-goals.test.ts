import 'fake-indexeddb/auto';
import {beforeEach,afterEach,expect,it} from 'vitest';
import {db,weights,stamp,exportAll,restoreAll} from './domain';
import {applyCalculatorGoals} from './calculator-goals';
import {goalTable,activeGoal,goalEditContext,sectionGoal,type Goal} from './goals';
import {nutritionGoals} from './goal-model';
import {weeklyStatistics} from './weekly-goals';
import {defaultGoalTolerances} from './goal-tolerance-model';
import type {CalculatorInput} from './health-calculator';
const date='2026-10-21';
const input:CalculatorInput={age:30,heightCm:175,currentWeight:85,targetWeight:80,weightUnit:'kg',duration:20,durationUnit:'weeks',activity:'light',sex:'male',excluded:false};
const legacy=(extra:Partial<Goal>={}):Goal=>({...stamp(),startDate:'2026-09-01',endDate:'2026-11-30',calorieMin:1700,calorieMax:1900,exerciseMinutes:30,exerciseKcal:200,exerciseMode:'daily',nutritionGoals:{calories:{mode:'daily',min:1700,max:1900},protein:{mode:'daily',min:80,max:100},carbs:{mode:'off',min:null,max:null},fat:{mode:'off',min:null,max:null}},...extra});
beforeEach(async()=>{await weights.put({...stamp(),date,kg:85});await db.settings.put({key:'heightCm',value:'175'})});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('appends only calorie history and preserves legacy macros, exercise, all other tables',async()=>{
 const old=legacy();await goalTable.put(old);const before=await exportAll();await applyCalculatorGoals(input,'plan',date);const after=await exportAll();expect(await goalTable.get(old.id)).toEqual(old);expect(await goalTable.count()).toBe(2);
 const current=activeGoal(await goalTable.toArray(),date);expect(current).toMatchObject({exerciseMode:'daily',exerciseMinutes:30,exerciseKcal:200,calorieMin:2150,calorieMax:2250});expect(current?.nutritionGoals?.protein).toEqual(old.nutritionGoals!.protein);expect(activeGoal(await goalTable.toArray(),'2026-09-15')?.calorieMin).toBe(1700);
 for(const [key,value]of Object.entries(before.tables))if(key!=='goals')expect(after.tables[key]).toEqual(value);
 expect((await goalTable.toArray()).find(g=>g.scope==='calories')).toMatchObject({exerciseEnabled:false,exerciseMinutes:null});
});
it('does not re-enable disabled goals or extend their periods; future exercise versions stay effective',async()=>{
 const old=legacy({endDate:'2026-10-23',nutritionEnabled:false,exerciseEnabled:false}),future=legacy({startDate:'2026-11-01',endDate:null,exerciseEnabled:true,exerciseMode:'weekly',exerciseMinutes:180,revision:2});await goalTable.bulkPut([old,future]);const before=await goalTable.toArray();
 const comparison=(goals:Goal[],day:string)=>{const g=activeGoal(goals,day);return {protein:nutritionGoals(g).protein,exerciseSource:sectionGoal(goals,day,day,'exercise'),exercise:weeklyStatistics(goals,day,[],[]).exercise}};
 const days=['2026-09-15',date,'2026-10-25','2026-11-05'];const expected=days.map(day=>comparison(before,day));await applyCalculatorGoals(input,'plan',date);const after=await goalTable.toArray();expect(days.map(day=>comparison(after,day))).toEqual(expected);
 for(const goal of before)expect(await goalTable.get(goal.id)).toEqual(goal);
});
it('uses saved calorie tolerances and keeps macro/exercise weekly evaluation unchanged',async()=>{
 const old=legacy({endDate:null,nutritionFrequency:'weekly',exerciseMode:'weekly'});old.nutritionGoals!.calories.mode='weekly';old.nutritionGoals!.protein.mode='weekly';await goalTable.put(old);
 const values={...defaultGoalTolerances,calories:80};await db.settings.put({key:'goalTolerances',value:JSON.stringify({version:1,events:[{id:'tolerance',date,at:date+'T00:00:00Z',values}]})});const before=weeklyStatistics(await goalTable.toArray(),date,[],[]);await applyCalculatorGoals(input,'plan',date);const goals=await goalTable.toArray(),after=weeklyStatistics(goals,date,[],[]);expect(activeGoal(goals,date)).toMatchObject({calorieMin:2120,calorieMax:2280,exerciseKcal:200,nutritionFrequency:'weekly'});expect(after.nutrients.protein).toEqual(before.nutrients.protein);expect(after.exercise).toEqual(before.exercise);
 const backup=await exportAll();expect(backup.version).toBe(11);await restoreAll(backup);expect(await goalTable.toArray()).toEqual(goals);const invalid=structuredClone(backup);invalid.version=7;await expect(restoreAll(invalid)).rejects.toThrow();expect(await goalTable.toArray()).toEqual(goals);
});
it('allows maintenance despite an unsafe plan, but never unsafe plan or missing-sex application',async()=>{
 await expect(applyCalculatorGoals({...input,duration:1},'plan',date)).rejects.toThrow();await expect(applyCalculatorGoals({...input,sex:''},'maintenance',date)).rejects.toThrow();expect(await goalTable.count()).toBe(0);
 await applyCalculatorGoals({...input,duration:1},'maintenance',date);const goal=(await goalTable.toArray())[0];expect(goal.nutritionTargets?.calories).toBe(2475);expect(activeGoal([goal],date)).toMatchObject({exerciseEnabled:false,exerciseMinutes:null});
});
it('uses entered calculation weight without journal writes, while guarding stale height',async()=>{
 const before=await weights.toArray();const saved=await applyCalculatorGoals({...input,currentWeight:70,targetWeight:65},'plan',date);expect(saved).toEqual({target:2000,min:1950,max:2050,date});expect(await weights.toArray()).toEqual(before);
 await db.settings.put({key:'heightCm',value:'180'});await expect(applyCalculatorGoals(input,'plan',date)).rejects.toThrow('Calculator inputs changed');expect(await goalTable.count()).toBe(1);
});
it('can apply a valid manual weight without any journal record and reports failed writes',async()=>{
 await weights.clear();await applyCalculatorGoals({...input,currentWeight:70,targetWeight:65},'maintenance',date);expect(await weights.count()).toBe(0);expect(activeGoal(await goalTable.toArray(),date)?.nutritionTargets?.calories).toBe(2275);
 const fail=()=>{throw Error('Simulated write failure')};goalTable.hook('creating',fail);await expect(applyCalculatorGoals(input,'plan',date)).rejects.toThrow('Simulated write failure');goalTable.hook('creating').unsubscribe(fail);expect(await goalTable.count()).toBe(1);
});
it('never matches a calorie-scoped record for a full goal edit and keeps same-date history',async()=>{
 const old=legacy({startDate:date,endDate:null});await goalTable.put(old);await applyCalculatorGoals(input,'plan',date);await applyCalculatorGoals(input,'maintenance',date);const goals=await goalTable.toArray();expect(goals).toHaveLength(3);expect(activeGoal(goals,date)?.calorieMin).toBe(2425);const {id,revision,createdAt,updatedAt,deletedAt,...value}=old;expect(goalEditContext(goals,value)?.id).toBe(old.id);
 const backup=await exportAll();const scoped=backup.tables.goals.find(g=>(g as Goal).scope==='calories') as Goal;scoped.scope='bad' as 'calories';await expect(restoreAll(backup)).rejects.toThrow();expect(await goalTable.toArray()).toEqual(goals);
});
it('old v7 backups retain original histories and inert onboarding settings',async()=>{
 const old=legacy();await goalTable.put(old);await db.settings.put({key:'healthGoalCalculatorShown',value:'1'});const backup=await exportAll();backup.version=7;await restoreAll(backup);expect(await goalTable.get(old.id)).toEqual(old);expect((await db.settings.get('healthGoalCalculatorShown'))?.value).toBe('1');expect(db.verno).toBe(7);
});
it('preserves mixed legacy nutrient frequencies and unrestricted macro periods',async()=>{
 const old=legacy({nutritionPeriod:{startDate:'2026-09-01',endDate:null,unrestricted:true}});old.nutritionGoals!.calories.mode='weekly';await goalTable.put(old);await applyCalculatorGoals(input,'plan',date);const goals=await goalTable.toArray();expect(nutritionGoals(activeGoal(goals,date)).protein).toEqual(old.nutritionGoals!.protein);expect(nutritionGoals(activeGoal(goals,date)).calories.mode).toBe('weekly');expect(nutritionGoals(activeGoal(goals,'2027-01-01')).protein).toEqual(old.nutritionGoals!.protein);
});
it('cannot bypass screening with a legacy acknowledgement; valid maintenance preserves history',async()=>{
 const old=legacy();await goalTable.put(old);await db.settings.put({key:'heightCm',value:'165'});const before=await exportAll();const low={...input,heightCm:165,currentWeight:56.65,targetWeight:54.975,sex:'female' as const,age:43,duration:1,activity:'sedentary' as const};
 for(const acknowledgement of [undefined,{kind:'plan',target:1275},{kind:'maintenance',target:1475}])await expect(applyCalculatorGoals(low,'plan',date,acknowledgement)).rejects.toThrow('No valid calorie target');
 expect(await goalTable.count()).toBe(1);
 await applyCalculatorGoals(low,'maintenance',date);expect(await goalTable.get(old.id)).toEqual(old);expect(await goalTable.count()).toBe(2);expect(activeGoal(await goalTable.toArray(),date)).toMatchObject({calorieMin:1425,calorieMax:1525,exerciseMinutes:30,nutritionGoals:{protein:old.nutritionGoals!.protein}});
 const after=await exportAll();for(const [key,value]of Object.entries(before.tables))if(key!=='goals')expect(after.tables[key]).toEqual(value);await restoreAll(after);expect(activeGoal(await goalTable.toArray(),date)).toMatchObject({calorieMin:1425,calorieMax:1525});
 await expect(applyCalculatorGoals({...low,duration:.1},'plan',date,{kind:'plan',target:-1})).rejects.toThrow('No valid calorie target');expect(await goalTable.count()).toBe(2);
});
it('underweight requests cannot be saved as loss targets or rewrite existing data',async()=>{
 await goalTable.put(legacy());const before=await exportAll();
 for(const value of [{...input,targetWeight:50,duration:100},{...input,currentWeight:60,targetWeight:50,duration:100}])await expect(applyCalculatorGoals(value,'plan',date)).rejects.toThrow('No valid calorie target');
 const after=await exportAll();expect(after.tables).toEqual(before.tables);expect(after.version).toBe(before.version);
});
