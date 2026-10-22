import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import {db,foodLogs,stamp,exportAll,restoreAll,type FoodLog} from './domain';
import {goalTable,saveGoalVersion,goalStatus,type Goal} from './goals';
import {configuredNutritionGoals,nutritionGoals,validGoalConfig} from './goal-model';
import {weeklyStatistics} from './weekly-goals';
const date='2026-10-19';
const goal=(mode:'daily'|'weekly'='daily'):Goal=>({...stamp(),startDate:'2026-10-01',endDate:null,calorieMin:100,calorieMax:200,exerciseMinutes:10,exerciseKcal:20,exerciseMode:'weekly',nutritionGoals:{calories:{mode,min:100,max:200},protein:{mode:'daily',min:10,max:null},carbs:{mode:'off',min:null,max:null},fat:{mode:'off',min:null,max:null}}});
const food=(date:string):FoodLog=>({...stamp(),date,name:'Food',source:'quick',sourceId:null,category:'lunch',quantity:1,unit:'entry',lines:[],cookingNote:'',nutrition:{calories:150,protein:15,carbs:0,fat:null}});
const activity={...stamp(),date,type:'other' as const,name:'Walk',duration:30,caloriesBurned:50,distance:null,notes:''};
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it.each(['daily','weekly'] as const)('nutrition master masks %s goals independently without altering actuals or saved targets',mode=>{
 const g=goal(mode),off={...g,nutritionEnabled:false};
 expect(nutritionGoals(g).calories.mode).toBe(mode);expect(Object.values(nutritionGoals(off)).every(v=>v.mode==='off')).toBe(true);expect(configuredNutritionGoals(off)).toEqual(configuredNutritionGoals(g));
 const daily=goalStatus([off],date,[food(date)],[activity]);expect(daily.intake).toBe(150);expect(daily.foodStatus).toBeNull();expect(daily.nutritionStatuses.protein).toBeNull();
 const logs=Array.from({length:7},(_,i)=>food('2026-10-'+(19+i)));const week=weeklyStatistics([off],date,logs,[activity]);expect(week.nutrients.calories.achieved).toBe(false);expect(week.nutrients.calories.average).toBe(150);expect(week.exercise.achieved).toBe(true);
 expect(weeklyStatistics([{...g,exerciseEnabled:false}],date,logs,[activity]).exercise.achieved).toBe(false);
 expect(weeklyStatistics([g],date,logs,[activity]).nutrients.calories.achieved).toBe(mode==='weekly');
});
it('disabled nutrition versions round-trip with configured values and leave historical versions and unrelated records unchanged',async()=>{
 const old=goal('weekly');await goalTable.put(old);await foodLogs.put(food(date));const before=await foodLogs.toArray();const {id,createdAt,updatedAt,deletedAt,revision,...values}=old;
 await saveGoalVersion({...values,startDate:date,nutritionEnabled:false,exerciseEnabled:false});const rows=await goalTable.toArray();expect(await goalTable.get(old.id)).toEqual(old);expect(rows.find(v=>v.id!==old.id)?.nutritionGoals).toEqual(old.nutritionGoals);
 const backup=await exportAll();await restoreAll(backup);expect(await goalTable.toArray()).toEqual(rows);expect(await foodLogs.toArray()).toEqual(before);
 const bad=structuredClone(backup);(bad.tables.goals[0] as Record<string,unknown>).nutritionEnabled='no';await expect(restoreAll(bad)).rejects.toThrow();expect(await goalTable.toArray()).toEqual(rows);expect(validGoalConfig({...old,nutritionEnabled:false})).toBe(true);
});
it('disabled current weeks do not change earlier weekly targets or their achievements',()=>{
 const old=goal('weekly'),off={...goal('weekly'),startDate:date,nutritionEnabled:false};const logs=Array.from({length:7},(_,i)=>food('2026-10-'+(12+i)));
 expect(weeklyStatistics([old,off],'2026-10-12',logs,[]).nutrients.calories.achieved).toBe(true);expect(weeklyStatistics([old,off],date,logs,[]).nutrients.calories.mode).toBe('off');
});
