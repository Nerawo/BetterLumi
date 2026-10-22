import { useState, useEffect } from 'react';
import { localDate } from './db';
/** One local-midnight timer while visible; resuming never navigates or reloads. */
export function useLocalToday(){
 const [today,setToday]=useState(localDate);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>|undefined;const update=()=>{if(timer)clearTimeout(timer);if(document.visibilityState==='hidden')return;const next=localDate();setToday(old=>old===next?old:next);const midnight=new Date();midnight.setHours(24,0,0,0);timer=setTimeout(update,Math.max(1,midnight.getTime()-Date.now()+50))};update();window.addEventListener('focus',update);window.addEventListener('pageshow',update);document.addEventListener('visibilitychange',update);return()=>{if(timer)clearTimeout(timer);window.removeEventListener('focus',update);window.removeEventListener('pageshow',update);document.removeEventListener('visibilitychange',update)}},[]);
 return today;
}
