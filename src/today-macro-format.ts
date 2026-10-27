/** Today target labels only; stored goals and consumed values retain full precision. */
export function todayMacroBound(value:number):string {
 return String(value<100?Number(value.toFixed(1)):Math.round(value));
}
export function todayMacroRange(min:number|null,max:number|null):string {
 return min===null?max===null?'':'≤ '+todayMacroBound(max):max===null?'≥ '+todayMacroBound(min):min===max?todayMacroBound(min):todayMacroBound(min)+'–'+todayMacroBound(max);
}
