import {round} from './domain';
export function rangeText(min:number|null,max:number|null) {return min===null?max===null?"":`≤ ${round(max)}`:max===null?`≥ ${round(min)}`:min===max?round(min):`${round(min)}–${round(max)}`;}
