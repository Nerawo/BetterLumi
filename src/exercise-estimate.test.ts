import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import {builtInExercises} from './data/builtInExercises';
import {estimateExercise,exerciseEstimateSnapshot,searchExercises} from './exercise-estimate';
import {db,stamp,weights,exportAll,restoreAll} from './domain';
import {readWeightState} from './weight-state';
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it('contains exactly the verified 2024 codes and MET values with stable ids and original descriptions',()=>{
 expect(builtInExercises.map(p=>[p.activityCode,p.met])).toEqual([['16060',3.5],['12020',7.5],['12030',8.5],['12050',9.3],['18240',5.8],['18230',9.8],['01015',4.3],['01016',7],['01017',9],['15030',5.5],['15025',9],['02054',3.5],['02050',6],['02022',3.8],['02020',7.5]]);
 expect(new Set(builtInExercises.map(p=>p.id)).size).toBe(15);
 for(const preset of builtInExercises){expect(preset.nameZh).toBeTruthy();expect(preset.nameEn).toBeTruthy();expect(preset.sourceDescription).toBeTruthy();expect(preset.sourceName).toBe('2024 Adult Compendium of Physical Activities');expect(new URL(preset.sourceUrl).hostname).toBe('pacompendium.com');expect(Object.isFrozen(preset)).toBe(true)}
});
it('searches Chinese, English, intensity and original descriptions without assigning unknown exercises a MET',()=>{expect(searchExercises(builtInExercises,' 游泳 ')).toHaveLength(2);expect(searchExercises(builtInExercises,'SWIMMING')).toHaveLength(2);expect(searchExercises(builtInExercises,'8-15 reps')[0].activityCode).toBe('02054');expect(searchExercises(builtInExercises,'unknown exercise')).toEqual([]);expect(searchExercises([],'' )).toEqual([])});
it('calculates full precision, duration changes and reference weight correctly',()=>{expect(estimateExercise(5.8,60,52)).toBeCloseTo(316.68,10);expect(estimateExercise(5.8,30,52)).toBeCloseTo(158.34,10);expect(estimateExercise(5.8,60,null)).toBeCloseTo(426.3,10);expect(estimateExercise(5.8,0,52)).toBe(0);expect(estimateExercise(5.8,null,52)).toBeNull();expect(estimateExercise(null,60,52)).toBeNull();expect(estimateExercise(5.8,-1,52)).toBeNull();expect(estimateExercise(Infinity,60,52)).toBeNull()});
it('uses the unified latest weight, snapshots context, survives backup and never seeds presets or updates history',async()=>{
 const existing={...stamp(),name:'Fictional custom exercise',type:'other' as const,date:'2038-04-12',duration:20,caloriesBurned:123,distance:null,notes:'Synthetic'};await db.activities.put(existing);
 const w={...stamp(),date:'2038-04-12',measuredAt:'2038-04-12T12:00:00Z',kg:72};await weights.put(w);
 const preset=builtInExercises.find(p=>p.activityCode==='18240')!,snapshot=exerciseEstimateSnapshot(preset,60,(await readWeightState()).latestWeight)!;
 expect(snapshot.weightSource).toBe('recorded');expect(snapshot.weightRecordId).toBe(w.id);
 const logged={...stamp(),type:'swimming' as const,name:preset.nameEn,date:'2038-04-12',duration:60,distance:null,notes:'',calorieSource:'automatic' as const,caloriesBurned:snapshot.estimatedKcal,exerciseEstimate:snapshot};await db.activities.put(logged);
 await weights.put({...w,kg:80});exerciseEstimateSnapshot({...preset,met:99},60,(await readWeightState()).latestWeight);
 expect(await db.activities.get(logged.id)).toEqual(logged);expect(await db.activities.get(existing.id)).toEqual(existing);expect(await db.activities.count()).toBe(2);expect(db.verno).toBe(6);
 const backup=await exportAll();await restoreAll(backup);expect(await db.activities.get(logged.id)).toEqual(logged);expect(await db.activities.get(existing.id)).toEqual(existing);
 expect(exerciseEstimateSnapshot(preset,60,null)?.weightSource).toBe('reference');expect(exerciseEstimateSnapshot(preset,null,null)).toBeUndefined();
});
