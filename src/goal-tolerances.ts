import {useLiveQuery} from 'dexie-react-hooks';
import {db,localDate} from './domain';
import {newId} from './ids';
import {currentTolerances,parseToleranceEvents,validTolerances,type GoalTolerances} from './goal-tolerance-model';
export const toleranceSettingKey='goalTolerances';
export function useGoalToleranceSettings(){const raw=useLiveQuery(()=>db.settings.get(toleranceSettingKey).then(row=>row??null));const events=parseToleranceEvents(raw?.value);return {events,values:currentTolerances(events),ready:raw!==undefined}}
export async function saveGoalTolerances(values:GoalTolerances){if(!validTolerances(values))throw Error('Invalid tolerances');await db.transaction('rw',db.settings,async()=>{const old=await db.settings.get(toleranceSettingKey),events=parseToleranceEvents(old?.value);events.push({id:newId(),date:localDate(),at:new Date().toISOString(),values:{...values}});await db.settings.put({key:toleranceSettingKey,value:JSON.stringify({version:1,events})})})}
