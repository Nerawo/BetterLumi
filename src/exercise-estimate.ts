import type {BuiltInExercise} from './data/builtInExercises';
export interface ExerciseEstimateSnapshot {
 builtInId:string; met:number; weightKg:number; weightSource:'recorded'|'reference';
 weightRecordId?:string; sourceName:string; activityCode:string; sourceDescription:string; sourceUrl:string;
 estimatedKcal:number;
 nameZh?:string;nameEn?:string;intensityLabelZh?:string;intensityLabelEn?:string;durationMinutes?:number;
}
export function estimateExercise(met:number|null,minutes:number|null,weightKg:number|null){
 if(met===null||minutes===null||!Number.isFinite(met)||met<=0||!Number.isFinite(minutes)||minutes<0)return null;
 const weight=weightKg!==null&&Number.isFinite(weightKg)&&weightKg>0?weightKg:70;
 const kcal=met*3.5*weight/200*minutes;
 return Number.isFinite(kcal)?kcal:null;
}
export function exerciseEstimateSnapshot(preset:BuiltInExercise,minutes:number|null,weight:{kg:number;id:string}|null):ExerciseEstimateSnapshot|undefined{
 const validWeight=weight&&Number.isFinite(weight.kg)&&weight.kg>0?weight:null;
 const kcal=estimateExercise(preset.met,minutes,validWeight?.kg??null);
 if(kcal===null||preset.met===null)return undefined;
 return {nameZh:preset.nameZh,nameEn:preset.nameEn,intensityLabelZh:preset.intensityLabelZh,intensityLabelEn:preset.intensityLabelEn,durationMinutes:minutes!,builtInId:preset.id,met:preset.met,weightKg:validWeight?.kg??70,weightSource:validWeight?'recorded':'reference',...(validWeight?{weightRecordId:validWeight.id}:{}),sourceName:preset.sourceName,activityCode:preset.activityCode,sourceDescription:preset.sourceDescription,sourceUrl:preset.sourceUrl,estimatedKcal:kcal};
}
export function searchExercises(items:readonly BuiltInExercise[],query:string){const q=query.trim().toLowerCase();return items.filter(item=>[item.nameZh,item.nameEn,item.category,item.intensityLabelZh,item.intensityLabelEn,item.sourceDescription].some(value=>value.toLowerCase().includes(q)))}
