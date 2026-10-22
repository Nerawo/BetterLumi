import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,weights,stamp,localDate,exportAll,restoreAll} from './domain';
import {calculatorSettingsKey,initialCalculatorDraft,parseCalculatorDraft,saveCalculatorDraft,validCalculatorDraft,calculatorWeightKg,calculatorInput,sameCalculatorInput} from './calculator-settings';
import {validPageSession} from './session-state';
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('reads older installations without a draft without inventing values',()=>{expect(parseCalculatorDraft(undefined)).toBeNull();expect(parseCalculatorDraft('invalid')).toBeNull();expect(parseCalculatorDraft('{"version":2,"value":{}}')).toBeNull();expect(validCalculatorDraft(initialCalculatorDraft)).toBe(true)});
it('preserves temporary blanks and all calculator choices across backup/restore',async()=>{const value={...initialCalculatorDraft,age:30,targetWeight:null,duration:6,durationUnit:'months' as const,weightUnit:'lb' as const,activity:'moderate' as const,sex:'female' as const,excluded:true};await saveCalculatorDraft(value);const backup=await exportAll();await restoreAll(backup);expect(parseCalculatorDraft((await db.settings.get(calculatorSettingsKey))?.value)).toEqual(value);expect(await db.table('goals').count()).toBe(0)});
it('does not modify weight history, heights, legacy settings or goals when saving inputs',async()=>{const record={...stamp(),date:localDate(),kg:70};await weights.put(record);await db.settings.bulkPut([{key:'heightCm',value:'175'},{key:'healthGoalCalculatorShown',value:'1'}]);await saveCalculatorDraft({...initialCalculatorDraft,age:30});expect(await weights.toArray()).toEqual([record]);expect((await db.settings.get('heightCm'))?.value).toBe('175');expect((await db.settings.get('healthGoalCalculatorShown'))?.value).toBe('1');expect(await db.table('goals').count()).toBe(0)});
it('rejects corrupted drafts without overwriting saved preferences',async()=>{await saveCalculatorDraft(initialCalculatorDraft);for(const value of [{...initialCalculatorDraft,age:NaN},{...initialCalculatorDraft,activity:'invalid'},{...initialCalculatorDraft,excluded:'false'}]){expect(validCalculatorDraft(value)).toBe(false);await expect(saveCalculatorDraft(value as typeof initialCalculatorDraft)).rejects.toThrow()}expect(parseCalculatorDraft((await db.settings.get(calculatorSettingsKey))?.value)).toEqual(initialCalculatorDraft)});
it('restores the calculator tab without invalidating old page sessions',()=>{const page={route:'/today?date=2026-10-20',tab:'calculator',todayDate:'2026-10-20',scrollY:100};expect(validPageSession(page)).toBe(true);expect(validPageSession({...page,tab:'more'})).toBe(true);expect(validPageSession({...page,tab:'unknown'})).toBe(false)});
it('uses only journal weight while retaining legacy manual and blank drafts for compatibility',async()=>{
 expect(calculatorWeightKg(initialCalculatorDraft,85)).toBe(85);expect(calculatorWeightKg(initialCalculatorDraft,null)).toBeNull();
 const draft={...initialCalculatorDraft,currentWeight:154.3235835294143,currentWeightUnit:'lb' as const};expect(calculatorWeightKg(draft,85)).toBe(85);await saveCalculatorDraft(draft);const backup=await exportAll();await restoreAll(backup);expect(parseCalculatorDraft((await db.settings.get(calculatorSettingsKey))?.value)).toEqual(draft);
 const cleared={...draft,currentWeight:null};await saveCalculatorDraft(cleared);expect(calculatorWeightKg(parseCalculatorDraft((await db.settings.get(calculatorSettingsKey))?.value)!,85)).toBe(85);
 for(const value of [{...draft,currentWeight:Infinity},{...draft,currentWeightUnit:'jin'},{...draft,currentWeightUnit:undefined}])expect(validCalculatorDraft(value)).toBe(false);
 expect(parseCalculatorDraft(JSON.stringify({version:1,value:initialCalculatorDraft}))).toEqual(initialCalculatorDraft);
});
it('compares calculation snapshots across every input and never treats blanks as zero',()=>{
 const draft={...initialCalculatorDraft,age:30,targetWeight:80},snapshot=calculatorInput(draft,175,85)!;expect(sameCalculatorInput(snapshot,calculatorInput({...draft},175,85))).toBe(true);
 for(const value of [{age:31},{age:30.000000001},{heightCm:176},{currentWeight:86},{targetWeight:79},{duration:24},{durationUnit:'months' as const},{weightUnit:'lb' as const},{activity:'light' as const},{sex:'male' as const},{excluded:true}])expect(sameCalculatorInput(snapshot,{...snapshot,...value})).toBe(false);
 for(const value of [calculatorInput({...draft,age:null},175,85),calculatorInput({...draft,targetWeight:null},175,85),calculatorInput({...draft,duration:null},175,85),calculatorInput(draft,null,85),calculatorInput(draft,175,null)])expect(sameCalculatorInput(snapshot,value)).toBe(false);
 expect(sameCalculatorInput(snapshot,{...snapshot,currentWeight:85+1e-12})).toBe(true);
});

it('persists interactive source, explicit blanks and exercise override choices in the existing draft envelope',async()=>{
 const value={...initialCalculatorDraft,plannerMode:'intake' as const,dailyIntake:null,exerciseEnabled:true,exerciseMinutes:150,exerciseCalories:700,exerciseCustom:true,keepExerciseCustom:true};await saveCalculatorDraft(value);const backup=await exportAll();await restoreAll(backup);expect(parseCalculatorDraft((await db.settings.get(calculatorSettingsKey))?.value)).toEqual(value);expect(await db.table('goals').count()).toBe(0);
 for(const patch of [{plannerMode:'bad'},{exerciseCustom:'yes'},{dailyIntake:Infinity},{exerciseCalories:NaN}])expect(validCalculatorDraft({...value,...patch})).toBe(false);
});
