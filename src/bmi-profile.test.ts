import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,weights,stamp,exportAll,restoreAll,displayWeight,toKg,type Weight} from './domain';
import {bmiCategory,heightSettingKey,latestBmiWeight,parseHeightCm,readBmiProfile,recordedBmi,saveHeightCm} from './bmi-profile';
const weight=(date:string,kg:number,extra:Partial<Weight>={}):Weight=>({...stamp(),date,kg,notes:'Keep history',...extra});
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('chooses global measurement time, excludes invalid/deleted records, and never scopes latest to a calendar date',()=>{
 const old=weight('2026-10-01',75,{updatedAt:'2026-10-20T12:00:00Z'}),recent=weight('2026-10-19',70),sameDate=weight('2026-10-19',71,{createdAt:'2099-01-01T00:00:00Z'});
 const candidates=[old,recent,weight('2026-10-20',0),weight('2026-10-20',NaN),weight('2026-10-20',Infinity),weight('2026-10-20',-70),weight('2026-10-20',65,{deletedAt:'deleted'}),weight('bad-date',80)];
 expect(latestBmiWeight(candidates,'2026-10-20')).toEqual(recent);expect(latestBmiWeight([...candidates,sameDate],'2026-10-20')).toEqual(sameDate);expect(latestBmiWeight([])).toBeNull();expect(latestBmiWeight([...candidates,weight('2026-10-21',90)],'2026-10-20')!.kg).toBe(90);
});
it('distinguishes missing height or weight from zero BMI and validates heights',()=>{
 for(const value of [undefined,'',' ','0','-1','NaN','Infinity','99','251','invalid'])expect(parseHeightCm(value)).toBeNull();expect(parseHeightCm(' 175.5 ')).toBe(175.5);
 expect(recordedBmi(null,175)).toBeNull();expect(recordedBmi(weight('2026-10-20',70),null)).toBeNull();expect(recordedBmi(weight('2026-10-20',0),175)).toBeNull();expect(recordedBmi(weight('2026-10-20',70),175)).toBeCloseTo(22.857142857);
});
it('classifies unrounded BMI at all adult boundaries',()=>{
 expect(bmiCategory(18.4999)).toBe('underweight');expect(bmiCategory(18.5)).toBe('healthy');expect(bmiCategory(24.999)).toBe('healthy');expect(bmiCategory(25)).toBe('overweight');expect(bmiCategory(29.999)).toBe('overweight');expect(bmiCategory(30)).toBe('obesity');expect(bmiCategory(null)).toBeNull();expect(bmiCategory(0)).toBeNull();expect(bmiCategory(NaN)).toBeNull();
});
it('uses the existing kg store and shared lb conversion, without changing stored values',async()=>{
 const saved=weight('2026-10-19',toKg(154,'lb'));await weights.put(saved);await saveHeightCm(175);await db.settings.put({key:'weightUnit',value:'lb'});const profile=await readBmiProfile('2026-10-20');expect(profile.unit).toBe('lb');expect(displayWeight(profile.weight!.kg,profile.unit)).toBeCloseTo(154);expect(await weights.get(saved.id)).toEqual(saved);expect(recordedBmi(profile.weight,profile.height)).toBeCloseTo(22.80921632,6);
});
it('persists height in existing settings and retains all weight history across backup/restore',async()=>{
 const history=[weight('2026-10-01',74),weight('2026-10-19',70)];await weights.bulkPut(history);await db.settings.put({key:'language',value:'en'});const before=await exportAll();await saveHeightCm(175);await saveHeightCm(175);expect(await weights.toArray()).toEqual(expect.arrayContaining(history));expect(await db.settings.get('language')).toEqual({key:'language',value:'en'});
 const backup=await exportAll();expect(backup.version).toBe(before.version);await restoreAll(backup);expect((await readBmiProfile('2026-10-20')).height).toBe(175);expect(await weights.count()).toBe(2);expect(await db.table('goals').count()).toBe(0);
});
it('rejects bad saves and accepts old backups with no height setting',async()=>{
 await saveHeightCm(175);for(const value of [0,NaN,Infinity,251,-1])await expect(saveHeightCm(value)).rejects.toThrow();expect((await db.settings.get(heightSettingKey))?.value).toBe('175');
 const backup=await exportAll();backup.tables.settings=[];await restoreAll(backup);expect((await readBmiProfile('2026-10-20')).height).toBeNull();
});
