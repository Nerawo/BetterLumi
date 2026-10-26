import {it,expect} from 'vitest';
import {builtInExercises,defaultBuiltInExercise} from './data/builtInExercises';
import {exerciseEstimateSnapshot,searchExercises} from './exercise-estimate';
import {trainingKeys,bodyKeys} from './ExerciseMetadata';
it.each([['walking','16060',3.5],['running','12030',8.5],['swimming','18240',5.8],['cycling','01016',7],['badminton','15030',5.5],['strength','02054',3.5],['bodyweight','02022',3.8]])('selects exactly one existing default for %s', (category,code,met)=>{
 const preset=defaultBuiltInExercise(String(category))!;expect(preset.activityCode).toBe(code);expect(preset.met).toBe(met);expect(builtInExercises.filter(item=>item.category===category&&item.isDefault)).toHaveLength(1);
});
it('uses existing editable metadata keys only, without adding body classifications',()=>{
 for(const p of builtInExercises){expect(p.defaultTrainingTags).toEqual(['strength','bodyweight'].includes(p.category)?['strength','anaerobic']:['cardio']);for(const tag of p.defaultTrainingTags)expect(trainingKeys).toContain(tag);for(const key of p.defaultBodyParts)expect(bodyKeys).toContain(key.slice(7));expect(p.defaultBodyParts).toEqual(['walking','running','cycling'].includes(p.category)?['preset:thighs','preset:calves']:[]);expect(Object.isFrozen(p.defaultTrainingTags)).toBe(true);expect(Object.isFrozen(p.defaultBodyParts)).toBe(true)}
});
it('snapshots human labels and calculation duration without storing default configurations',()=>{
 const p=defaultBuiltInExercise('running')!,snapshot=exerciseEstimateSnapshot(p,30,{kg:72,id:'synthetic-weight'})!;
 expect(snapshot).toMatchObject({nameZh:'跑步',nameEn:'Running',intensityLabelZh:'一般',intensityLabelEn:'Moderate',durationMinutes:30,met:8.5,activityCode:'12030'});expect(snapshot).not.toHaveProperty('defaultTrainingTags');const before=structuredClone(snapshot);exerciseEstimateSnapshot({...p,intensityLabelEn:'Changed label',met:99},10,null);expect(snapshot).toEqual(before);
});
it('matches bilingual user-facing names and retains original source descriptions for audit',()=>{for(const q of ['run','跑步'])expect(searchExercises(builtInExercises,q)).toHaveLength(3);for(const q of ['swim','游泳','badminton','羽毛球'])expect(searchExercises(builtInExercises,q)).toHaveLength(2);expect(defaultBuiltInExercise('unknown')).toBeNull();expect(builtInExercises.filter(p=>p.category==='walking')).toHaveLength(1)});
