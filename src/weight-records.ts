import {db,weights,stamp,localDate,type Weight} from './domain';
import {validLocalDate} from './routing';
import {validMeasuredAt,measurementDate} from './weight-time';
export interface WeightMeasurementValues {date:string;measuredAt?:string;kg:number;notes:string}
/** New measurements always insert. Edits can only update the chosen existing ID. */
export async function saveWeightMeasurement(value:WeightMeasurementValues,item?:Weight|null){
 if(!validLocalDate(value.date)||!Number.isFinite(value.kg)||value.kg<=0||typeof value.notes!=='string'||(value.measuredAt!==undefined&&!validMeasuredAt(value.measuredAt))||(!item&&value.measuredAt===undefined))throw Error('Invalid measurement');
 const fields={...value,notes:value.notes.trim()};
 if(!item){const row={...stamp(),...fields};if(measurementDate(row)>localDate())throw Error('Invalid measurement');await weights.add(row);return row}
 return db.transaction('rw',weights,async()=>{
  const current=await weights.get(item.id);if(!current||current.deletedAt||current.revision!==item.revision)throw Error('Weight changed');
  const row={...current,...fields,updatedAt:new Date().toISOString(),revision:current.revision+1};
  if(measurementDate(row)>localDate())throw Error('Invalid measurement');
  await weights.update(item.id,row);return row;
 });
}
