import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {readWeightState,type WeightState} from './weight-state';
const WeightDataContext=createContext<WeightState|undefined|null>(null);
/** One reactive weight subscription shared by Today, diary, BMI and calculator. */
export function WeightDataProvider({children}:{children:ReactNode}){
 // Re-resolve local grouping/legacy ordering after a device timezone change; never reload.
 const zoneKey=()=>Intl.DateTimeFormat().resolvedOptions().timeZone+':'+new Date().getTimezoneOffset();
 const [zone,setZone]=useState(zoneKey);
 useEffect(()=>{const resume=()=>{if(document.visibilityState!=='hidden')setZone(zoneKey())};window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);return()=>{window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume)}},[]);
 const state=useLiveQuery(readWeightState,[zone]);
 return <WeightDataContext.Provider value={state}>{children}</WeightDataContext.Provider>;
}
export function useWeightData(){const state=useContext(WeightDataContext);if(state===null)throw Error('WeightDataProvider is required');return state}
