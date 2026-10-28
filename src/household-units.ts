import rows from './data/household-units.generated.json';
import type {ConsumptionUnit} from './consumption-units';
export interface HouseholdUnit extends ConsumptionUnit {readonly foodId:string;readonly labelZh:string;readonly labelEn:string}
const catalog:readonly HouseholdUnit[]=Object.freeze(rows.map(row=>Object.freeze({...row,unit:'g' as const})));
const byFood=new Map<string,readonly HouseholdUnit[]>();
for(const row of catalog)byFood.set(row.foodId,Object.freeze([...(byFood.get(row.foodId)??[]),row]));
export const builtInHouseholdUnits=(foodId:string):readonly HouseholdUnit[]=>byFood.get(foodId)??[];
const normalized=(value:string)=>value.normalize('NFKC').trim().toLowerCase();
const labelConflict=(unit:HouseholdUnit,custom:readonly ConsumptionUnit[])=>custom.some(c=>[unit.labelZh,unit.labelEn].some(label=>normalized(label)===normalized(c.name)));
/** No preference writes: custom keys/labels take precedence in the selectable list. */
export function visibleHouseholdUnits(foodId:string,custom:readonly ConsumptionUnit[],preferred?:string){
 return builtInHouseholdUnits(foodId).filter(unit=>!custom.some(c=>normalized(c.name)===normalized(unit.name))&&(!labelConflict(unit,custom)||preferred===unit.name));
}
export function householdUnitLabel(foodId:string,unit:string,language:string,custom:readonly ConsumptionUnit[]=[]):string{
 if(custom.some(c=>c.name===unit))return unit;
 const entry=builtInHouseholdUnits(foodId).find(row=>row.name===unit);
 return entry?(language.startsWith('zh')?entry.labelZh:entry.labelEn)+(labelConflict(entry,custom)?' · USDA':''):unit;
}
