import {db,weights,type Weight} from './domain';
import {resolveWeightState,readWeightState} from './weight-state';
import {useWeightData} from './WeightData';
import {useLiveQuery} from 'dexie-react-hooks';
import {bmi} from './health-calculator';

export const heightSettingKey='heightCm';
export const validHeightCm=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=100&&value<=250;
export function parseHeightCm(value:string|undefined):number|null {
  if(!value?.trim())return null;const height=Number(value);return validHeightCm(height)?height:null;
}
/** Compatibility entry point; all consumers resolve through the shared selector.
 * The obsolete date parameter cannot scope global current weight. */
export function latestBmiWeight(items:Weight[],_legacyToday?:string):Weight|null {return resolveWeightState(items).latestWeight}
export const bmiCategories=['underweight','healthy','overweight','obesity'] as const;
export type BmiCategory=typeof bmiCategories[number];
export function bmiCategory(value:number|null):BmiCategory|null {
  return value===null||!Number.isFinite(value)||value<=0?null:value<18.5?'underweight':value<25?'healthy':value<30?'overweight':'obesity';
}
export function recordedBmi(weight:Weight|null,height:number|null):number|null {
  return weightBmi(weight?.kg??null,height);
}
export function weightBmi(kg:number|null,height:number|null):number|null {
  if(kg===null||!Number.isFinite(kg)||kg<=0||!validHeightCm(height))return null;
  const value=bmi(kg,height);return Number.isFinite(value)?value:null;
}
export async function readBmiProfile(_legacyToday?:string){
  return db.transaction('r',weights,db.settings,async()=>{
    const [state,storedHeight,unit]=await Promise.all([readWeightState(),db.settings.get(heightSettingKey),db.settings.get('weightUnit')]);
    return {weight:state.latestWeight,height:parseHeightCm(storedHeight?.value),unit:unit?.value==='lb'?'lb' as const:'kg' as const};
  });
}
export type BmiProfile=Awaited<ReturnType<typeof readBmiProfile>>;
export async function saveHeightCm(value:number){
  if(!validHeightCm(value))throw Error('Invalid height');
  await db.transaction('rw',db.settings,async()=>{
    if((await db.settings.get(heightSettingKey))?.value!==String(value))await db.settings.put({key:heightSettingKey,value:String(value)});
  });
}

/** Settings can change independently; weight always comes from the one shared subscription. */
export function useBmiProfile():BmiProfile|undefined {
 const state=useWeightData();
 const settings=useLiveQuery(async()=>({height:parseHeightCm((await db.settings.get(heightSettingKey))?.value),unit:(await db.settings.get('weightUnit'))?.value==='lb'?'lb' as const:'kg' as const}));
 return state&&settings?{weight:state.latestWeight,...settings}:undefined;
}
