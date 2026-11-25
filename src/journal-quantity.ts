import type {RecipeLine} from './domain';
/** Display only. Never feeds scaling, sessions, snapshots or inventory. */
export function journalQuantity(line:Pick<RecipeLine,'unit'|'quantity'>):string{
 return String(Math.round(line.unit==='fraction'?line.quantity*100:line.quantity));
}

const editFormat=new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:1});
export const journalEditValue=(quantity:number)=>editFormat.format(quantity);
