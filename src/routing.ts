import {newId} from "./ids";
import { useSyncExternalStore } from "react";
import {currentRoute,logicalRoute,routeHref} from './route-urls';
export {currentRoute,routeHref} from './route-urls';
const scrollPositions = new Map<string, number>();
type RouteLeaveGuard=(target:string)=>boolean;
let routeLeaveGuard:RouteLeaveGuard|null=null;
export function registerRouteLeaveGuard(guard:RouteLeaveGuard){routeLeaveGuard=guard;return()=>{if(routeLeaveGuard===guard)routeLeaveGuard=null}}
let lastEntry:{route:string;url:string;state:any}|null=null,restoringEntry=false;
const rememberEntry=()=>{lastEntry={route:currentRoute(),url:location.href,state:history.state}};
import { localDate } from "./db";
export function navigate(url: string, replace = false, preserveScroll = false) {
  const next = new URL(url, location.origin);
  if (next.origin !== location.origin) throw Error("External route");
  const target = logicalRoute(next.href);
  const current = currentRoute();
  if (target === current)
    return;
  if(routeLeaveGuard&&!routeLeaveGuard(target))return;
  window.history.replaceState({...history.state, scrollY:window.scrollY}, "");
  window.history[replace ? "replaceState" : "pushState"](
    {
      ...(replace ? history.state : {}),
      routeIndex:(Number.isSafeInteger(history.state?.routeIndex)?history.state.routeIndex:0)+(replace?0:1),
      ...(replace ? {} : {from: current, appNavigation: true, navKey: newId(), scrollY: preserveScroll ? window.scrollY : 0}),
      recipeOverlay:
        /^\/recipes\/[^/?]+(?:\?|$)/.test(target) &&
        new URL(current, "http://local").pathname === "/recipes",
    },
    "",
    routeHref(target),
  );
  rememberEntry();
  window.dispatchEvent(new PopStateEvent("popstate", {state: {inPlace: preserveScroll}}));
}
const subscribe = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  window.addEventListener("hashchange", fn);
  return () => {window.removeEventListener("popstate", fn);window.removeEventListener("hashchange", fn)};
};
export function validLocalDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00");
  return Number.isFinite(d.getTime()) && localDate(d) === value;
}
export function parseRoute(href: string) {
  const u = new URL(logicalRoute(href), "http://local");
  const paths = u.pathname.split("/").filter(Boolean);
  const section = [
    "today",
    "recipes",
    "pantry",
    "journal",
    "more",
    "weight",
    "assistant",
  ].includes(paths[0])
    ? paths[0]
    : "today";
  return {
    page: section,
    assistantMeals: section === "assistant" && paths[1] === "meals",
    recipeId:
      section === "recipes" && paths.length === 2 ? decodeId(paths[1]) : null,
    selectedDate: validLocalDate(u.searchParams.get("date"))
      ? u.searchParams.get("date")!
      : localDate(),
  };
}
function decodeId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
export function useRoute() {
  const href = useSyncExternalStore(
    subscribe,
    currentRoute,
  );
  return parseRoute(href);
}
export function shiftMonth(date: string, delta: number) {
  const d = new Date(date + "T12:00:00");
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, count));
  return localDate(d);
}

export function backToOrigin(fallback = "/more") {
  const state = history.state;
  history.replaceState({...state, scrollY:window.scrollY}, "");
  if (state?.appNavigation && typeof state.from === "string" && /^\/(today|more|recipes|pantry|weight)(\/|\?|$)/.test(state.from)) history.back();
  else navigate(fallback, true);
}
if (typeof window !== "undefined") window.addEventListener("popstate", (event) => {
  if (event.state?.inPlace) return;
  const key = history.state?.navKey ?? currentRoute();
  const y = Number(scrollPositions.get(key) ?? history.state?.scrollY ?? 0);
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({top:Number.isFinite(y)?y:0,behavior:"instant"})));
});

if (typeof window !== "undefined") {
  if (!history.state?.navKey) history.replaceState({...history.state,navKey:newId()}, "");
  window.addEventListener("scroll", () => scrollPositions.set(history.state?.navKey ?? currentRoute(), window.scrollY), {passive:true});
}

// Cancel native back/forward before React observes the changed route. Restore the same history entry on cancellation.
if(typeof window!=='undefined'){
 if(!Number.isSafeInteger(history.state?.routeIndex))history.replaceState({...history.state,routeIndex:0},'');
 rememberEntry();
 const check=(event:Event)=>{
  if(restoringEntry){event.stopImmediatePropagation();if(currentRoute()===lastEntry?.route)restoringEntry=false;return}
  const target=currentRoute(),previous=lastEntry;if(!previous||target===previous.route)return;
  if(routeLeaveGuard&&!routeLeaveGuard(target)){
   event.stopImmediatePropagation();const from=previous.state?.routeIndex,to=history.state?.routeIndex;
   if(Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&from!==to){restoringEntry=true;history.go(from-to)}
   else history.replaceState(previous.state,'',previous.url);
   return;
  }
  if(!Number.isSafeInteger(history.state?.routeIndex))history.replaceState({...history.state,routeIndex:(previous.state?.routeIndex??0)+1},'');
  rememberEntry();
 };
 window.addEventListener('popstate',check,true);window.addEventListener('hashchange',check,true);
}
