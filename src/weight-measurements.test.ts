// Synthetic independent measurements; no personal journal data.
import 'fake-indexeddb/auto';
import {afterEach,it,expect} from 'vitest';
import {db,weights,stamp,exportAll,restoreAll,softDelete,localDate,type Weight} from './domain';
import {saveWeightMeasurement} from './weight-records';
import {validMeasuredAt,localMeasurementIso,localMeasurementTime,measurementDate,compareMeasurements} from './weight-time';
import {latestBmiWeight,readBmiProfile} from './bmi-profile';
const date='2026-10-20';
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('adds distinct same-day measurements, edits/deletes one ID and resolves latest by actual time',async()=>{
 const morning=await saveWeightMeasurement({date,measuredAt:localMeasurementIso(date,'08:45'),kg:64,notes:'Morning'}),afternoon=await saveWeightMeasurement({date,measuredAt:localMeasurementIso(date,'15:20'),kg:64.4,notes:'Afternoon'});
 const backup=await exportAll();await restoreAll(backup);expect(await weights.count()).toBe(2);expect(await weights.get(morning.id)).toEqual(morning);expect(await weights.get(afternoon.id)).toEqual(afternoon);
 expect(morning.id).not.toBe(afternoon.id);expect(await weights.count()).toBe(2);expect(localMeasurementTime(afternoon.measuredAt!)).toBe('15:20');
 const edited=await saveWeightMeasurement({...morning,kg:63.9,notes:'Edited'},morning);expect(edited.measuredAt).toBe(morning.measuredAt);expect(edited.createdAt).toBe(morning.createdAt);expect(await weights.get(afternoon.id)).toEqual(afternoon);expect(latestBmiWeight(await weights.toArray(),date)!.id).toBe(afternoon.id);
 await softDelete(weights,afternoon.id);expect(latestBmiWeight(await weights.toArray(),date)!.id).toBe(morning.id);expect(await weights.get(morning.id)).toEqual(edited);
});
it('ignores edit timestamps and creation order when measurement times are known',()=>{
 const early:Weight={...stamp(),date,kg:64,createdAt:'2099-01-01T00:00:00Z',updatedAt:'2099-01-01T00:00:00Z',measuredAt:localMeasurementIso(date,'08:45')},late:Weight={...stamp(),date,kg:64.4,createdAt:'2000-01-01T00:00:00Z',measuredAt:localMeasurementIso(date,'15:20')};
 expect([early,late].sort(compareMeasurements)[0].id).toBe(late.id);expect(latestBmiWeight([early,late],date)!.id).toBe(late.id);
});
it('keeps legacy rows exact without a destructive migration or invented time',async()=>{
 const legacy:Weight={...stamp(),date:'2026-10-01',kg:55,notes:'Legacy'};await weights.add(legacy);await saveWeightMeasurement({date,measuredAt:localMeasurementIso(date,'15:20'),kg:64.4,notes:''});expect(await weights.get(legacy.id)).toEqual(legacy);expect(db.verno).toBe(6);expect(weights.schema.indexes.find(i=>i.name==='date')!.unique).toBe(false);
 const edited=await saveWeightMeasurement({date:legacy.date,kg:54.9,notes:'Legacy edited'},legacy);expect(edited.measuredAt).toBeUndefined();expect(edited.date).toBe(legacy.date);
});
it('preserves full ISO precision through edits, backup round trips, and old backups',async()=>{
 const measuredAt='2026-10-20T12:30:17.123Z';const row=await saveWeightMeasurement({date,measuredAt,kg:64,notes:''});await db.settings.put({key:'heightCm',value:'155'});const updated=await saveWeightMeasurement({date,kg:63.9,notes:'Keep timestamp'},row);expect(updated.measuredAt).toBe(measuredAt);
 const backup=await exportAll();await restoreAll(backup);expect(await weights.get(row.id)).toEqual(updated);expect((await readBmiProfile(date)).weight!.id).toBe(row.id);
 const bad=structuredClone(backup);(bad.tables.weights[0] as Weight).measuredAt='2026-10-20T08:45:00';await expect(restoreAll(bad)).rejects.toThrow();expect(await weights.get(row.id)).toEqual(updated);
 const old=structuredClone(backup);old.version=8;delete (old.tables.weights[0] as Weight).measuredAt;await restoreAll(old);expect((await weights.get(row.id))!.measuredAt).toBeUndefined();
});
it('only reschedules an existing ID when a new measurement time is explicitly supplied',async()=>{
 const row=await saveWeightMeasurement({date,measuredAt:localMeasurementIso(date,'08:45'),kg:64,notes:''});const measuredAt=localMeasurementIso(date,'17:45');const updated=await saveWeightMeasurement({date,measuredAt,kg:64,notes:''},row);expect(updated.id).toBe(row.id);expect(updated.createdAt).toBe(row.createdAt);expect(updated.measuredAt).toBe(measuredAt);expect(await weights.count()).toBe(1);
 await expect(saveWeightMeasurement({date,kg:53,notes:''},row)).rejects.toThrow('Weight changed');expect(await weights.get(row.id)).toEqual(updated);
});
it('validates timestamps with offsets, calendar dates and local conversions',()=>{
 for(const value of ['2026-10-20T08:45:00Z','2026-10-20T08:45:00.123+08:00'])expect(validMeasuredAt(value)).toBe(true);
 for(const value of [null,'2026-10-20','2026-10-20T08:45:00','2026-02-30T08:45:00Z','2026-10-20T25:30:00Z','bad'])expect(validMeasuredAt(value)).toBe(false);
 for(const time of ['','25:30','14:60'])expect(()=>localMeasurementIso(date,time)).toThrow();
 const iso=localMeasurementIso(date,'15:20');expect(localMeasurementTime(iso)).toBe('15:20');expect(measurementDate({...stamp(),date,kg:64,measuredAt:iso})).toBe(date);
});

it('preserves a timestamp across timezone travel even when its original date label is tomorrow locally',async()=>{
 const future=new Date();future.setDate(future.getDate()+1);const original:Weight={...stamp(),date:localDate(future),measuredAt:new Date(Date.now()-3600000).toISOString(),kg:64,notes:''};await weights.add(original);
 const saved=await saveWeightMeasurement({date:original.date,kg:63.9,notes:'Edited in current timezone'},original);expect(saved.measuredAt).toBe(original.measuredAt);expect(saved.date).toBe(original.date);expect(saved.id).toBe(original.id);
});
