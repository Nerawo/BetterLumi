// Fictional measurements and dates, unrelated to any user journal.
import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {db,weights,stamp,softDelete,type Weight} from './domain';
import {resolveWeightState,readWeightState,weightsOnDate} from './weight-state';
import {localMeasurementIso,measurementDate,localMeasurementTime} from './weight-time';
import {saveWeightMeasurement} from './weight-records';
import {readBmiProfile} from './bmi-profile';
import {calculatorWeightKg,initialCalculatorDraft} from './calculator-settings';
const row=(measuredAt:string,kg:number,extra:Partial<Weight>={}):Weight=>({...stamp(),date:measuredAt.slice(0,10),kg,measuredAt,...extra});
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2037-10-22T12:00:00Z'))});
afterEach(async()=>{vi.useRealTimers();vi.unstubAllEnvs();for(const table of db.tables)await table.clear()});
it('global latest and selected-day records are separate views of the same records',()=>{
 vi.stubEnv('TZ','America/New_York');const latest=row('2037-10-21T21:42:00Z',68.3),state=resolveWeightState([row('2037-10-19T12:00:00Z',68.6),latest]);
 expect(state.latestWeight).toEqual(latest);expect(weightsOnDate(state,'2037-10-20')).toEqual([]);expect(weightsOnDate(state,'2037-10-21')).toEqual([latest]);expect(state.latestWeight!.kg).toBe(68.3);
});
it('three same-day measurements remain independent and every mutation resolves latest by measurement time',async()=>{
 vi.stubEnv('TZ','America/New_York');const date='2037-10-20';const records=[];for(const[time,kg]of [['08:00',68.6],['12:00',68.5],['17:42',68.3]] as const)records.push(await saveWeightMeasurement({date,measuredAt:localMeasurementIso(date,time),kg,notes:time}));
 let state=await readWeightState();expect(state.records).toHaveLength(3);expect(new Set(state.records.map(r=>r.id)).size).toBe(3);expect(state.latestWeight!.id).toBe(records[2].id);expect(weightsOnDate(state,date)).toHaveLength(3);
 const old=await saveWeightMeasurement({...records[0],kg:68.7,notes:'Old edit'},records[0]);expect(old.measuredAt).toBe(records[0].measuredAt);expect(await weights.get(records[1].id)).toEqual(records[1]);expect((await readWeightState()).latestWeight!.id).toBe(records[2].id);
 const edited=await saveWeightMeasurement({...records[2],kg:68.2,notes:'Latest edit'},records[2]);expect(edited.id).toBe(records[2].id);expect(edited.measuredAt).toBe(records[2].measuredAt);expect((await readWeightState()).latestWeight!.kg).toBe(68.2);
 await softDelete(weights,records[2].id);state=await readWeightState();expect(state.latestWeight!.id).toBe(records[1].id);expect(state.latestWeight!.kg).toBe(68.5);expect(await weights.count()).toBe(3);expect(await weights.get(records[0].id)).toEqual(old);expect((await readBmiProfile('1900-01-01')).weight).toEqual(state.latestWeight);
});
it.each([['America/New_York','2037-10-20'],['Asia/Shanghai','2037-10-21'],['Pacific/Auckland','2037-10-21']])('uses local calendar dates with an unambiguous instant in %s', (zone,date)=>{
 vi.stubEnv('TZ',zone);const original=row('2037-10-21T00:30:17.123Z',68.3,{date:'2037-10-21'}),before=structuredClone(original),state=resolveWeightState([original]);expect(measurementDate(original)).toBe(date);expect(weightsOnDate(state,date)).toHaveLength(1);expect(original).toEqual(before);expect(state.latestWeight!.measuredAt).toBe('2037-10-21T00:30:17.123Z');
});
it('sorts repeated daylight-saving times by full timestamp and rejects nonexistent local times',()=>{
 vi.stubEnv('TZ','America/New_York');const first=row('2037-11-01T01:30:00-04:00',68.6),second=row('2037-11-01T01:30:00-05:00',68.3);expect(localMeasurementTime(first.measuredAt!)).toBe('01:30');expect(localMeasurementTime(second.measuredAt!)).toBe('01:30');expect(resolveWeightState([first,second]).latestWeight).toEqual(second);expect(()=>localMeasurementIso('2037-03-08','02:30')).toThrow();
});
it('never promotes old edits or filters global latest by the selected day or future date',()=>{
 const early=row('2037-10-20T08:00:00Z',68.6,{updatedAt:'2099-01-01T00:00:00Z'}),latest=row('2037-10-21T17:42:00Z',68.3,{createdAt:'2000-01-01T00:00:00Z'});const state=resolveWeightState([early,latest]);expect(state.latestWeight).toEqual(latest);expect(weightsOnDate(state,'2037-10-19')).toEqual([]);expect(state.latestWeight).toEqual(latest);
});
it('does not alter legacy dates, invalid or deleted rows, or use an independent calculation weight',()=>{
 const legacy={...stamp(),date:'2037-10-19',kg:68.6},latest=row('2037-10-21T17:42:00Z',68.3),bad=row('bad',68.6),deleted=row('2099-01-01T00:00:00Z',49,{deletedAt:'deleted'}),before=structuredClone([legacy,latest,bad,deleted]),state=resolveWeightState(before);
 expect(state.records).toHaveLength(2);expect(state.latestWeight).toEqual(latest);expect(before).toEqual([legacy,latest,bad,deleted]);expect(legacy).not.toHaveProperty('measuredAt');expect(calculatorWeightKg({...initialCalculatorDraft,currentWeight:99,currentWeightUnit:'kg'},state.latestWeight!.kg)).toBe(68.3);
});
