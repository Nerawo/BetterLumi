import {newId} from "./ids";
import { useSyncExternalStore } from "react";
const scrollPositions = new Map<string, number>();
import { localDate } from "./db";
export function navigate(url: string, replace = false, preserveScroll = false) {
  const next = new URL(url, location.origin);
  if (next.origin !== location.origin) throw Error("External route");
  if (next.pathname + next.search === location.pathname + location.search)
    return;
  window.history.replaceState({...history.state, scrollY:window.scrollY}, "");
  window.history[replace ? "replaceState" : "pushState"](
    {
      ...(replace ? history.state : {}),
      ...(replace ? {} : {from: location.pathname + location.search, appNavigation: true, navKey: newId(), scrollY: preserveScroll ? window.scrollY : 0}),
      recipeOverlay:
        /^\/recipes\/[^/]+$/.test(next.pathname) &&
        location.pathname === "/recipes",
    },
    "",
    next.pathname + next.search,
  );
  window.dispatchEvent(new PopStateEvent("popstate", {state: {inPlace: preserveScroll}}));
}
const subscribe = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
};
export function validLocalDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00");
  return Number.isFinite(d.getTime()) && localDate(d) === value;
}
export function parseRoute(href: string) {
  const u = new URL(href, "http://local");
  const paths = u.pathname.split("/").filter(Boolean);
  const section = [
    "today",
    "recipes",
    "pantry",
    "journal",
    "more",
    "weight",
  ].includes(paths[0])
    ? paths[0]
    : "today";
  return {
    page: section,
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
    () => location.pathname + location.search,
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
  const key = history.state?.navKey ?? location.pathname + location.search;
  const y = Number(scrollPositions.get(key) ?? history.state?.scrollY ?? 0);
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({top:Number.isFinite(y)?y:0,behavior:"instant"})));
});

if (typeof window !== "undefined") {
  if (!history.state?.navKey) history.replaceState({...history.state,navKey:newId()}, "");
  window.addEventListener("scroll", () => scrollPositions.set(history.state?.navKey ?? location.pathname + location.search, window.scrollY), {passive:true});
}
