import {useEffect,useRef,useState} from 'react';
import {goalDraftKey,readGoalDraft,removeSession,writeSession,type GoalDraftState} from './session-state';
/** Drafts are tab-scoped UI state, never active goals or part of JSON backups. */
export function useGoalDraft(date:string,baseline:string){
 const [restored]=useState(()=>readGoalDraft(date,baseline)),initial=useRef<string|null>(null),current=useRef<GoalDraftState|null>(null),active=useRef(restored!==null),discarded=useRef(false);
 const persist=()=>{if(active.current&&!discarded.current&&current.current)writeSession(goalDraftKey(date),{baseline,value:current.current})};
 const updateSnapshot=(value:GoalDraftState)=>{const serialized=JSON.stringify(value);current.current=value;if(initial.current===null)initial.current=serialized;if(serialized!==initial.current)active.current=true;persist()};
 useEffect(()=>{const hide=()=>persist();const visibility=()=>{if(document.visibilityState==='hidden')persist()};window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',visibility)}},[date,baseline]);
 return {restored,updateSnapshot,discard:()=>{discarded.current=true;active.current=false;removeSession(goalDraftKey(date))}};
}
