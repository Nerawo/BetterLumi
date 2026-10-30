import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {useTranslation} from 'react-i18next';
import {createAIMealSession} from './ai-meal-session';
import {registerRouteLeaveGuard} from './routing';
/** A visit survives editing and app switching, but never adopts a previous visit's saved text. */
export function useAIMealDraft(){
 const {t}=useTranslation(),[session,setSession]=useState(createAIMealSession);
 const lifecycle=useRef<{session:typeof session;token:object}|null>(null);
 const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot);
 useEffect(()=>{
  const token={};lifecycle.current={session,token};
  const guard=registerRouteLeaveGuard(target=>{
   if(new URL(target,'http://local').pathname==='/assistant/meals')return true;
   if(session.isImporting())return false;
   if(session.dirty()&&!window.confirm(t('aiLeaveDraft')))return false;
   void session.discard().catch(()=>{});return true;
  });
  const unload=(event:BeforeUnloadEvent)=>{if(session.dirty()){event.preventDefault();event.returnValue=''}};
  const visibility=()=>{if(document.visibilityState==='hidden')void session.flush()};
  const hide=()=>{void session.discard().catch(()=>{})};
  const show=(event:PageTransitionEvent)=>{if(event.persisted)setSession(createAIMealSession())};
  window.addEventListener('beforeunload',unload);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);document.addEventListener('visibilitychange',visibility);
  return()=>{guard();window.removeEventListener('beforeunload',unload);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);document.removeEventListener('visibilitychange',visibility);
   // Strict Mode immediately reconnects the same store; only a real unmount releases its pending work.
   queueMicrotask(()=>{if(lifecycle.current?.session!==session||lifecycle.current.token===token)void session.discard().catch(()=>{})});
  };
 },[session,t]);
 return {...snapshot,change:session.change,importDraft:session.importDraft};
}
