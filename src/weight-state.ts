import {weights,type Weight} from './domain';
import {validLocalDate} from './routing';
import {measurementDate,compareMeasurements,validMeasuredAt} from './weight-time';
/** The database is authoritative. Neither selectedDate, today, nor editedAt
 * can change which valid measurement is globally latest. Legacy dates retain
 * their existing unknown-time fallback; no timestamp is invented or persisted. */
export function resolveWeightState(items:Weight[]){
 const records=items.filter(item=>!item.deletedAt&&Number.isFinite(item.kg)&&item.kg>0&&(item.measuredAt===undefined||validMeasuredAt(item.measuredAt))&&validLocalDate(measurementDate(item))).slice().sort(compareMeasurements);
 return {records,latestWeight:records[0]??null};
}
export type WeightState=ReturnType<typeof resolveWeightState>;
export function weightsOnDate(state:WeightState,date:string){return state.records.filter(item=>measurementDate(item)===date)}
export async function readWeightState(){return resolveWeightState(await weights.toArray())}
