import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import {db,stamp} from './domain';
import {goalTable,activeGoal} from './goals';
import {initialCalculatorDraft} from './calculator-settings';
import {applyCalculatorPlan} from './calculator-goals';
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it.each([1235,3])('exposes exact target %s alongside untouched legacy macro ranges without persisting a second goal',async target=>{const old={...stamp(),startDate:'2026-01-01',endDate:null,calorieMin:1500,calorieMax:1600,exerciseMinutes:null,exerciseKcal:null,nutritionGoals:{calories:{mode:'daily' as const,min:1500,max:1600},protein:{mode:'daily' as const,min:70,max:90},carbs:{mode:'off' as const,min:null,max:null},fat:{mode:'off' as const,min:null,max:null}}};await goalTable.add(old);await db.settings.put({key:'heightCm',value:'175'});const draft={...initialCalculatorDraft,age:30,targetWeight:80,sex:'male' as const,specialOrProfessionalGuidance:true,professionalKcal:target};await applyCalculatorPlan(draft,{...draft,heightCm:175,currentWeight:85,excluded:true},'professional','2026-10-22');const rows=await goalTable.toArray(),view=activeGoal(rows,'2026-10-22')!;expect(view.evaluationCalorieTarget).toBe(target);expect(view.calorieMin).toBe(Math.max(0,target-50));expect(view.nutritionTargets).toBeUndefined();expect(view.nutritionGoals!.protein).toEqual(old.nutritionGoals.protein);expect(rows.find(r=>r.id===old.id)).toEqual(old);expect(rows.every(r=>r.evaluationCalorieTarget===undefined)).toBe(true);expect(rows).toHaveLength(2)});
