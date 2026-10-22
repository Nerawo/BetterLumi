import {localDate} from './db';
import {validLocalDate} from './routing';
import type {Weight} from './domain';

/** Explicit offset/UTC only: date-only or timezone-less strings are ambiguous. */
export function validMeasuredAt(value:unknown):value is string {
 if(typeof value!=='string')return false;
 const match=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
 return !!match&&validLocalDate(match[1])&&Number(match[2])<24&&Number(match[3])<60&&Number(match[4])<60&&(!match[6]||Number(match[6])<24&&Number(match[7])<60)&&Number.isFinite(Date.parse(value));
}
export function localMeasurementTime(value:string){const d=new Date(value);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
export function measurementDate(weight:Weight){return validMeasuredAt(weight.measuredAt)?localDate(new Date(weight.measuredAt)):weight.date}
/** Unknown legacy times sort at the start of their date, without persisting a fake time. */
export function measurementMillis(weight:Weight){return validMeasuredAt(weight.measuredAt)?Date.parse(weight.measuredAt):new Date(weight.date+'T00:00:00').getTime()}
export function compareMeasurements(a:Weight,b:Weight){
 return measurementMillis(b)-measurementMillis(a)||Number(validMeasuredAt(b.measuredAt))-Number(validMeasuredAt(a.measuredAt))||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id);
}
export function localMeasurementIso(date:string,time:string){
 if(!validLocalDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Invalid measurement time');
 const instant=new Date(date+'T'+time+':00');
 // Reject nonexistent local times across a daylight-saving gap.
 if(!Number.isFinite(instant.getTime())||localDate(instant)!==date||localMeasurementTime(instant.toISOString())!==time)throw Error('Invalid measurement time');
 return instant.toISOString();
}
export function formatMeasurementTime(weight:Weight,language:string){return validMeasuredAt(weight.measuredAt)?new Date(weight.measuredAt).toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit'}):null}
